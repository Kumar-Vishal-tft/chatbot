// ─── API Layer: Gemini LLM Calls ───────────────────────────────────────────

import { Message, OnboardingProfile, OnboardingStep } from './types';
import { GEMINI_API_KEY } from './config';
import { isGreetingOrFiller, hasProfanity, getContextualGreeting } from './utils';
import { activePersonaManager } from '@/persona/PersonaManager';
import { PersonaContextBuilder } from '@/persona/PersonaContextBuilder';
import { CAMPAIGN_CONFIG } from './campaign-config';

// Local in-memory cache to store predefined personas and avoid synchronous network request delays on every chat turn
const predefinedPersonaCache: Record<string, string> = {};

/**
 * Fetches the predefined campaign persona from the Next.js API proxy server.
 */
export async function fetchPredefinedPersona(utmCampaign: string): Promise<string | null> {
  if (predefinedPersonaCache[utmCampaign]) {
    return predefinedPersonaCache[utmCampaign];
  }
  try {
    const res = await fetch(`/api/predefined-persona?name=${encodeURIComponent(utmCampaign)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.system_prompt) {
        predefinedPersonaCache[utmCampaign] = data.system_prompt;
        return data.system_prompt;
      }
    }
  } catch (err) {
    console.warn(`Failed to retrieve predefined campaign persona for ${utmCampaign}:`, err);
  }
  return null;
}

// ── Gemini Chat Response ───────────────────────────────────────────────────

export async function fetchGeminiResponse(
  prompt: string,
  history: Message[],
  profile?: OnboardingProfile
): Promise<string> {
  // Check if we have an active patient persona loaded
  const hasPersona = !!activePersonaManager.getRawPersona();
  const clinicalContextBlock = hasPersona ? PersonaContextBuilder.buildContext(prompt, activePersonaManager) : "";

  // Resolve active campaign role focusing prompt
  const utmCampaign = typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') || 'metabolic_health' : 'metabolic_health';
  
  // Try to load the predefined campaign persona from backend API, fallback to offline prompt if unavailable
  let campaignFocusPrompt = "";
  const backendPersonaPrompt = await fetchPredefinedPersona(utmCampaign);
  
  if (backendPersonaPrompt) {
    campaignFocusPrompt = backendPersonaPrompt;
  } else {
    if (utmCampaign === 'diabetes_reversal') {
      campaignFocusPrompt = `CAMPAIGN ROLE & FOCUS (DIABETES REVERSAL):
Your primary focus is Diabetes Reversal and Management.
- Focus heavily on blood glucose monitoring, CGM charts, and daily blood sugar trends.
- Guide the user on low-carb nutrition, glycemic indices, insulin sensitivities, and diabetic-safe food choices.
- Explain HbA1c control mechanisms and metabolic improvements.
- Support clinical coordination by suggesting endocrinology consultations where appropriate.`;
    } else if (utmCampaign === 'bp_control') {
      campaignFocusPrompt = `CAMPAIGN ROLE & FOCUS (BP CONTROL & HEART HEALTH):
Your primary focus is Blood Pressure Control and Cardiovascular Health.
- Focus on blood pressure tracking, sodium control, potassium rich foods, and low-salt diet plans.
- Highlight lifestyle modifications: sleep hygiene, cardiovascular exercise, and stress management indices.
- Support clinical coordination by suggesting cardiology consultations where appropriate.`;
    } else if (utmCampaign === 'weight_loss') {
      campaignFocusPrompt = `CAMPAIGN ROLE & FOCUS (WEIGHT LOSS & NUTRITION):
Your primary focus is Sustainable Weight Loss and Muscle Retention.
- Focus on calorie deficits, metabolic assessments, BMI tracks, and body fat optimizations.
- Emphasize high protein recipes, macro balance, portion control, and daily activity plans.
- Motivate the user by setting realistic targets and discussing caloric logs.`;
    } else {
      campaignFocusPrompt = `CAMPAIGN ROLE & FOCUS (METABOLIC HEALTH):
Your primary focus is Metabolic Health and Preventive Wellness.
- Focus on metabolic scores, lifestyle assessments, daily activity tracking, and recovery parameters.
- Suggest metabolic recovery plans, nutrition optimizations, and health coach follow-ups.`;
    }
  }

  const systemInstruction = `You are YHealth AI, a warm and knowledgeable health companion.
Your tone is calm, supportive, friendly, and clear — like a trusted health-savvy friend, not a hospital system.

${campaignFocusPrompt}
You must always structure your health guidance beautifully using standard GitHub-style Markdown:
- Use organized lists, bold text, and headers to make information easy to scan.
- Use styled Markdown tables to show comparisons, symptoms, or structured data.
- Use strategic alerts: \`> [!NOTE]\`, \`> [!TIP]\`, \`> [!IMPORTANT]\`, or \`> [!WARNING]\` to highlight important points.
- When health metrics are mentioned (e.g. Blood Pressure, Temperature, Blood Glucose, BMI, Heart Rate), summarize them visually:
  [HealthCardsGrid: Blood Pressure=120/80=healthy | Blood Glucose=105 mg/dL=warning | Heart Rate=82 bpm=healthy]
- Be brief and direct. Keep responses to 2-3 focused sentences max. Never write long paragraphs or unnecessary intros. Get straight to the helpful answer.
- Keep each response fresh — vary your phrasing and structure naturally across conversations.
- End every response with exactly 3 helpful follow-up suggestions in this exact format on its own line:
  [FollowUps: Suggestion 1 | Suggestion 2 | Suggestion 3]
  * Make sure these suggestion chips are highly personalized, directly matching the user's current question/topic, and derived from their active clinical history/persona if present (e.g. referencing T1D management, customized diets, medication reviews, or face-scan metrics). Do not use generic placeholders.
- Pay close attention to the conversation history. Always remember the context, previous questions, and answers from the last 5 turns of conversation to provide seamless, context-aware continuity.
- Never use any emojis in your response. Keep the text clean.

${
  hasPersona
    ? `### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:
${clinicalContextBlock}

CRITICAL RULES FOR RESPONDING:
1. You MUST maintain standard Indian professional medical conversational decorum.
2. The user has history of Gestational Diabetes and potential primary hypothyroidism. Suggest consulting Samarth Gupta (Endocrinologist) when relevant.
3. Be supportive and acknowledge their efforts, emphasizing low-glycemic eating and stress reduction.`
    : `User profile:
${
  profile
    ? `- Name: ${profile.name || 'there'}
- Age: ${profile.age || 'not shared'}
- Gender: ${profile.gender || 'not shared'}
- Health Goal: ${profile.health_goal || 'general wellness'}
- Conditions: ${profile.conditions && profile.conditions.length > 0 ? profile.conditions.join(', ') : 'none mentioned'}`
    : 'No profile yet'
}`
}

Remember: Be warm, clear, and genuinely helpful. Always recommend seeing a doctor for diagnosis, but do so naturally — never in a defensive or robotic way. NEVER use any emojis in your output.`;

  const mappedHistory = history.map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  mappedHistory.push({ role: 'user', parts: [{ text: prompt }] });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: mappedHistory,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error details:', errorText);
      throw new Error(`Gemini request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) return replyText.trim();

    throw new Error('Empty response from Gemini API');
  } catch (error) {
    console.error('Gemini API Fetch failed:', error);
    return `Sorry, I ran into a connection issue and couldn't fetch a response right now.

Please check your internet connection and try again. In the meantime, for anything urgent, please consult a doctor directly.

[FollowUps: Try again | Check Symptoms | Analyze Report]`;
  }
}

// ── LLM-Powered Greeting Response ─────────────────────────────────────────
// All greeting replies go through Gemini — zero hardcoded strings.
// getContextualGreeting() is used ONLY as an offline fallback.

export async function fetchGreetingResponse(
  userInput: string,          // the actual text the user typed ("hi", "hello", etc.)
  isFirstTime: boolean,       // true = greetingShown was false
  userName?: string,          // name if already collected
  history: Message[] = [],    // previous messages for context
  hasPersona: boolean = false
): Promise<string> {
  const contextLines: string[] = [];

  if (isFirstTime) {
    contextLines.push("This is the user's very first interaction. Greet them warmly, briefly introduce YHealth as their health assistant, and ask what they should be called.");
  } else if (userName) {
    if (hasPersona) {
      contextLines.push(`The user is a registered clinical patient named ${userName} whose health data is synchronized. Greet them warmly and reference that their clinical files are safely loaded. Suggest highly specific action chips matching their clinical history.`);
    } else {
      contextLines.push(`The user's name is ${userName}. They have already been welcomed and are returning. Give a brief, friendly reply — do NOT re-introduce the platform.`);
    }
  } else {
    contextLines.push("The user is currently undergoing profile registration (onboarding) but sent another greeting. Give a brief, friendly, returning greeting. Do NOT ask for their name, age, or any other onboarding details in your response as the system handles that automatically.");
  }

  const systemInstruction = `You are YHealth AI — a warm, friendly personal health assistant.
The user just sent a greeting (like "hi", "hello", "hey"). Respond naturally.

Context:
${contextLines.join('\n')}

Strict rules:
1. Keep it SHORT: 2-4 lines max. No long paragraphs or lists.
2. Use a warm, casual, supportive tone. Zero corporate or medical jargon.
3. If first time: briefly say who you are, what you help with, and ask their name.
4. If returning with name: greet by name warmly and ask how you can help today.
5. If returning without name: give a warm, brief returning greeting. Do NOT ask for their name, age, or any profile information in your text.
6. NEVER re-introduce the platform on a return greeting.
7. Every response must end with exactly 3 quick action chips in this exact format on its own line:
   [FollowUps: Suggestion 1 | Suggestion 2 | Suggestion 3]
   - If an active clinical patient profile is loaded (hasPersona is true), these suggestions MUST be directly clinical and highly personalized to their actual conditions and risks:
     * For Type 1 Diabetes (Lisha Karar), suggest actions like: "Review glucose spikes", "Dairy/Egg free recipes", "Endocrinology help".
     * Make sure these suggestions feel helpful, professional, and clinical.
   - If no patient profile is loaded, use standard general action chips: "Check Symptoms", "Analyze Report", "Diet Guidance", "Medicine Help".
8. Make each return greeting feel slightly different — avoid robotic repetition.
9. WHENEVER you ask for the user's name (e.g., "what should I call you?", "what is your name?"), you MUST format the question in bold Markdown (e.g., **what should I call you?** or **what is your name?**).
10. NEVER use any emojis in your response. Keep the text clean.
11. Do NOT duplicate or ask any personal questions if this is a return greeting without name, as the state machine appends the question automatically.
12. Pay close attention to the conversation history. Always remember the context, previous questions, and answers from the last 5 turns of conversation to maintain smooth, context-aware continuity.`;

  // Build history context for Gemini (so it sees the conversation)
  const mappedHistory = history.map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
  // Append the actual greeting the user just typed
  mappedHistory.push({ role: 'user', parts: [{ text: userInput }] });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: mappedHistory,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) throw new Error(`Gemini greeting failed: ${response.statusText}`);

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) return replyText.trim();

    throw new Error('Empty greeting response from Gemini');
  } catch (error) {
    console.warn('Greeting LLM call failed, using local fallback:', error);
    // Offline fallback — static but still context-aware
    return getContextualGreeting(isFirstTime, userName).replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
  }
}

