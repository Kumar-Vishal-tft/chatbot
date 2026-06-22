import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, detail: 'No file uploaded' }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://72.61.241.48:8000';
    const targetUrl = `${backendUrl.replace(/\/$/, '')}/agent/classify-document`;

    const outgoingFormData = new FormData();
    outgoingFormData.append('file', file, file.name);

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
        } else {
          // Fallback to sending base64 inlineData for PDFs and images
          const base64Data = buffer.toString('base64');
          const mimeType = file.type || 'application/pdf';
          contentsParts.push({ inlineData: { mimeType, data: base64Data } });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
        
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

        const geminiRes = await fetch(geminiUrl, {
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
              maxOutputTokens: 1024,
            }
          })
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            const parsed = JSON.parse(replyText.trim());
            extractedProfile = parsed.extracted_profile || null;
            analysisSummary = parsed.analysis_summary || '';
            console.log('Successfully extracted profile details from document:', extractedProfile);
          }
        } else {
          console.warn('Gemini extraction call returned status:', geminiRes.status);
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
