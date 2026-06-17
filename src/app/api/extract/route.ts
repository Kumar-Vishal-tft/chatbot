import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

function hasProfanity(text: string): boolean {
  const badWords = [
    'fuck', 'shit', 'bitch', 'asshole', 'crap', 'dick', 'pussy', 'bastard',
    'idiot', 'dumb', 'stupid', 'whore', 'slut', 'cunt', 'fag', 'nigger',
    'retard', 'wanker', 'motherfucker', 'cocksucker',
  ];
  const lower = text.toLowerCase();
  return badWords.some((word) => lower.includes(word));
}

export async function POST(request: NextRequest) {
  try {
    const { text, currentStep } = await request.json();
    if (typeof text !== 'string') {
      return NextResponse.json({ success: false, reason: 'Invalid parameters' }, { status: 400 });
    }

    // Deterministic profanity check
    if (hasProfanity(text)) {
      const stepName = currentStep ? currentStep.toLowerCase().replace('asked_', '') : '';
      const emptyResult = {
        name: { valid: false, value: null, reason: '' },
        age: { valid: false, value: null, reason: '' },
        gender: { valid: false, value: null, reason: '' },
        phone_number: { valid: false, value: null, reason: '' },
        health_goal: { valid: false, value: null, reason: '' },
        conditions: { valid: false, value: null, reason: '' },
        feeling_note: { valid: false, value: null, reason: '' }
      };

      if (stepName === 'name') {
        emptyResult.name = { valid: false, value: null, reason: "That doesn't look like a real name. Please enter a valid name." };
      } else if (stepName === 'age') {
        emptyResult.age = { valid: false, value: null, reason: 'Please enter a valid age between 5 and 110.' };
      } else if (stepName === 'gender') {
        emptyResult.gender = { valid: false, value: null, reason: 'Please select Male, Female, or Prefer not to say.' };
      } else if (stepName === 'phone') {
        emptyResult.phone_number = { valid: false, value: null, reason: 'Please enter a valid phone number.' };
      } else if (stepName === 'goal') {
        emptyResult.health_goal = { valid: false, value: null, reason: 'Please describe your health goals.' };
      } else if (stepName === 'conditions') {
        emptyResult.conditions = { valid: false, value: null, reason: 'Please list any medical conditions or specify "None".' };
      } else if (stepName === 'feeling') {
        emptyResult.feeling_note = { valid: false, value: null, reason: 'Please describe how you are feeling.' };
      }

      return NextResponse.json({
        success: true,
        extracted: emptyResult
      });
    }

    if (!GEMINI_API_KEY) {
      console.error('Gemini API key is not configured for extraction route.');
      return NextResponse.json({ success: false, reason: 'API key missing' }, { status: 500 });
    }

    const systemInstruction = `You are a clinical profile entity extraction engine.
Analyze the user's input and extract any of the following clinical profiling attributes. Validate each extracted attribute strictly according to the rules:

1. name (name):
   - Rules: Real human name. Minimum 2 characters. No numbers/symbols. Reject single letters.
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

2. age (age):
   - Rules: Valid age between 5 and 110. Whole integer number only. Reject decimals, fractions, or negative numbers.
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

3. gender (gender):
   - Rules: 'Male', 'Female', or 'Prefer not to say'. Map guy/man/boy -> Male, girl/woman/she -> Female, skip/rather not say -> Prefer not to say.
   - Output schema: { "valid": boolean, "value": "Male" | "Female" | "Prefer not to say" | null, "reason": string }

4. phone_number (phone):
   - Rules: 10-digit starting with 6–9 (Indian), or international format starting with + and 10–15 digits. Strip spaces/dashes.
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

5. health_goal (goal):
   - Rules: Map user's goals to one or more of: [Weight loss, Diabetes, Blood reports, Nutrition, Fitness, General wellness, Hypertension, GLP-1, Metabolic, Sexual Wellness, Mental Wellness, Longevity].
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

6. conditions (conditions):
   - Rules: Map to one or more of: [None, Diabetes, Hypertension, Asthma, Obesity, Metabolic health].
   - Output schema: { "valid": boolean, "value": string[] | null, "reason": string }

7. feeling_note (feeling):
   - Rules: 2 to 500 characters. Reject repeating gibberish.
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

Output JSON must follow this schema exactly:
{
  "extracted": {
    "name": { "valid": boolean, "value": string | null, "reason": string },
    "age": { "valid": boolean, "value": string | null, "reason": string },
    "gender": { "valid": boolean, "value": string | null, "reason": string },
    "phone_number": { "valid": boolean, "value": string | null, "reason": string },
    "health_goal": { "valid": boolean, "value": string | null, "reason": string },
    "conditions": { "valid": boolean, "value": string[] | null, "reason": string },
    "feeling_note": { "valid": boolean, "value": string | null, "reason": string }
  }
}
CRITICAL: If an entity is NOT mentioned in the text, you MUST set its "valid" to false, "value" to null, and "reason" to "" (empty string). Do NOT output validation messages for missing or unmentioned fields.
Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;

    let contextHint = '';
    if (currentStep) {
      const stepName = currentStep.toLowerCase().replace('asked_', '');
      contextHint = `\nContext Hint: The user is currently answering the prompt for the field "${stepName}". If the user's input is a simple/short response (e.g. just a number like "99", "male", "diabetes", or "none"), you MUST treat it as the value for the "${stepName}" attribute.`;
    }
    const fullSystemInstruction = `${systemInstruction}${contextHint}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        systemInstruction: { parts: [{ text: fullSystemInstruction }] },
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 512
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (replyText) {
        const cleaned = replyText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return NextResponse.json({
          success: true,
          extracted: parsed.extracted
        });
      }
    } else {
      const errText = await response.text().catch(() => 'No details');
      console.error(`Gemini Extraction API Error: Status ${response.status}. Details: ${errText}`);
    }

    return NextResponse.json({ success: false, reason: 'Failed to extract entities' }, { status: 500 });
  } catch (error: any) {
    console.error('Extraction route error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
