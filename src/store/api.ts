// ─── API Layer: Gemini LLM Calls ───────────────────────────────────────────

import { Message, OnboardingProfile, OnboardingStep } from './types';
import { GEMINI_API_KEY } from './config';
import { isGreetingOrFiller, hasProfanity, getContextualGreeting } from './utils';
import { activePersonaManager } from '@/persona/PersonaManager';
import { PersonaContextBuilder } from '@/persona/PersonaContextBuilder';
import { CAMPAIGN_CONFIG } from './campaign-config';

// Local in-memory cache to store predefined personas and avoid synchronous network request delays on every chat turn
const predefinedPersonaCache: Record<string, string> = {};

// In-memory cache registry to store active Gemini context cache names
const geminiCacheRegistry: Record<string, { cacheName: string; expiresAt: number; contextHash: string }> = {};

function getSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Creates or retrieves an existing Gemini Context Cache for a given system instruction.
 * Returns the full resource name (cacheName) if successful, or null if caching failed/was skipped.
 */
export async function getOrCreateGeminiCache(systemInstruction: string, model: string = 'models/gemini-2.5-flash'): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    return null;
  }

  // Enforcement check: Do not explicitly cache if instruction length is too small.
  // Gemini 2.5 Flash has a minimum threshold of 2,048 tokens.
  // 8,500 characters is a safe approximation to guarantee we exceed 2,048 tokens.
  if (systemInstruction.length < 8500) {
    return null;
  }

  const hash = getSimpleHash(systemInstruction);

  // Check if cache already exists in our local registry and is still active
  const existing = geminiCacheRegistry[hash];
  if (existing && existing.expiresAt > Date.now()) {
    console.log('Reusing active Gemini context cache:', existing.cacheName);
    return existing.cacheName;
  }

  try {
    console.log('Creating new Gemini context cache resource...');
    const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        displayName: 'yhealth-clinical-session',
        ttl: '3600s', // 1 hour TTL
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Initialize clinical assistant context.' }]
          },
          {
            role: 'model',
            parts: [{ text: 'Clinical context loaded successfully.' }]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Failed to create Gemini context cache:', response.status, errText);
      return null;
    }

    const data = await response.json();
    if (data && data.name) {
      console.log('Gemini context cache created successfully:', data.name);

      // Store in local memory registry. Set expiration to 1 hour (minus 15 seconds buffer)
      geminiCacheRegistry[hash] = {
        cacheName: data.name,
        expiresAt: Date.now() + 3600 * 1000 - 15000,
        contextHash: hash
      };

      return data.name;
    }
  } catch (err) {
    console.warn('Error during Gemini context cache creation:', err);
  }

  return null;
}

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

export function getOfflineCampaignFocusPrompt(utmCampaign: string): string {
  if (utmCampaign === 'diabetes_reversal') {
    return `CAMPAIGN ROLE & FOCUS (DIABETES REVERSAL):
Your primary focus is Diabetes Reversal and Management.
- Focus heavily on blood glucose monitoring, CGM charts, and daily blood sugar trends.
- Guide the user on low-carb nutrition, glycemic indices, insulin sensitivities, and diabetic-safe food choices.
- Explain HbA1c control mechanisms and metabolic improvements.
- Support clinical coordination by suggesting endocrinology consultations where appropriate.`;
  } else if (utmCampaign === 'bp_control') {
    return `CAMPAIGN ROLE & FOCUS (BP CONTROL & HEART HEALTH):
Your primary focus is Blood Pressure Control and Cardiovascular Health.
- Focus on blood pressure tracking, sodium control, potassium rich foods, and low-salt diet plans.
- Highlight lifestyle modifications: sleep hygiene, cardiovascular exercise, and stress management indices.
- Support clinical coordination by suggesting cardiology consultations where appropriate.`;
  } else if (utmCampaign === 'weight_loss') {
    return `CAMPAIGN ROLE & FOCUS (WEIGHT LOSS & NUTRITION):
Your primary focus is Sustainable Weight Loss and Muscle Retention.
- Focus on calorie deficits, metabolic assessments, BMI tracks, and body fat optimizations.
- Emphasize high protein recipes, macro balance, portion control, and daily activity plans.
- Motivate the user by setting realistic targets and discussing caloric logs.`;
  } else {
    return `CAMPAIGN ROLE & FOCUS (METABOLIC HEALTH):
Your primary focus is Metabolic Health and Preventive Wellness.
- Focus on metabolic scores, lifestyle assessments, daily activity tracking, and recovery parameters.
- Suggest metabolic recovery plans, nutrition optimizations, and health coach follow-ups.`;
  }
}

