import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { redis } from '@/lib/redis';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

function extractPrintableStrings(buffer: Buffer): string {
  let result = '';
  let currentString = '';
  for (let i = 0; i < buffer.length; i++) {
    const charCode = buffer[i];
    // ASCII printable range (space to ~) plus newline, carriage return and tab
    if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
      currentString += String.fromCharCode(charCode);
    } else {
      if (currentString.length >= 4) {
        result += currentString + '\n';
      }
      currentString = '';
    }
  }
  if (currentString.length >= 4) {
    result += currentString + '\n';
  }
  return result;
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/i, '');
  }
  return cleaned.trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, detail: 'No file uploaded' }, { status: 400 });
    }

    const sessionId = formData.get('sessionId') as string | null;
    const uploadType = formData.get('uploadType') as string | null || 'report';
    const password = formData.get('password') as string | null;

    // Server-side entitlement validation
    if (sessionId) {
      const sessionRaw = await redis.get(`session:${sessionId}`);
      if (sessionRaw) {
        try {
          const session = JSON.parse(sessionRaw);
          const isProgram = session.isProgramActivated === true;
          
          if (!isProgram) {
            const count = uploadType === 'prescription' 
              ? (session.prescriptionUploadCount || 0)
              : (session.reportUploadCount || 0);

            if (count >= 1) {
              console.warn(`[Entitlement Gate] User reached upload quota for ${uploadType} on session ${sessionId}. Blocking API request.`);
              return NextResponse.json({
                success: false,
                detail: `You have reached the maximum allowed free uploads of 1 ${uploadType === 'prescription' ? 'prescription' : 'report'}. Please upgrade to a YHealth program to continue.`
              }, { status: 403 });
            }
          }
        } catch (e) {
          console.warn('Failed to parse session raw data in classify gate:', e);
        }
      }
    }

    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://72.61.241.48:8000';
    const targetUrl = `${backendUrl.replace(/\/$/, '')}/agent/classify-document`;

    const outgoingFormData = new FormData();
    outgoingFormData.append('file', file, file.name);
    if (password) {
      outgoingFormData.append('password', password);
    }

    console.log(`Forwarding classification for "${file.name}" to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
      },
      body: outgoingFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Classification endpoint returned error status:', response.status, errText);
      return NextResponse.json({ success: false, detail: `Backend classification failed: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log('Classification response data:', data);

    const isMedical = data.is_medical_document === true;

    // Check if the file is password-protected and prompt for password
    if (!isMedical && data.message && data.message.toLowerCase().includes('password')) {
      return NextResponse.json({
        success: true,
        is_password_protected: true,
        message: data.message
      });
    }

    // If it is a medical document and we have a Gemini API key, let's analyze it and extract patient details
    let extractedProfile = null;
    let analysisSummary = '';

    if (isMedical && GEMINI_API_KEY) {
      try {
        console.log(`Extracting details from medical document "${file.name}" using Gemini...`);
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const contentsParts: any[] = [];
        const fileNameLower = file.name.toLowerCase();

        if (fileNameLower.endsWith('.docx')) {
          console.log('Parsing .docx file using mammoth...');
          const mammothResult = await mammoth.extractRawText({ buffer });
          const textContent = mammothResult.value;
          contentsParts.push({ text: `Here is the extracted text content of the uploaded Word document:\n\n${textContent}` });
        } else if (fileNameLower.endsWith('.doc')) {
          console.log('Parsing binary .doc file using printable strings extractor...');
          const textContent = extractPrintableStrings(buffer);
          contentsParts.push({ text: `Here is the extracted text content of the uploaded Word document:\n\n${textContent}` });
        } else if (fileNameLower.endsWith('.pdf')) {
          console.log('Decrypting PDF file using pdftocairo...');
          const tempPdfPath = path.join('/tmp', `${Date.now()}-${file.name}`);
          const decryptedPdfPath = tempPdfPath + '-decrypted.pdf';
          try {
            fs.writeFileSync(tempPdfPath, buffer);
            const pwdArg = password ? `-upw "${password.replace(/"/g, '\\"')}"` : '';
            execSync(`pdftocairo -pdf ${pwdArg} "${tempPdfPath}" "${decryptedPdfPath}"`, { stdio: 'ignore' });
            
            const decryptedBuffer = fs.readFileSync(decryptedPdfPath);
            const base64Data = decryptedBuffer.toString('base64');
            contentsParts.push({ inlineData: { mimeType: 'application/pdf', data: base64Data } });
            console.log('Successfully decrypted PDF using pdftocairo and read buffer');
          } catch (err) {
            console.warn('Failed to decrypt PDF using pdftocairo, falling back to original base64 inlineData', err);
            const base64Data = buffer.toString('base64');
            const mimeType = file.type || 'application/pdf';
            contentsParts.push({ inlineData: { mimeType, data: base64Data } });
          } finally {
            try { fs.unlinkSync(tempPdfPath); } catch {}
            try { fs.unlinkSync(decryptedPdfPath); } catch {}
          }
        } else {
          // Fallback to sending base64 inlineData for images
          const base64Data = buffer.toString('base64');
          const mimeType = file.type || 'application/pdf';
          contentsParts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const systemInstruction = `You are a clinical document intelligence assistant.
Analyze the uploaded medical report/document. Perform two tasks:
1. Extract patient profile details if they are visible in the document:
   - Name (name): full name or null
   - Age (age): integer age or null
   - Gender (gender): "Male", "Female", or null
   - Phone Number (phone_number): phone number or null
   - Health Goal (health_goal): primary concern or goal visible in the report (e.g. "Manage blood glucose", "Monitor thyroid") or null
   - Conditions (conditions): array of medical conditions detected from the diagnostic notes (e.g. ["Diabetes", "Hypertension"]) or empty array
   - Feeling Note (feeling_note): a summary note of the patient's state or symptoms described in the report, or null

2. Generate a concise clinical analysis summary (analysis_summary) of the report in 2-3 sentences. Note any out-of-range biomarkers (elevated glucose, low vitamins, etc.) or primary findings.

Output must be a clean JSON object following this schema:
{
  "extracted_profile": {
    "name": string | null,
    "age": number | null,
    "gender": "Male" | "Female" | null,
    "phone_number": string | null,
    "health_goal": string | null,
    "conditions": string[],
    "feeling_note": string | null
  },
  "analysis_summary": string
}
Do not include markdown code blocks or any conversational text. Output only raw JSON.`;

        // Attempt extraction with model fallback
        const modelsToTry = ['gemini-2.5-flash'];
        let geminiRes = null;
        let successfulModel = '';

        for (const model of modelsToTry) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            console.log(`Extracting details from "${file.name}" via Gemini model "${model}"...`);
            
            const attemptRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: "Analyze the uploaded document, extract patient details and generate a clinical summary." },
                    ...contentsParts
                  ]
                }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                  responseMimeType: "application/json",
                  temperature: 0.1,
                  maxOutputTokens: 8192,
                }
              })
            });

            if (attemptRes.ok) {
              geminiRes = attemptRes;
              successfulModel = model;
              break;
            } else {
              const errText = await attemptRes.text();
              console.warn(`Gemini extraction failed for model "${model}" (Status ${attemptRes.status}): ${errText}`);
            }
          } catch (modelErr) {
            console.error(`Exception using Gemini model "${model}":`, modelErr);
          }
        }

        if (geminiRes && geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            const cleaned = cleanJsonString(replyText);
            try {
              const parsed = JSON.parse(cleaned);
              extractedProfile = parsed.extracted_profile || null;
              analysisSummary = parsed.analysis_summary || '';
              console.log(`Successfully extracted profile details using model "${successfulModel}":`, extractedProfile);
            } catch (jsonErr) {
              console.error(`Failed to parse Gemini response as JSON. Cleaned reply:\n${cleaned}`, jsonErr);
            }
          }
        } else {
          console.error('All Gemini extraction models failed.');
        }
      } catch (err) {
        console.error('Failed to extract patient details via Gemini:', err);
      }
    }

    return NextResponse.json({
      success: true,
      is_medical_document: isMedical,
      document_type: data.document_type,
      extracted_profile: extractedProfile,
      analysis_summary: analysisSummary
    });
  } catch (error: any) {
    console.error('Error in classify proxy route:', error);
    return NextResponse.json({ success: false, detail: error.message || 'Server error occurred during classification' }, { status: 500 });
  }
}
