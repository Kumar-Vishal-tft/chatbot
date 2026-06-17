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
    const { step, value } = await request.json();
    if (!step || typeof value !== 'string') {
      return NextResponse.json({ valid: false, reason: 'Invalid parameters' }, { status: 400 });
    }

    const normalizedStep = step.toLowerCase().replace('asked_', '');

    // Deterministic profanity check
    if (hasProfanity(value)) {
      let reason = 'Please enter a valid input.';
      if (normalizedStep === 'name') {
        reason = "That doesn't look like a real name. Please enter a valid name.";
      } else if (normalizedStep === 'age') {
        reason = 'Please enter a valid age between 5 and 110.';
      } else if (normalizedStep === 'gender') {
        reason = 'Please select Male, Female, or Prefer not to say.';
      } else if (normalizedStep === 'phone') {
        reason = 'Please enter a valid mobile number.';
      } else if (normalizedStep === 'goal') {
        reason = 'Please describe your health goals.';
      } else if (normalizedStep === 'conditions') {
        reason = 'Please mention any medical conditions, or specify "None".';
      } else if (normalizedStep === 'feeling') {
        reason = 'Please enter a note about how you are feeling (2-500 characters).';
      }
      return NextResponse.json({
        valid: false,
        normalized: '',
        reason
      });
    }

    if (!GEMINI_API_KEY) {
      console.error('Gemini API key is not configured for validation route.');
      return NextResponse.json({ valid: false, reason: 'API key missing' }, { status: 500 });
    }

    let systemInstruction = '';
    const trimmedVal = value.trim();

    switch (normalizedStep) {
      case 'name':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to see if they provided a valid real first name or preferred name.
Rules:
1. Must be a real human name. Minimum 2 characters.
2. Must NOT contain digits, numbers, or symbols.
3. Reject single letters.
4. If the user asked a health-related question or general medical inquiry instead of answering the name prompt, set "valid": false and set "reason": "health_question".
5. If the input is invalid, contains digits, contains symbols, or is gibberish, set "valid": false and set "reason" to a friendly, conversational, natural, and helpful explanation of why the input is invalid (e.g., "Names shouldn't have numbers in it.", "Please enter a name without special characters.", "Please share a name that is at least 2 letters long.", "That doesn't look like a real name. Please enter a valid name."). Do not show emojis in the reason.
6. If valid, set "valid": true, "normalized": the extracted clean capitalized name, and "reason": "".
7. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'age':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to see if they provided a valid age.
Rules:
1. Must be a valid age between 5 and 110.
2. Accept numbers or words representing numbers (e.g., "twenty two" -> "22", "twenty-two" -> "22").
3. Reject negatives, 0, ages > 110, or non-numeric text that isn't a word-number.
4. Reject decimal numbers, fractions, or floating point numbers (e.g. "25.5", "25.2", "25.0"). Age must be a whole number (integer) only.
5. If the user asked a health-related question or general medical inquiry instead of answering the age prompt, set "valid": false and set "reason": "health_question".
6. If the input is a decimal or has a point, set "valid": false and set "reason" to "Age must be a whole number (integer). Please enter a valid age.".
7. If the input is invalid or out of range, set "valid": false and set "reason" to a friendly, conversational explanation (e.g., "Please share a valid age between 5 and 110.", "Ages should be entered as a number."). Do not show emojis in the reason.
8. If valid, set "valid": true, "normalized": the extracted age as an integer string (e.g. "28"), and "reason": "".
9. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'gender':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to extract their gender.
Rules:
1. Accept any natural phrasing of Male, Female, Non-binary, or Prefer not to say.
   Examples: "I'm a guy" -> "Male", "she/her" -> "Female", "rather not say" -> "Prefer not to say", "skip" -> "Prefer not to say".
2. If the user asked a health-related question instead of answering, set "valid": false and set "reason": "health_question".
3. If the input is completely unrelated or invalid, set "valid": false and set "reason" to a friendly, conversational suggestion (e.g., "Please select Male, Female, or Prefer not to say."). Do not show emojis in the reason.
4. If valid, set "valid": true, "normalized": "Male", "Female", or "Prefer not to say", and "reason": "".
5. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'phone':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to extract a valid mobile phone number.
Rules:
1. Validate Indian mobile numbers: 10-digit starting with 6–9, with or without a leading 0 or 91 prefix.
2. Validate international format starting with + and 10–15 total digits.
3. Strip any spaces, dashes, or non-digit characters before checking, but preserve the leading '+' for international.
4. If the user asked a health-related question, set "valid": false and set "reason": "health_question".
5. If the input is invalid or not a phone number, set "valid": false and set "reason" to a friendly, conversational explanation (e.g., "That doesn't look like a valid phone number. Please enter a 10-digit mobile number."). Do not show emojis in the reason.
6. If valid, set "valid": true, "normalized": the clean digits-only string (e.g. "9876543210") or "+country_code..." format, and "reason": "".
7. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'goal':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to extract their health goals.
Rules:
1. Map user's free text to one or more of these 12 valid goals:
   [Weight loss, Diabetes, Blood reports, Nutrition, Fitness, General wellness, Hypertension, GLP-1, Metabolic, Sexual Wellness, Mental Wellness, Longevity]
2. Accept natural language (e.g., "I want to get fit" -> "Fitness", "sugar problems" -> "Diabetes", "lose belly fat" -> "Weight loss", "nutrition and diet" -> "Nutrition").
3. Multiple goals can be matched. Map to all applicable goals.
4. If the user asked a health-related question instead of answering, set "valid": false and set "reason": "health_question".
5. If the input is completely off-topic or unrelated, set "valid": false and set "reason" to a friendly, conversational explanation (e.g., "Please describe your health goals, such as weight loss or diabetes management."). Do not show emojis in the reason.
6. If valid, set "valid": true, "normalized": comma-separated matched goals (e.g., "Weight loss, Nutrition"), and "reason": "".
7. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'conditions':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to extract medical conditions.
Rules:
1. Map user's input to one or more of these valid conditions:
   [None, Diabetes, Hypertension, Asthma, Obesity, Metabolic health]
2. Accept natural language (e.g., "I have high BP" -> "Hypertension", "overweight" -> "Obesity", "sugar" -> "Diabetes").
3. If user says none, no, nothing, or similar, map to "None".
4. Multiple conditions can be matched.
5. If the user asked a health-related question instead of answering, set "valid": false and set "reason": "health_question".
6. If the input is completely off-topic or unrelated, set "valid": false and set "reason" to a friendly, conversational explanation (e.g., "Please list any medical conditions or specify 'None'."). Do not show emojis in the reason.
7. If valid, set "valid": true, "normalized": comma-separated matched conditions (e.g. "Diabetes, Hypertension" or "None"), and "reason": "".
8. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      case 'feeling':
        systemInstruction = `You are a strict clinical profile validator.
Analyze the user's feeling note.
Rules:
1. The text must be between 2 and 500 characters.
2. Reject single characters, strings that are pure HTML/script tags (XSS protection), or gibberish repeated characters (e.g. "aaaaaaa").
3. Accept any genuine free-text note including "N/A", "fine", or full sentences.
4. If the user asked a health-related question instead of answering, set "valid": false and set "reason": "health_question".
5. If the input is invalid or unsafe, set "valid": false and set "reason" to a friendly, conversational explanation (e.g., "Please write a brief note about how you feel, between 2 and 500 characters."). Do not show emojis in the reason.
6. If valid, set "valid": true, "normalized": the cleaned input string, and "reason": "".
7. Your output must be a clean JSON object. Do not include markdown formatting or preamble.`;
        break;

      default:
        return NextResponse.json({ valid: false, reason: `Unknown validation step: ${step}` }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    const fullSystemInstruction = `${systemInstruction}\nOutput JSON must follow this schema:
{
  "valid": boolean,
  "normalized": string,
  "reason": string
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: trimmedVal }] }],
        systemInstruction: { parts: [{ text: fullSystemInstruction }] },
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 256
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (replyText) {
        const cleaned = replyText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.valid === false) {
          console.warn(`[VALIDATION FAILURE] Step: ${step}, Value: "${value}", Reason: "${parsed.reason}"`);
        }
        return NextResponse.json({
          valid: parsed.valid === true,
          normalized: parsed.normalized || '',
          reason: parsed.reason || ''
        });
      }
    } else {
      const errText = await response.text().catch(() => 'No details');
      console.error(`Gemini API Error: Status ${response.status}. Details: ${errText}`);
    }

    console.warn(`[VALIDATION FAILURE] Empty or blocked response from Gemini for Step: ${step}, Value: "${value}"`);
    let defaultReason = 'Please enter a valid input.';
    if (normalizedStep === 'name') {
      defaultReason = 'Please enter your real first name (at least 2 letters, no numbers or symbols).';
    } else if (normalizedStep === 'age') {
      defaultReason = 'Please enter a valid age between 5 and 110.';
    } else if (normalizedStep === 'gender') {
      defaultReason = 'Please select Male, Female, or Prefer not to say.';
    } else if (normalizedStep === 'phone') {
      defaultReason = 'Please enter a valid mobile number.';
    } else if (normalizedStep === 'goal') {
      defaultReason = 'Please describe your health goals.';
    } else if (normalizedStep === 'conditions') {
      defaultReason = 'Please mention any medical conditions, or specify "None".';
    } else if (normalizedStep === 'feeling') {
      defaultReason = 'Please enter a note about how you are feeling (2-500 characters).';
    }

    return NextResponse.json({
      valid: false,
      normalized: '',
      reason: defaultReason
    });
  } catch (error: any) {
    console.error('Validation route error:', error);
    return NextResponse.json({ valid: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