// ── Gemini Chat Response ───────────────────────────────────────────────────

export async function fetchGeminiResponse(
  prompt: string,
  history: Message[],
  profile?: OnboardingProfile,
  isExistingPatient: boolean = false,
  sessionId?: string
): Promise<string> {
  // Check if we have an active patient persona loaded AND the user is an existing patient
  const hasPersona = !!activePersonaManager.getRawPersona() && isExistingPatient;
  const clinicalContextBlock = hasPersona ? PersonaContextBuilder.buildContext(prompt, activePersonaManager) : "";

  // Resolve dynamic active patient profile values
  const rawPersona = hasPersona ? activePersonaManager.getRawPersona() : null;
  const doctorName = rawPersona?.care_team?.assigned_doctor?.name
    ? `Dr. ${rawPersona.care_team.assigned_doctor.name.replace(/^(dr\.\s*)/i, '')}`
    : 'their assigned doctor';
  const doctorSpecialization = rawPersona?.care_team?.assigned_doctor?.specialization || 'Clinical Lead';
  const diagnosesList = rawPersona?.clinical_context?.diagnoses && rawPersona.clinical_context.diagnoses.length > 0
    ? rawPersona.clinical_context.diagnoses.map((d: any) => `${d.diagnosis} (${d.status})`).join(', ')
    : 'relevant health conditions';

  // Resolve active campaign role focusing prompt
  const utmCampaign = typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') || 'default' : 'default';

  // Try to load the predefined campaign persona from backend API, fallback to offline prompt if unavailable
  let campaignFocusPrompt = "";
  if (!hasPersona) {
    const backendPersonaPrompt = await fetchPredefinedPersona(utmCampaign);
    if (backendPersonaPrompt) {
      campaignFocusPrompt = backendPersonaPrompt;
    } else {
      campaignFocusPrompt = getOfflineCampaignFocusPrompt(utmCampaign);
    }
  }

  const isInOnboarding = profile && (!profile.name || !profile.age || !profile.gender || !profile.phone_number || !profile.health_goal || !profile.conditions || !profile.feeling_note);
  const questionOverride = isInOnboarding
    ? `\n\nCRITICAL INSTRUCTION: The user is currently in the onboarding flow and has sent a general query/question: "${prompt}". You MUST directly, clearly, and concisely answer their query/question in 2-3 sentences. Do NOT output any standard welcome greeting, introduction, or campaign starting script (like "Hello! I am Dr. Dia..."). Focus entirely on answering their query.`
    : ``;

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

${hasPersona
      ? `### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:
${clinicalContextBlock}

CRITICAL RULES FOR RESPONDING:
1. You MUST maintain standard Indian professional medical conversational decorum.
2. The user has history of ${diagnosesList}. Suggest consulting ${doctorName} (${doctorSpecialization}) when relevant.
3. Be supportive and acknowledge their efforts, emphasizing low-glycemic eating, physical activity, and stress reduction as suitable to their history.
4. If the user's query is asking for extended patient details, previous/historical records, past logs, or older medical reports that are NOT present in the active patient clinical history & context block above, you MUST output exactly \`[FALLBACK_TO_MONGO]\` as your entire response. Do NOT output anything else. If the query can be answered using the basic patient summary and current details already provided in the context block above, or if it is a general health question, answer it directly.`
      : `User profile:
${profile
        ? `- Name: ${profile.name || 'there'}
- Age: ${profile.age || 'not shared'}
- Gender: ${profile.gender || 'not shared'}
- Health Goal: ${profile.health_goal || 'general wellness'}
- Conditions: ${profile.conditions && profile.conditions.length > 0 ? profile.conditions.join(', ') : 'none mentioned'}`
        : 'No profile yet'
      }`
    }

Remember: Be warm, clear, and genuinely helpful. Always recommend seeing a doctor for diagnosis, but do so naturally — never in a defensive or robotic way. NEVER use any emojis in your output.${questionOverride}`;

  const mappedHistory = history.map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  mappedHistory.push({ role: 'user', parts: [{ text: prompt }] });

  // Attempt to load or create a Gemini context cache for the system instructions
  const cacheName = await getOrCreateGeminiCache(systemInstruction, 'models/gemini-2.5-flash');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody: any = {
      contents: mappedHistory,
      generationConfig: { temperature: 0.85, maxOutputTokens: 1024 },
    };

    if (cacheName) {
      requestBody.cachedContent = cacheName;
    } else {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error details:', errorText);
      throw new Error(`Gemini request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      let trimmed = replyText.trim();

      if (trimmed.includes('[FALLBACK_TO_MONGO]') && hasPersona) {
        const rawPersona = activePersonaManager.getRawPersona();
        const userId = rawPersona?._meta?.mongo_patient_id || rawPersona?.identity?.patient_id;

        if (userId) {
          console.log(`LLM requested fallback. Querying MongoDB for user ${userId} and query: "${prompt}"`);
          try {
            const agentRes = await fetch('/api/agent/query', {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: userId,
                query: prompt,
              }),
            });

            if (agentRes.ok) {
              const agentData = await agentRes.json();
              console.log('Successfully retrieved MongoDB details:', agentData);

              if (agentData && (agentData.answer || agentData.analytics)) {
                const fallbackContext = `
[DATABASE RETRIEVAL SUCCESSFUL]
The following details were retrieved from the MongoDB patient record:
- Summarized DB Answer: ${agentData.answer || 'No direct summary'}
- Raw Patient DB Details (Analytics/Collections): ${JSON.stringify(agentData.analytics || {})}

Please formulate a warm, helpful, clear, and beautifully structured clinical response to the user's query: "${prompt}".
Use standard Markdown formatting (lists, bolding, headers, tables, strategic alerts like > [!NOTE], no emojis, etc.) and end with exactly 3 personalized [FollowUps: ...] chips. Do not mention that this data came from a database query/fallback unless necessary, just present it naturally as the clinical status of the patient.
`;

                const finalInstruction = systemInstruction.replace(
                  '### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:',
                  `### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:\n${fallbackContext}`
                );

                const finalRequestBody = {
                  contents: [
                    ...mappedHistory.slice(0, -1),
                    { role: 'user', parts: [{ text: prompt }] },
                    { role: 'model', parts: [{ text: '[Requesting clinical data fallback...]' }] },
                    { role: 'user', parts: [{ text: `Here is the clinical data: ${JSON.stringify(agentData)}` }] }
                  ],
                  generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
                  systemInstruction: { parts: [{ text: finalInstruction }] }
                };

                const finalResponse = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(finalRequestBody),
                });

                if (finalResponse.ok) {
                  const finalData = await finalResponse.json();
                  const finalReplyText = finalData?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (finalReplyText) {
                    trimmed = finalReplyText.trim();
                    console.log('Formatted fallback response generated successfully:', trimmed);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('Fallback MongoDB query or secondary Gemini format failed, using retry:', err);
          }
        }

        // If secondary generation or agent call failed and trimmed is still fallback token, retry with fallback rule stripped
        if (trimmed.includes('[FALLBACK_TO_MONGO]')) {
          const fallbackInstruction = systemInstruction.replace(
            /4\.\s*If the user's query is asking for[\s\S]*?answer it directly\./i,
            ''
          );
          try {
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: mappedHistory,
                generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
                systemInstruction: { parts: [{ text: fallbackInstruction }] }
              }),
            });
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const retryReply = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (retryReply) {
                trimmed = retryReply.trim();
              }
            }
          } catch (err) {
            console.warn('Direct fallback retry failed:', err);
          }
        }
      }

      // Asynchronously trigger Langfuse tracing (non-blocking)
      const activeChatId = sessionId;

      fetch('/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'chat-response',
          input: prompt,
          output: trimmed,
          model: 'gemini-2.5-flash',
          userId: profile?.name || 'anonymous',
          sessionId: activeChatId || undefined,
          usageMetadata: data.usageMetadata
        })
      }).catch(err => console.warn('Langfuse tracing proxy failed:', err));

      return trimmed;
    }

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

  // Attempt to load or create a Gemini context cache for the system instructions
  const cacheName = await getOrCreateGeminiCache(systemInstruction, 'models/gemini-2.5-flash');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody: any = {
      contents: mappedHistory,
      generationConfig: { temperature: 0.9, maxOutputTokens: 1024 },
    };

    if (cacheName) {
      requestBody.cachedContent = cacheName;
    } else {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`Gemini greeting failed: ${response.statusText}`);

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (replyText) {
      const trimmed = replyText.trim();

      // Asynchronously trigger Langfuse tracing (non-blocking)
      let activeChatId = undefined;
      try {
        const { useChatStore } = require('./chatStore');
        activeChatId = useChatStore.getState().activeChatId;
      } catch (e) { }

      fetch('/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'greeting-response',
          input: userInput,
          output: trimmed,
          model: 'gemini-2.5-flash',
          userId: userName || 'anonymous',
          sessionId: activeChatId || undefined,
          usageMetadata: data.usageMetadata
        })
      }).catch(err => console.warn('Langfuse tracing proxy failed:', err));

      return trimmed;
    }

    throw new Error('Empty greeting response from Gemini');
  } catch (error) {
    console.warn('Greeting LLM call failed, using local fallback:', error);
    // Offline fallback — static but still context-aware
    return getContextualGreeting(isFirstTime, userName).replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
  }
}