// ── Onboarding Field Validator (LLM-powered) ───────────────────────────────

export async function verifyUserData(
  step: Extract<OnboardingStep, 'asked_name' | 'asked_age'>,
  content: string
): Promise<{ isValid: boolean; parsedValue: string; isQuestionOrQuery?: boolean; errorMessage?: string }> {
  if (step === 'asked_name' && isGreetingOrFiller(content)) {
    return { isValid: false, parsedValue: '', isQuestionOrQuery: true, errorMessage: 'Input is a greeting or chatbot keyword' };
  }

  let systemInstruction = '';

  if (step === 'asked_name') {
    systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to see if they provided a valid first name or preferred name, or if they asked a health-related question/general medical inquiry instead of answering the name prompt.
Rules:
1. If the user asked a question (e.g. "how can you help me", "what are tension headache symptoms?"), is a command, is a conversational phrase, contains health terms, or is a general query, mark isValid: false and set "isQuestionOrQuery": true.
2. If they provided a real name (e.g. "Alex", "Sarah", "John Smith"), extract the clean name ("Alex", "Sarah"), set isValid: true, and set "isQuestionOrQuery": false.
3. Your output must be a clean JSON object in this exact format:
{
  "isValid": true or false,
  "parsedValue": "extracted clean capitalized name",
  "isQuestionOrQuery": true or false,
  "reason": "short explanation if invalid"
}
Do not include any other text or markdown formatting outside the JSON block.`;
  } else if (step === 'asked_age') {
    systemInstruction = `You are a strict clinical profile validator.
Analyze the user's input to see if they provided a valid age (a human age between 1 and 120), or if they asked a health-related question/general medical inquiry instead of answering the age prompt.
Rules:
1. If they specified a number or phrase containing an age (e.g. "I'm 28", "28 years old", "twenty eight"), extract it as a number string ("28"), set isValid: true, and set "isQuestionOrQuery": false.
2. If the user asked a question (e.g. "how can you help me", "what are tension headache symptoms?"), is a command, is conversational, or physical impossible age, mark isValid: false and set "isQuestionOrQuery": true.
3. Your output must be a clean JSON object in this exact format:
{
  "isValid": true or false,
  "parsedValue": "extracted age number string",
  "isQuestionOrQuery": true or false,
  "reason": "short explanation if invalid"
}
Do not include any other text or markdown formatting outside the JSON block.`;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: content }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', maxOutputTokens: 256 },
      }),
    });

    if (!response.ok) throw new Error('Validation request failed');

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (replyText) {
      const cleaned = replyText.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      const parsedVal = String(parsed.parsedValue || '').trim();
      const isSentence =
        parsedVal.split(/\s+/).length > 3 ||
        parsedVal.includes('?') ||
        /\b(how|what|who|why|where|when|can|you|please|help|greet|tell|symptom|treat|prevent|cure|medicine|clinical)\b/i.test(parsedVal);

      return {
        isValid: parsed.isValid === true && !isSentence && parsedVal.length >= 2,
        parsedValue: parsedVal,
        isQuestionOrQuery: parsed.isQuestionOrQuery === true || isSentence,
        errorMessage: String(parsed.reason || ''),
      };
    }

    throw new Error('No validation data returned');
  } catch (error) {
    console.error('LLM User validation failed, fallback to basic heuristics:', error);

    if (step === 'asked_name') {
      const trimmed = content.trim();
      const words = trimmed.split(/\s+/);
      const containsQuestionWord =
        /\b(how|what|who|why|where|when|can|you|please|help|greet|tell|symptom|treat|prevent|cure|medicine|clinical)\b/i.test(trimmed);
      const isSentence = words.length > 3 || containsQuestionWord || trimmed.includes('?');
      const isBad = trimmed.length < 2 || trimmed.length > 30 || /\d/.test(trimmed) || hasProfanity(trimmed) || isSentence;
      const capitalized = trimmed.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { isValid: !isBad, parsedValue: capitalized, isQuestionOrQuery: isSentence };
    } else {
      const trimmed = content.trim();
      const containsQuestionWord =
        /\b(how|what|who|why|where|when|can|you|please|help|greet|tell|symptom|treat|prevent|cure|medicine|clinical)\b/i.test(trimmed);
      const isSentence = containsQuestionWord || trimmed.includes('?');
      const num = parseInt(content.match(/\d+/)?.[0] || '', 10);
      const isGood = !isNaN(num) && num > 0 && num < 120 && !isSentence;
      return { isValid: isGood, parsedValue: isGood ? num.toString() : '', isQuestionOrQuery: isSentence };
    }
  }
}
