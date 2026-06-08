// ─── Zustand Store ──────────────────────────────────────────────────────────
// This file contains ONLY state management logic.
// Business logic is split across:
//   types.ts     → interfaces & types
//   config.ts    → env vars (API key, backend URL)
//   constants.ts → static responses & demo data
//   utils.ts     → pure helper functions
//   api.ts       → Gemini API calls & validators

import { create } from 'zustand';
import { ChatState, ChatSession, Message, LastBotMessageType } from './types';
import { saveChatState, syncSessionWithRedis, syncConversationWithBackend, triggerDebouncedSync, isLikelyGibberish, isGreetingOrFiller, generateUUID } from './utils';

import { fetchGeminiResponse, fetchGreetingResponse, verifyUserData } from './api';
import { RESTORED_SESSIONS, RESTORED_MESSAGES } from './constants';
import { activePersonaManager } from '@/persona/PersonaManager';
import { CAMPAIGN_CONFIG } from './campaign-config';
import { captureAnalyticsEvent } from '@/utils/analytics';

// Re-exports used by components
export { getTimeBasedGreeting, isLikelyGibberish } from './utils';
export type { Message, ChatSession, OnboardingProfile, OnboardingStep } from './types';

export const useChatStore = create<ChatState>((set, get) => ({
  theme: 'light',
  sidebarExpanded: true,
  activeChatId: null,
  chatSessions: [],
  messages: {},
  isTyping: false,
  streamingMessageId: null,
  activeIntervalId: null,
  searchQuery: '',

  // ── Onboarding Initial States ─────────────────────────────────────────────
  onboardingProfile: {},
  onboardingStep: 'not_started',
  isExistingPatient: false,
  isVerified: false,
  isRestoring: false,
  userName: '',
  sessionId: null,
  utm_campaign: null,
  utm_source: null,
  utm_medium: null,
  isProgramActivated: false,

  // ── Conversation State ────────────────────────────────────────────────────
  greetingShown: false,
  lastBotMessageType: 'none',

  // ── Theme ─────────────────────────────────────────────────────────────────
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      }
      captureAnalyticsEvent('theme_toggled', { theme: nextTheme });
      return { theme: nextTheme };
    }),

  // ── Sidebar ───────────────────────────────────────────────────────────────
  toggleSidebar: () =>
    set((state) => {
      const nextVal = !state.sidebarExpanded;
      captureAnalyticsEvent('sidebar_toggled', { expanded: nextVal });
      return { sidebarExpanded: nextVal };
    }),
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  // ── Onboarding Setters ────────────────────────────────────────────────────
  setOnboardingProfile: (onboardingProfile) => set({ onboardingProfile }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  setIsExistingPatient: (isExistingPatient) => set({ isExistingPatient }),
  setIsVerified: (isVerified) => set({ isVerified }),
  setUserName: (userName) => set({ userName }),

  // ── Search ────────────────────────────────────────────────────────────────
  setSearchQuery: (query) => set({ searchQuery: query }),

  // ── Chat Management ───────────────────────────────────────────────────────
  setActiveChatId: (id) => {
    set({ activeChatId: id });
    saveChatState(get().chatSessions, get().messages, id);
    syncSessionWithRedis(get().chatSessions, get().messages, id);
  },

  createNewChat: (initialMessage) => {
    const id = generateUUID();
    const time = new Date();

    const newSession: ChatSession = {
      id,
      title: initialMessage
        ? initialMessage.length > 25
          ? initialMessage.substring(0, 25) + '...'
          : initialMessage
        : 'New Chat',
      timestamp: time.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };

    captureAnalyticsEvent('chat_created', { initial_message_present: !!initialMessage });

    set((state) => {
      const nextSessions = [newSession, ...state.chatSessions];
      const nextMessages = { ...state.messages, [id]: [] };
      saveChatState(nextSessions, nextMessages, id);
      syncSessionWithRedis(nextSessions, nextMessages, id);
      return { chatSessions: nextSessions, activeChatId: id, messages: nextMessages };
    });

    if (initialMessage) get().sendMessage(initialMessage);
    return id;
  },

  deleteChat: (id) =>
    set((state) => {
      const filteredSessions = state.chatSessions.filter((s) => s.id !== id);
      const updatedMessages = { ...state.messages };
      delete updatedMessages[id];
      const nextActiveId =
        state.activeChatId === id
          ? filteredSessions.length > 0
            ? filteredSessions[0].id
            : null
          : state.activeChatId;
      saveChatState(filteredSessions, updatedMessages, nextActiveId);
      syncSessionWithRedis(filteredSessions, updatedMessages, nextActiveId);
      return { chatSessions: filteredSessions, messages: updatedMessages, activeChatId: nextActiveId };
    }),


  clearAllChats: () => {
    if (typeof window !== 'undefined') {
      ['yhealth_chat_sessions', 'yhealth_chat_messages', 'yhealth_active_chat_id', 'yhealth_lead_v1', 'yhealth_existing_v1']
        .forEach((key) => localStorage.removeItem(key));
    }
    set({
      chatSessions: [],
      messages: {},
      activeChatId: null,
      streamingMessageId: null,
      isTyping: false,
      onboardingStep: 'not_started',
      onboardingProfile: {},
      isVerified: false,
      isExistingPatient: false,
      userName: '',
      sessionId: null,
      greetingShown: false,
      lastBotMessageType: 'none',
    });
  },

  // ── Send Message ──────────────────────────────────────────────────────────
  sendMessage: (content) => {
    if (get().isTyping) return;
    const {
      activeChatId,
      onboardingStep,
      onboardingProfile,
      isVerified,
      greetingShown,
      lastBotMessageType,
      userName,
    } = get();
    let chatId = activeChatId;

    if (!chatId) {
      chatId = get().createNewChat(content);
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      sender: 'user',
      content,
      timestamp,
    };

    // Track message sent
    const campaignKey = get().utm_campaign || 'default';
    const config = CAMPAIGN_CONFIG[campaignKey] || CAMPAIGN_CONFIG.default;
    const currentPersona = get().persona?.identity?.first_name 
      ? `${get().persona.identity.first_name} ${get().persona.identity.last_name || ''}`.trim()
      : (config.persona || 'general_agent');

    captureAnalyticsEvent('message_sent', {
      length: content.length,
      persona: currentPersona,
    });

    // Update chat title from first user message
    const currentMessages = get().messages[chatId] || [];
    if (currentMessages.length === 0) {
      captureAnalyticsEvent('chat_started');
      set((state) => ({
        chatSessions: state.chatSessions.map((s) =>
          s.id === chatId
            ? { ...s, title: content.length > 25 ? content.substring(0, 25) + '...' : content }
            : s
        ),
      }));
    }

    set((state) => {
      const nextMessages = { ...state.messages, [chatId!]: [...(state.messages[chatId!] || []), userMessage] };
      saveChatState(state.chatSessions, nextMessages, chatId);
      triggerDebouncedSync(state.chatSessions, nextMessages, chatId);
      return { messages: nextMessages, isTyping: true };
    });


    const timer = setTimeout(async () => {
      if (!chatId) return;

      let matchedResponse = '';
      let nextBotMessageType: LastBotMessageType = 'health_reply';
      let nextStep = onboardingStep;
      let nextProfile = { ...onboardingProfile };

      const isGreeting = isGreetingOrFiller(content);
      const isHealthQuery = !isGreeting && !isLikelyGibberish(content);

      // ── 1. Gibberish guard ───────────────────────────────────────────────
      if (isLikelyGibberish(content)) {
        matchedResponse = `Hmm, that didn't look like a question I can understand.

Could you rephrase that? Try something like:
*   *"I have a headache — what should I do?"*
*   *"Suggest a healthy meal plan"*
*   *"Analyze my blood report"*

[FollowUps: Check Symptoms | Meal plan ideas | Analyze a report]`;
        nextBotMessageType = 'error';
      }

      // ── 2. First-time name detection & onboarding initiation ──
      else if (!isVerified && onboardingStep === 'not_started' && (
        /\b(my name|name is|i am|i'm|call me|introducing|myself|this is)\b/i.test(content) ||
        (content.trim().split(/\s+/).length <= 2 && 
         !isGreeting && 
         !/\b(headache|fever|pain|blood|sugar|cough|cold|pressure|heart|weight|diet|food|symptom|help|what|how|why|can|glucose|hba1c|report|check|test|run|do|make|show)\b/i.test(content))
      )) {
        const nameVerification = await verifyUserData('asked_name', content);
        if (nameVerification.isValid) {
          nextProfile.name = nameVerification.parsedValue;
          set({ userName: nameVerification.parsedValue, onboardingProfile: nextProfile, onboardingStep: 'asked_age', greetingShown: true });
          
          matchedResponse = `Nice to meet you, **${nameVerification.parsedValue}**! Welcome to YHealth — your personal clinical intelligence assistant.
          
**How old are you?** *(This helps me give you better guidance)*`;
          
          nextStep = 'asked_age';
          nextBotMessageType = 'onboarding_question';
          
          captureAnalyticsEvent('onboarding_step_completed', {
            step: 'not_started',
            next_step: 'asked_age',
          });
        } else {
          // If the check fails or returns invalid, fall back to greeting or health query logic
          if (isGreeting) {
            const isFirstTime = !greetingShown;
            const history = get().messages[chatId] || [];
            const hasPersona = !!get().persona || !!activePersonaManager.getRawPersona();
            const greetingText = await fetchGreetingResponse(
              content,
              isFirstTime,
              userName || undefined,
              history.slice(-11, -1),
              hasPersona
            );
            matchedResponse = greetingText;
            nextBotMessageType = 'greeting';
            if (isFirstTime) {
              nextStep = 'asked_name';
              set({ greetingShown: true, onboardingStep: 'asked_name' });
            }
          } else {
            const apiReply = await fetchGeminiResponse(content, [], nextProfile);
            if (!greetingShown) {
              matchedResponse = `${apiReply}\n\n---\n\nBy the way — I'm YHealth, your health assistant! **What should I call you?**`;
              nextStep = 'asked_name';
              set({ greetingShown: true });
            } else {
              matchedResponse = `${apiReply}\n\n---\n\nJust a reminder — I'd love to personalize this for you. **What's your name?**`;
              nextStep = 'asked_name';
            }
            nextBotMessageType = 'health_reply';
            set({ onboardingStep: nextStep });
          }
        }
      }

      // ── 3. Greeting ── ALL handled by LLM, zero hardcoded strings ─────────────
      else if (isGreeting) {
        const isFirstTime = !greetingShown;
        const history = get().messages[chatId] || [];

        const hasPersona = !!get().persona || !!activePersonaManager.getRawPersona();
        const greetingText = await fetchGreetingResponse(
          content,
          isFirstTime,
          userName || undefined,
          history.slice(-11, -1), // exclude the greeting message just added and keep last 5 turns (10 messages)
          hasPersona
        );

        const isOnboardingInProgress = !isVerified && onboardingStep !== 'completed' && onboardingStep !== 'not_started';

        if (isOnboardingInProgress) {
          // If they say "hi" in the middle of onboarding, keep capturing lead data by appending the active question
          let activeQuestion = '';
          if (onboardingStep === 'asked_name') {
            activeQuestion = `**What should I call you?**`;
          } else if (onboardingStep === 'asked_age') {
            activeQuestion = `**How old are you?** *(This helps me give you better guidance)*`;
          } else if (onboardingStep === 'asked_gender') {
            activeQuestion = `**What's your gender?**\n\n[FollowUps: Male | Female | Prefer not to say]`;
          } else if (onboardingStep === 'asked_phone') {
            activeQuestion = `**What is your mobile/phone number?** *(This helps me save your secure progress)*`;
          } else if (onboardingStep === 'asked_goal') {
            activeQuestion = `**What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness | Hypertension | GLP-1 | Metabolic | Sexual Wellness | Mental Wellness | Longevity]`;
          } else if (onboardingStep === 'asked_conditions') {
            activeQuestion = `**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma | Obesity | Metabolic health]`;
          } else if (onboardingStep === 'asked_feeling') {
            activeQuestion = `**Additional Note on how you are feeling?** *(Type a short note or feel free to say 'N/A' or 'None')*`;
          }

          // Strip any duplicate follow-ups if we are appending our own onboarding follow-up buttons
          let baseGreeting = greetingText;
          if (baseGreeting.includes('[FollowUps:')) {
            baseGreeting = baseGreeting.split('[FollowUps:')[0].trim();
          }

          matchedResponse = `${baseGreeting}\n\n${activeQuestion}`;
          nextBotMessageType = 'onboarding_question';
        } else {
          matchedResponse = greetingText;
          nextBotMessageType = 'greeting';
        }

        if (isFirstTime) {
          // First greeting → move onboarding to asking_name state
          nextStep = 'asked_name';
          set({ greetingShown: true, onboardingStep: 'asked_name' });
        }
      }

      // ── 3. Onboarding in progress (name → age → gender → phone → goal → conditions → feeling → complete) ──
      else if (!isVerified && onboardingStep !== 'completed' && onboardingStep !== 'not_started') {

        if (onboardingStep === 'asked_name') {
          const verification = await verifyUserData('asked_name', content);

          if (!verification.isValid) {
            if (verification.isQuestionOrQuery) {
              // User asked a health question instead of giving name → answer it first, re-ask softly
              const apiReply = await fetchGeminiResponse(content, [], nextProfile);
              matchedResponse = `${apiReply}\n\n---\n\nBy the way, I still don't know your name! **What should I call you?**`;
              nextBotMessageType = 'health_reply';
            } else {
              matchedResponse = `That doesn't look like a name I can use. **Could you share your first name or a nickname?**`;
              nextBotMessageType = 'onboarding_question';
            }
            nextStep = 'asked_name';
          } else {
            nextProfile.name = verification.parsedValue;
            set({ userName: verification.parsedValue });
            matchedResponse = `Nice to meet you, **${verification.parsedValue}**!\n\n**How old are you?** *(This helps me give you better guidance)*`;
            nextStep = 'asked_age';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_age') {
          const verification = await verifyUserData('asked_age', content);

          if (!verification.isValid) {
            if (verification.isQuestionOrQuery) {
              const apiReply = await fetchGeminiResponse(content, [], nextProfile);
              matchedResponse = `${apiReply}\n\n---\n\nAlso — **how old are you?** It helps me tailor my suggestions for you.`;
              nextBotMessageType = 'health_reply';
            } else {
              matchedResponse = `Please share a valid age — just a number works great!\n\n**How old are you?**`;
              nextBotMessageType = 'onboarding_question';
            }
            nextStep = 'asked_age';
          } else {
            nextProfile.age = verification.parsedValue;
            matchedResponse = `Got it — **${verification.parsedValue}** years old.\n\n**What's your gender?**\n\n[FollowUps: Male | Female | Prefer not to say]`;
            nextStep = 'asked_gender';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_gender') {
          const normalized = content.trim().toLowerCase();
          let parsedGender = '';

          if (normalized === 'male' || normalized === 'm') {
            parsedGender = 'Male';
          } else if (normalized === 'female' || normalized === 'f') {
            parsedGender = 'Female';
          } else if (normalized === 'prefer not to say' || normalized === 'skip' || normalized.includes('not to say') || normalized.includes('prefer')) {
            parsedGender = 'Prefer not to say';
          }

          if (!parsedGender) {
            matchedResponse = `Please select or enter a valid gender choice:\n*   **Male**\n*   **Female**\n*   **Prefer not to say**\n\n**What's your gender?**\n\n[FollowUps: Male | Female | Prefer not to say]`;
            nextBotMessageType = 'onboarding_question';
            nextStep = 'asked_gender';
          } else {
            nextProfile.gender = parsedGender;
            matchedResponse = `Thanks! **What is your mobile/phone number?** *(This helps me save your secure progress)*`;
            nextStep = 'asked_phone';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_phone') {
          const cleanedPhone = content.replace(/\D/g, '');
          const startsWithPlus = content.trim().startsWith('+');
          let isPhoneValid = false;

          if (cleanedPhone.length === 10) {
            isPhoneValid = /^[6-9]\d{9}$/.test(cleanedPhone);
          } else if (cleanedPhone.length === 11) {
            isPhoneValid = /^0[6-9]\d{9}$/.test(cleanedPhone);
          } else if (cleanedPhone.length === 12) {
            isPhoneValid = /^91[6-9]\d{9}$/.test(cleanedPhone);
          } else if (startsWithPlus) {
            isPhoneValid = cleanedPhone.length >= 10 && cleanedPhone.length <= 15;
          }

          if (!isPhoneValid) {
            matchedResponse = `That doesn't look like a valid phone number. **Please share your 10-digit mobile number** so I can save your progress securely.`;
            nextBotMessageType = 'onboarding_question';
            nextStep = 'asked_phone';
          } else {
            nextProfile.phone_number = content.trim();
            matchedResponse = `Perfect, got your contact number! 🙌\n\n**What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness | Hypertension | GLP-1 | Metabolic | Sexual Wellness | Mental Wellness | Longevity]`;
            nextStep = 'asked_goal';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_goal') {
          const VALID_GOALS = [
            'Weight loss',
            'Diabetes',
            'Blood reports',
            'Nutrition',
            'Fitness',
            'General wellness',
            'Hypertension',
            'GLP-1',
            'Metabolic',
            'Sexual Wellness',
            'Mental Wellness',
            'Longevity'
          ];

          const GOAL_KEYWORDS: Record<string, string> = {
            'weight': 'Weight loss',
            'loss': 'Weight loss',
            'diet': 'Nutrition',
            'nutrition': 'Nutrition',
            'food': 'Nutrition',
            'fitness': 'Fitness',
            'exercise': 'Fitness',
            'workout': 'Fitness',
            'gym': 'Fitness',
            'diabetes': 'Diabetes',
            'diabetic': 'Diabetes',
            'blood': 'Blood reports',
            'report': 'Blood reports',
            'reports': 'Blood reports',
            'wellness': 'General wellness',
            'general': 'General wellness',
            'bp': 'Hypertension',
            'hypertension': 'Hypertension',
            'pressure': 'Hypertension',
            'glp': 'GLP-1',
            'glp-1': 'GLP-1',
            'glp1': 'GLP-1',
            'metabolic': 'Metabolic',
            'metabolism': 'Metabolic',
            'sexual': 'Sexual Wellness',
            'mental': 'Mental Wellness',
            'stress': 'Mental Wellness',
            'anxiety': 'Mental Wellness',
            'longevity': 'Longevity',
            'aging': 'Longevity'
          };

          const normalized = content.toLowerCase();
          const matchedSet = new Set<string>();

          for (const goal of VALID_GOALS) {
            if (normalized.includes(goal.toLowerCase())) {
              matchedSet.add(goal);
            }
          }

          const words = normalized.split(/[\s,.\-&]+/);
          for (const word of words) {
            if (GOAL_KEYWORDS[word]) {
              matchedSet.add(GOAL_KEYWORDS[word]);
            }
          }

          for (const key of Object.keys(GOAL_KEYWORDS)) {
            if (key.includes(' ') && normalized.includes(key)) {
              matchedSet.add(GOAL_KEYWORDS[key]);
            }
          }

          if (matchedSet.size === 0) {
            matchedResponse = `Please select one or more of the valid choices below:\n` +
              `*   **Weight loss**\n*   **Diabetes**\n*   **Blood reports**\n*   **Nutrition**\n*   **Fitness**\n*   **General wellness**\n*   **Hypertension**\n*   **GLP-1**\n*   **Metabolic**\n*   **Sexual Wellness**\n*   **Mental Wellness**\n*   **Longevity**\n\n**What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness | Hypertension | GLP-1 | Metabolic | Sexual Wellness | Mental Wellness | Longevity]`;
            nextBotMessageType = 'onboarding_question';
            nextStep = 'asked_goal';
          } else {
            const matchedGoalsString = Array.from(matchedSet).join(', ');
            nextProfile.health_goal = matchedGoalsString;
            matchedResponse = `Noted — **${matchedGoalsString}** it is!\n\n**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma | Obesity | Metabolic health]`;
            nextStep = 'asked_conditions';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_conditions') {
          const VALID_CONDITIONS = [
            'None',
            'Diabetes',
            'Hypertension',
            'Asthma',
            'Obesity',
            'Metabolic health'
          ];

          const CONDITION_KEYWORDS: Record<string, string> = {
            'none': 'None',
            'no': 'None',
            'nothing': 'None',
            'na': 'None',
            'n/a': 'None',
            'nil': 'None',
            'diabetes': 'Diabetes',
            'diabetic': 'Diabetes',
            'sugar': 'Diabetes',
            'hypertension': 'Hypertension',
            'bp': 'Hypertension',
            'pressure': 'Hypertension',
            'asthma': 'Asthma',
            'asthmatic': 'Asthma',
            'obesity': 'Obesity',
            'obese': 'Obesity',
            'overweight': 'Obesity',
            'metabolic': 'Metabolic health',
            'metabolism': 'Metabolic health'
          };

          const normalized = content.toLowerCase();
          const matchedSet = new Set<string>();

          for (const condition of VALID_CONDITIONS) {
            if (normalized.includes(condition.toLowerCase())) {
              matchedSet.add(condition);
            }
          }

          const words = normalized.split(/[\s,.\-&]+/);
          for (const word of words) {
            if (CONDITION_KEYWORDS[word]) {
              matchedSet.add(CONDITION_KEYWORDS[word]);
            }
          }

          for (const key of Object.keys(CONDITION_KEYWORDS)) {
            if (key.includes(' ') && normalized.includes(key)) {
              matchedSet.add(CONDITION_KEYWORDS[key]);
            }
          }

          if (matchedSet.size === 0) {
            matchedResponse = `Please select one or more of the valid choices below:\n` +
              `*   **None**\n*   **Diabetes**\n*   **Hypertension**\n*   **Asthma**\n*   **Obesity**\n*   **Metabolic health**\n\n**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma | Obesity | Metabolic health]`;
            nextBotMessageType = 'onboarding_question';
            nextStep = 'asked_conditions';
          } else {
            if (matchedSet.has('None')) {
              nextProfile.conditions = [];
            } else {
              nextProfile.conditions = Array.from(matchedSet);
            }
            matchedResponse = `Got it.\n\n**Additional Note on how you are feeling?** *(Type a short note or feel free to say 'N/A' or 'None')*`;
            nextStep = 'asked_feeling';
            nextBotMessageType = 'onboarding_question';
          }
        }

        else if (onboardingStep === 'asked_feeling') {
          nextProfile.feeling_note = content;

          const conditionsSummary =
            nextProfile.conditions && nextProfile.conditions.length > 0
              ? nextProfile.conditions.join(', ')
              : 'None mentioned';

          matchedResponse = `You're all set, **${nextProfile.name || 'there'}**! 🎉\n\nHere's a quick look at your profile:\n*   **Age / Gender:** ${nextProfile.age || '—'} / ${nextProfile.gender || '—'}\n*   **Phone:** ${nextProfile.phone_number || '—'}\n*   **Health Goal:** ${nextProfile.health_goal || 'General wellness'}\n*   **Conditions:** ${conditionsSummary}\n*   **Additional Note:** ${nextProfile.feeling_note || 'None'}\n\nWhat would you like to explore today?\n\n[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
          
          nextStep = 'completed';
          nextBotMessageType = 'onboarding_complete';

          if (typeof window !== 'undefined') {
            localStorage.setItem('yhealth_lead_v1', JSON.stringify({
              name: nextProfile.name,
              timestamp: new Date().toISOString(),
              onboarding: nextProfile,
            }));
          }

          // Forward captured guest user onboarding profile details to leads backend API proxy
          const sessionUUID = get().sessionId || get().activeChatId || '';
          const ageNum = parseInt(String(nextProfile.age)) || 0;
          
          fetch('/api/leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session_id: sessionUUID,
              name: nextProfile.name || '',
              age: ageNum,
              phone_number: nextProfile.phone_number || '',
              gender: nextProfile.gender || '',
              additional_details: {
                health_goal: nextProfile.health_goal || 'General wellness',
                conditions: nextProfile.conditions || [],
                feeling_note: nextProfile.feeling_note || '',
                utm_campaign: get().utm_campaign || sessionStorage.getItem('utm_campaign') || 'default',
              }
            })
          })
            .then(async (res) => {
              if (res.ok) {
                const leadData = await res.json();
                console.log('Lead captured and sent to backend successfully:', leadData);

                const activeId = get().activeChatId;

                if (sessionUUID && activeId) {
                  const msgs = get().messages[activeId] || [];
                  const chatPairs: { user: string; agent: string }[] = [];

                  for (let i = 0; i < msgs.length; i++) {
                    if (msgs[i].sender === 'user') {
                      const userContent = msgs[i].content;
                      let agentContent = '';
                      for (let j = i + 1; j < msgs.length; j++) {
                        if (msgs[j].sender === 'assistant') {
                          agentContent = msgs[j].content;
                          break;
                        }
                      }
                      chatPairs.push({
                        user: userContent,
                        agent: agentContent,
                      });
                    }
                  }

                  // Add the final step we just completed
                  chatPairs.push({
                    user: content,
                    agent: matchedResponse,
                  });

                  fetch(`/api/leads/${sessionUUID}/session`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      history: chatPairs,
                    }),
                  })
                    .then(async (histRes) => {
                      if (histRes.ok) {
                        console.log('Lead chat history synced successfully:', await histRes.json());
                      } else {
                        console.warn('Failed to sync lead chat history:', histRes.status, await histRes.text());
                      }
                    })
                    .catch((err) => console.warn('Error syncing lead chat history:', err));
                }
              } else {
                console.warn('Failed to send lead to backend:', res.status, await res.text());
              }
            })
            .catch((err) => console.warn('Error sending lead data:', err));
        }

        if (nextStep !== onboardingStep) {
          captureAnalyticsEvent('onboarding_step_completed', {
            step: onboardingStep,
            next_step: nextStep,
          });
          if (nextStep === 'completed') {
            captureAnalyticsEvent('onboarding_completed', {
              age: nextProfile.age,
              gender: nextProfile.gender,
              health_goal: nextProfile.health_goal,
            });
          }
        }
        set({ onboardingStep: nextStep, onboardingProfile: nextProfile });
      }

      // ── 4. Health query before onboarding started (not_started) ──────────
      else if (!isVerified && onboardingStep === 'not_started' && isHealthQuery) {
        const apiReply = await fetchGeminiResponse(content, [], nextProfile);
        // Answer health question first, then softly ask name once
        if (!greetingShown) {
          matchedResponse = `${apiReply}\n\n---\n\nBy the way — I'm YHealth, your health assistant! **What should I call you?**`;
          nextStep = 'asked_name';
          set({ greetingShown: true });
        } else {
          matchedResponse = `${apiReply}\n\n---\n\nJust a reminder — I'd love to personalize this for you. **What's your name?**`;
          nextStep = 'asked_name';
        }
        nextBotMessageType = 'health_reply';
        if (nextStep !== (onboardingStep as string)) {
          captureAnalyticsEvent('onboarding_step_completed', {
            step: onboardingStep,
            next_step: nextStep,
          });
        }
        set({ onboardingStep: nextStep });
      }

      // ── 5. Active chat (onboarding complete OR verified) ─────────────────
      else {
        const history = get().messages[chatId] || [];
        matchedResponse = await fetchGeminiResponse(content, history.slice(-11, -1), onboardingProfile); // keep last 5 turns (10 messages) of context
        nextBotMessageType = 'health_reply';
      }

      // ── 6. Bulletproof CTA Fallback Safeguard (Guarantees every reply has CTA) ──
      if (matchedResponse && !/\[FollowUps:\s*([^\]]+)\]/i.test(matchedResponse)) {
        const campaignKey = get().utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default';
        const config = CAMPAIGN_CONFIG[campaignKey] || CAMPAIGN_CONFIG.default;
        const followUpsText = config.suggestedPrompts.join(' | ');
        matchedResponse += `\n\n[FollowUps: ${followUpsText}]`;
      }


      // ── Stream the response character-by-character ─────────────────────
      const assistantMessageId = Math.random().toString(36).substring(7);
      const assistantMessage: Message = {
        id: assistantMessageId,
        sender: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const messagesBefore = get().messages[chatId!] || [];
      const isFirstAiResponse = messagesBefore.filter(m => m.sender === 'assistant').length === 0;

      set((state) => {
        const nextMessages = { ...state.messages, [chatId!]: [...(state.messages[chatId!] || []), assistantMessage] };
        saveChatState(state.chatSessions, nextMessages, chatId);
        return {
          isTyping: false,
          streamingMessageId: assistantMessageId,
          messages: nextMessages,
          lastBotMessageType: nextBotMessageType,
        };
      });

      let currentIdx = 0;
      const responseLength = matchedResponse.length;

      const interval = setInterval(() => {
        if (currentIdx >= responseLength) {
          clearInterval(interval);
          set({ streamingMessageId: null, activeIntervalId: null });
          saveChatState(get().chatSessions, get().messages, get().activeChatId);
          triggerDebouncedSync(get().chatSessions, get().messages, get().activeChatId);

          if (isFirstAiResponse) {
            captureAnalyticsEvent('first_ai_response');
          }
          if (content.toLowerCase().includes('report')) {
            captureAnalyticsEvent('report_generated');
          }
        } else {
          currentIdx += Math.min(Math.floor(Math.random() * 4) + 6, responseLength - currentIdx);
          const slicedText = matchedResponse.substring(0, currentIdx);
          set((state) => ({
            messages: {
              ...state.messages,
              [chatId!]: (state.messages[chatId!] || []).map((msg) =>
                msg.id === assistantMessageId ? { ...msg, content: slicedText } : msg
              ),
            },
          }));
        }
      }, 8);

      set({ activeIntervalId: interval });
    }, 1000);

    set({ activeIntervalId: timer });
  },

  // ── Stop Streaming ────────────────────────────────────────────────────────
  stopStreaming: () => {
    const { activeIntervalId } = get();
    if (activeIntervalId) {
      clearInterval(activeIntervalId);
      clearTimeout(activeIntervalId);
    }
    set({ activeIntervalId: null, streamingMessageId: null, isTyping: false });
    saveChatState(get().chatSessions, get().messages, get().activeChatId);
    triggerDebouncedSync(get().chatSessions, get().messages, get().activeChatId);
  },

  // ── Restore Existing Patient ──────────────────────────────────────────────
  restoreExistingUser: async (name, phone, personaData, sessionId) => {
    const capitalizedName = name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // Load the persona data into our optimized singleton manager
    if (personaData) {
      activePersonaManager.loadPersona(personaData);
    }

    const resolvedSessionId = sessionId || phone; // use phone number as session identifier fallback if sessionId is null

    set({
      isRestoring: true,
      isVerified: true,
      isExistingPatient: true,
      userType: 'existing',
      personaLoaded: !!personaData,
      persona: personaData || null,
      sessionId: resolvedSessionId,
      userName: capitalizedName,
      onboardingStep: 'completed',
      greetingShown: true,
      lastBotMessageType: 'onboarding_complete',
    });

    try {
      // 1. Try to load patient chat and queries record from Redis cache database
      const res = await fetch(`/api/session/load?sessionId=${resolvedSessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sessions && data.sessions.length > 0) {
          const activeId = data.sessions[0].id;
          set({
            chatSessions: data.sessions,
            messages: data.messages,
            activeChatId: activeId,
            isRestoring: false,
          });
          // Sync to local storage to maintain synchronization
          saveChatState(data.sessions, data.messages, activeId);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to restore patient history from Redis, falling back to campaign welcome:', err);
    }

    // 2. Fallback: No history in Redis. Create fresh "welcome back" session
    const newChatId = generateUUID();
    const newSession = {
      id: newChatId,
      title: 'Active Health Companion',
      timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };

    // Compile welcome message dynamically based on resolved campaign
    const utmCampaign = get().utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default';
    const config = CAMPAIGN_CONFIG[utmCampaign] || CAMPAIGN_CONFIG.default;
    const firstName = capitalizedName.split(' ')[0] || 'Lisha';
    const welcomeTemplateText = config.welcomeTemplate(firstName);
    const followUpsText = config.suggestedPrompts.join(' | ');

    const welcomeMsg: Message = {
      id: Math.random().toString(36).substring(7),
      sender: 'assistant',
      content: `Welcome back, ${capitalizedName}! 👋\n\n${welcomeTemplateText}\n\n[FollowUps: ${followUpsText}]`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    set({
      chatSessions: [newSession],
      messages: { [newChatId]: [welcomeMsg] },
      activeChatId: newChatId,
      isRestoring: false,
    });
    saveChatState([newSession], { [newChatId]: [welcomeMsg] }, newChatId);
    syncSessionWithRedis([newSession], { [newChatId]: [welcomeMsg] }, newChatId);
  },


  // ── Activate Tenant A Program CTA ──────────────────────────────────────────
  activateProgram: () => {
    const campaignKey = get().utm_campaign || 'default';
    const config = CAMPAIGN_CONFIG[campaignKey] || CAMPAIGN_CONFIG.default;
    
    set({ isProgramActivated: true });
    
    // Capture the primary Tenant A attribution and activation events
    captureAnalyticsEvent('consultation_booked', {
      utm_campaign: campaignKey,
      persona: config.persona,
      program: config.programId,
      cta_text: config.ctaText
    });
    
    captureAnalyticsEvent('program_activated', {
      utm_campaign: campaignKey,
      persona: config.persona,
      program: config.programId,
      cta_text: config.ctaText
    });
  },

  // ── Start New User Onboarding ──────────────────────────────────────────────
  startOnboardingConversation: () => {
    const chatId = get().createNewChat();
    set({ onboardingStep: 'asked_name', onboardingProfile: {}, userName: '', greetingShown: true });

    // LLM generates the welcome — no hardcoded strings
    setTimeout(async () => {
      const welcomeText = await fetchGreetingResponse('hi', true, undefined, []);

      const assistantMessageId = Math.random().toString(36).substring(7);
      const welcomeMsg: Message = {
        id: assistantMessageId,
        sender: 'assistant',
        content: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set((state) => {
        const nextMessages = { ...state.messages, [chatId]: [welcomeMsg] };
        saveChatState(state.chatSessions, nextMessages, chatId);
        triggerDebouncedSync(state.chatSessions, nextMessages, chatId);
        return { messages: nextMessages, lastBotMessageType: 'greeting' as LastBotMessageType };
      });
    }, 400);
  },

  // ── Load Persisted Chats from Redis & localStorage ────────────────────────
  loadPersistedChats: async () => {
    if (typeof window === 'undefined') return;
    try {
      const savedSessions = localStorage.getItem('yhealth_chat_sessions');
      const savedMessages = localStorage.getItem('yhealth_chat_messages');
      const savedActiveId = localStorage.getItem('yhealth_active_chat_id');
      
      // 1. Initial immediate hydration from local cache
      if (savedSessions && savedMessages) {
        set({
          chatSessions: JSON.parse(savedSessions),
          messages: JSON.parse(savedMessages),
          activeChatId: savedActiveId || null,
        });
        
        // Fetch latest server state from Redis to synchronize multi-device session
        const sessionId = savedActiveId || localStorage.getItem('yhealth_active_chat_id');
        if (sessionId) {
          const res = await fetch(`/api/session/load?sessionId=${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.sessions && data.sessions.length > 0) {
              set({
                chatSessions: data.sessions,
                messages: data.messages,
              });
              // Update local cache to be in sync
              saveChatState(data.sessions, data.messages, sessionId);
            }
          }
        }
      } else {
        // Brand new user arrives! Generate a secure RFC4122 UUID session ID immediately
        const newGuestSessionId = generateUUID();
        
        const newSession: ChatSession = {
          id: newGuestSessionId,
          title: 'Active Health Companion',
          timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
        };
        
        const initialMessages = { [newGuestSessionId]: [] };
        
        set({
          chatSessions: [newSession],
          messages: initialMessages,
          activeChatId: newGuestSessionId,
          sessionId: newGuestSessionId,
        });
        
        // Save locally and cache immediately in Redis
        saveChatState([newSession], initialMessages, newGuestSessionId);
        await syncSessionWithRedis([newSession], initialMessages, newGuestSessionId);
      }

      // 3. Polling dropped in favor of event-driven sync triggered when messages arrive (debounced)
    } catch (e) {
      console.error('Error loading persisted chats:', e);
    }
  },
}));