// ── Onboarding Field Validator (LLM-powered) ───────────────────────────────

export async function verifyUserData(
  step: OnboardingStep,
  content: string
): Promise<{ isValid: boolean; parsedValue: string; isQuestionOrQuery?: boolean; errorMessage?: string }> {
  if (step === 'asked_name') {
    const trimmedLower = content.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    const pureGreetings = [
      'hi', 'hello', 'hey', 'yo', 'sup', 'ola', 'namaste', 'hola', 'hallo',
      'good morning', 'good afternoon', 'good evening', 'good day', 'welcome',
      'hi there', 'hello there', 'hey there', 'hi yhealth', 'hello yhealth', 'hi assistant', 'hello assistant'
    ];
    if (pureGreetings.includes(trimmedLower)) {
      return { isValid: false, parsedValue: '', isQuestionOrQuery: true, errorMessage: 'Input is a greeting or chatbot keyword' };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, value: content }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Validation response status: ${response.status}`);
    }

    const data = await response.json();
    return {
      isValid: data.valid === true,
      parsedValue: data.normalized || '',
      isQuestionOrQuery: data.reason === 'health_question',
      errorMessage: data.reason && data.reason !== 'health_question' ? data.reason : undefined
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn('LLM User validation failed or timed out, fallback to basic heuristics:', error);

    const trimmed = content.trim();
    const normalizedStep = step.toLowerCase().replace('asked_', '');

    const containsQuestionWord = /\b(how|what|who|why|where|when|can|you|please|help|greet|tell|symptom|treat|prevent|cure|medicine|clinical)\b/i.test(trimmed);
    const isSentence = containsQuestionWord || trimmed.includes('?');

    if (normalizedStep === 'name') {
      const words = trimmed.split(/\s+/);
      const hasLetters = /[a-zA-Z]/.test(trimmed);
      const isBad = trimmed.length < 2 || trimmed.length > 30 || /\d/.test(trimmed) || hasProfanity(trimmed) || (words.length > 3 || isSentence) || !hasLetters;
      const capitalized = trimmed.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { isValid: !isBad, parsedValue: capitalized, isQuestionOrQuery: isSentence };
    }

    if (normalizedStep === 'age') {
      const isDecimal = /\./.test(trimmed) || /\b(half|point)\b/i.test(trimmed);
      const num = parseInt(trimmed.match(/\d+/)?.[0] || '', 10);
      const isGood = !isNaN(num) && num >= 5 && num <= 110 && !isSentence && !isDecimal;
      return { isValid: isGood, parsedValue: isGood ? num.toString() : '', isQuestionOrQuery: isSentence };
    }

    if (normalizedStep === 'gender') {
      const lower = trimmed.toLowerCase();
      let parsed = '';
      if (lower === 'male' || lower === 'm') parsed = 'Male';
      else if (lower === 'female' || lower === 'f') parsed = 'Female';
      else if (lower.includes('not to say') || lower.includes('prefer') || lower === 'skip') parsed = 'Prefer not to say';

      return {
        isValid: parsed !== '',
        parsedValue: parsed,
        isQuestionOrQuery: isSentence
      };
    }

    if (normalizedStep === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      const startsWithPlus = trimmed.startsWith('+');
      let isPhoneValid = false;

      if (digits.length === 10) {
        isPhoneValid = /^[6-9]\d{9}$/.test(digits);
      } else if (digits.length === 11) {
        isPhoneValid = /^0[6-9]\d{9}$/.test(digits);
      } else if (digits.length === 12) {
        isPhoneValid = /^91[6-9]\d{9}$/.test(digits);
      } else if (startsWithPlus) {
        isPhoneValid = digits.length >= 10 && digits.length <= 15;
      }

      return {
        isValid: isPhoneValid && !isSentence,
        parsedValue: isPhoneValid ? trimmed : '',
        isQuestionOrQuery: isSentence
      };
    }

    if (normalizedStep === 'goal') {
      const VALID_GOALS = [
        'Weight loss', 'Diabetes', 'Blood reports', 'Nutrition', 'Fitness', 'General wellness',
        'Hypertension', 'GLP-1', 'Metabolic', 'Sexual Wellness', 'Mental Wellness', 'Longevity'
      ];
      const lower = trimmed.toLowerCase();
      const matched = VALID_GOALS.filter(g => lower.includes(g.toLowerCase()));

      if (matched.length === 0) {
        if (lower.includes('diet') || lower.includes('food')) matched.push('Nutrition');
        if (lower.includes('fat') || lower.includes('lose')) matched.push('Weight loss');
        if (lower.includes('sugar')) matched.push('Diabetes');
        if (lower.includes('exercise') || lower.includes('gym') || lower.includes('workout')) matched.push('Fitness');
        if (lower.includes('bp') || lower.includes('pressure')) matched.push('Hypertension');
      }

      return {
        isValid: matched.length > 0 && !isSentence,
        parsedValue: matched.join(', '),
        isQuestionOrQuery: isSentence
      };
    }

    if (normalizedStep === 'conditions') {
      const VALID_CONDITIONS = ['None', 'Diabetes', 'Hypertension', 'Asthma', 'Obesity', 'Metabolic health'];
      const lower = trimmed.toLowerCase();

      if (/\b(none|no|nothing|na|n\/a|nil)\b/i.test(lower)) {
        return { isValid: true, parsedValue: 'None', isQuestionOrQuery: isSentence };
      }

      const matched = VALID_CONDITIONS.filter(c => lower.includes(c.toLowerCase()) && c !== 'None');
      if (matched.length === 0) {
        if (lower.includes('sugar')) matched.push('Diabetes');
        if (lower.includes('bp') || lower.includes('pressure')) matched.push('Hypertension');
        if (lower.includes('overweight') || lower.includes('obese')) matched.push('Obesity');
      }

      return {
        isValid: matched.length > 0 && !isSentence,
        parsedValue: matched.join(', '),
        isQuestionOrQuery: isSentence
      };
    }

    if (normalizedStep === 'feeling') {
      const hasHtml = /<[^>]*>/g.test(trimmed);
      const isGibberish = /(.)\1{5,}/.test(trimmed);
      const isGood = trimmed.length >= 2 && trimmed.length <= 500 && !hasHtml && !isGibberish;

      return {
        isValid: isGood && !isSentence,
        parsedValue: isGood ? trimmed : '',
        isQuestionOrQuery: isSentence
      };
    }

    return { isValid: false, parsedValue: '', isQuestionOrQuery: isSentence };
  }
}

export async function extractOnboardingEntities(
  content: string,
  currentStep?: string
): Promise<{
  name?: string;
  age?: string;
  gender?: string;
  phone_number?: string;
  health_goal?: string;
  conditions?: string[];
  feeling_note?: string;
  errors?: Record<string, string>;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let res: any = {};
  let errors: Record<string, string> = {};

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.extracted) {
        const ext = data.extracted;

        if (ext.name?.valid && ext.name.value) res.name = ext.name.value;
        else if (ext.name?.reason) errors.name = ext.name.reason;

        if (ext.age?.valid && ext.age.value) res.age = ext.age.value;
        else if (ext.age?.reason) errors.age = ext.age.reason;

        if (ext.gender?.valid && ext.gender.value) res.gender = ext.gender.value;
        else if (ext.gender?.reason) errors.gender = ext.gender.reason;

        if (ext.phone_number?.valid && ext.phone_number.value) res.phone_number = ext.phone_number.value;
        else if (ext.phone_number?.reason) errors.phone_number = ext.phone_number.reason;

        if (ext.health_goal?.valid && ext.health_goal.value) res.health_goal = ext.health_goal.value;
        else if (ext.health_goal?.reason) errors.health_goal = ext.health_goal.reason;

        if (ext.conditions?.valid && ext.conditions.value) res.conditions = ext.conditions.value;
        else if (ext.conditions?.reason) errors.conditions = ext.conditions.reason;

        if (ext.feeling_note?.valid && ext.feeling_note.value) res.feeling_note = ext.feeling_note.value;
        else if (ext.feeling_note?.reason) errors.feeling_note = ext.feeling_note.reason;
      }
    }
  } catch (err) {
    console.warn('Extraction API failed, using client fallback', err);
  } finally {
    clearTimeout(timeoutId);
  }

  // If API succeeded but didn't extract values for the current active step (e.g. because of single-word answer like "None" or "Good"),
  // run the context-aware fallback logic to retrieve the entity.
  const lower = content.toLowerCase().trim();

  // 1. Context-aware/Fallback: Name
  if (!res.name && (!currentStep || currentStep === 'asked_name')) {
    const nameMatch = content.match(/\b(?:i am|i'm|name is|call me|myself)\s+([A-Za-z]{2,15})\b/i);
    if (nameMatch && nameMatch[1]) {
      const nameVal = nameMatch[1].trim();
      if (!/^(male|female|guy|man|girl|woman|skip|none|diabetes|hypertension)$/i.test(nameVal)) {
        res.name = nameVal.charAt(0).toUpperCase() + nameVal.slice(1).toLowerCase();
      }
    } else {
      const containsQuestionOrVerb = /\b(how|what|who|why|where|when|which|can|could|should|would|is|are|do|does|help|symptom|tell|explain|treat|prevent|cure|medicine|clinical)\b/i.test(lower);
      const isSentence = containsQuestionOrVerb || content.includes('?') || content.trim().split(/\s+/).length > 2;

      if (!isSentence) {
        const firstWord = content.trim().split(/[\s,]+/)[0];
        const isWordGreeting = isGreetingOrFiller(firstWord);
        const hasLetters = /^[A-Za-z]{2,15}$/.test(firstWord);
        const isCommonKeyword = /^(male|female|skip|none|diabetes|hypertension|my|i|im|am|what|how|why|when|where|who|which|help)$/i.test(firstWord);
        if (hasLetters && !isWordGreeting && !isCommonKeyword) {
          res.name = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
        }
      }
    }
  }

  // 2. Context-aware/Fallback: Age
  if (!res.age && (!currentStep || currentStep === 'asked_age')) {
    const ageMatches = content.match(/\b\d{1,3}\b/g);
    if (ageMatches && !lower.includes('.') && !lower.includes('point') && !lower.includes('half')) {
      for (const match of ageMatches) {
        const ageVal = parseInt(match, 10);
        if (ageVal >= 5 && ageVal <= 110) {
          res.age = ageVal.toString();
          break;
        }
      }
    }
  }

  // 3. Context-aware/Fallback: Gender
  if (!res.gender && (!currentStep || currentStep === 'asked_gender')) {
    if (/\b(male|boy|man|guy)\b/.test(lower)) res.gender = 'Male';
    else if (/\b(female|girl|woman|lady)\b/.test(lower)) res.gender = 'Female';
    else if (/\b(prefer not|rather not|skip|none)\b/.test(lower)) res.gender = 'Prefer not to say';
  }

  // 4. Context-aware/Fallback: Phone Number
  if (!res.phone_number && (!currentStep || currentStep === 'asked_phone')) {
    const phoneMatch = content.replace(/[-\s]/g, '').match(/\+?\d{10,15}/);
    if (phoneMatch) {
      const p = phoneMatch[0];
      if (p.startsWith('+') || (p.length === 10 && /^[6-9]/.test(p))) {
        res.phone_number = p;
      }
    }
  }

  // 5. Context-aware/Fallback: Health Goal
  if (!res.health_goal && (!currentStep || currentStep === 'asked_goal')) {
    const goalsList = [
      'Weight loss', 'Diabetes', 'Blood reports', 'Nutrition', 'Fitness', 
      'General wellness', 'Hypertension', 'GLP-1', 'Metabolic', 
      'Sexual Wellness', 'Mental Wellness', 'Longevity'
    ];
    for (const goal of goalsList) {
      if (lower.includes(goal.toLowerCase())) {
        res.health_goal = goal;
        break;
      }
    }
  }

  // 6. Context-aware/Fallback: Conditions
  if ((!res.conditions || res.conditions.length === 0) && (!currentStep || currentStep === 'asked_conditions')) {
    const conditionsList = [
      'Diabetes', 'Hypertension', 'Asthma', 'Obesity', 'Metabolic health'
    ];
    const matched: string[] = [];
    for (const cond of conditionsList) {
      if (lower.includes(cond.toLowerCase())) {
        matched.push(cond);
      }
    }
    if (matched.length > 0) {
      res.conditions = matched;
    } else if (
      lower === 'none' || lower === 'no' || lower === 'nothing' || 
      lower === 'nil' || lower === 'n/a' || lower.includes('no conditions') || 
      lower.includes('dont have') || lower.includes("don't have")
    ) {
      res.conditions = ['None'];
    }
  }

  // 7. Context-aware/Fallback: Feeling Note
  if (!res.feeling_note && (!currentStep || currentStep === 'asked_feeling')) {
    const isWordGreeting = isGreetingOrFiller(content);
    if (!isWordGreeting && content.trim().length > 0) {
      res.feeling_note = content.trim();
    }
  }

  if (Object.keys(errors).length > 0) res.errors = errors;
  return res;
}
