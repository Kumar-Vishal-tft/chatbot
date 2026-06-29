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
   - Rules: 2 to 500 characters. Reject repeating gibberish. Do NOT extract social greetings (like "hi", "hello", "hey", "good morning") or simple filler/acknowledgement words (like "okay", "yes", "no", "thanks") as a feeling_note.
   - Output schema: { "valid": boolean, "value": string | null, "reason": string }

8. General Rule:
   - Do NOT extract conversational greetings (e.g., "hi", "hello", "hey", "good morning"), filler phrases (e.g., "ok", "yes", "no"), or acknowledgements as name, feeling_note, health_goal, or any other attribute. If the input contains only greetings/fillers, all attributes must have "valid" set to false and "value" set to null.

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
CRITICAL: If the user's input is a health-related question, health-related statement (e.g., about their diet, sleep, symptoms, habits like eating at midnight, or medical concerns), or general health inquiry instead of answering the current onboarding prompt (indicated by Context Hint), you MUST set the "reason" of the active attribute (e.g. name, gender, age) to "health_question" (and set its "valid" to false and "value" to null).
Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;

    let contextHint = '';
    if (currentStep) {
      const stepName = currentStep.toLowerCase().replace('asked_', '');
      contextHint = `\nContext Hint: The user is currently answering the prompt for the field "${stepName}". If the user's input is a simple/short response (e.g. just a number like "99", "male", "diabetes", or "none"), you MUST treat it as the value for the "${stepName}" attribute.`;
    }
    const fullSystemInstruction = `${systemInstruction}${contextHint}`;

    let response;
    let data;
    let attempts = 0;
    const maxAttempts = 2;
    let parsedJson = null;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        const model = attempts === 1 ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        response = await fetch(url, {
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

        if (!response.ok) {
          const errText = await response.text().catch(() => 'No details');
          throw new Error(`Gemini Extraction API Error: Status ${response.status}. Details: ${errText}`);
        }

        data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) {
          throw new Error('Empty response from Gemini Extraction API');
        }

        const cleaned = replyText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        parsedJson = JSON.parse(cleaned);
        break; // Success!
      } catch (err) {
        if (attempts >= maxAttempts) {
          throw err;
        }
        console.warn(`Extraction LLM call failed (Attempt ${attempts}/${maxAttempts}), retrying in 1.5s...`, err);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (parsedJson) {
      return NextResponse.json({
        success: true,
        extracted: parsedJson.extracted
      });
    }

    return NextResponse.json({ success: false, reason: 'Failed to extract entities' }, { status: 500 });
  } catch (error: any) {
    console.error('Extraction route error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
