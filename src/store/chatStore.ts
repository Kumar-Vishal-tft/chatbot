// ─── Zustand Store ──────────────────────────────────────────────────────────
// This file contains ONLY state management logic.
// Business logic is split across:
//   types.ts     → interfaces & types
//   config.ts    → env vars (API key, backend URL)
//   constants.ts → static responses & demo data
//   utils.ts     → pure helper functions
//   api.ts       → Gemini API calls & validators

import { create } from 'zustand';
import { ChatState, ChatSession, Message, LastBotMessageType, OnboardingProfile, OnboardingStep } from './types';
import { saveChatState, syncSessionWithRedis, syncConversationWithBackend, triggerDebouncedSync, isLikelyGibberish, isGreetingOrFiller, generateUUID, generateUUIDv7, toValidUUID, getNextOnboardingStep } from './utils';

import { fetchGeminiResponse, fetchGreetingResponse, verifyUserData, extractOnboardingEntities } from './api';
import { RESTORED_SESSIONS, RESTORED_MESSAGES } from './constants';
import { VALIDATION_ERRORS } from '@/constants/validationErrors';
import { activePersonaManager } from '@/persona/PersonaManager';
import { CAMPAIGN_CONFIG } from './campaign-config';
import { captureAnalyticsEvent } from '@/utils/analytics';

// Re-exports used by components
export { getTimeBasedGreeting, isLikelyGibberish } from './utils';
export type { Message, ChatSession, OnboardingProfile, OnboardingStep } from './types';

let abuseTimerInterval: NodeJS.Timeout | null = null;

function isUserQueryOrQuestion(content: string): boolean {
  const trimmed = content.trim().toLowerCase();
  
  // If it contains a question mark, it's almost certainly a question/query
  if (trimmed.includes('?')) return true;
  
  const words = trimmed.split(/\s+/);
  
  // If it's a very short response (2 words or less), check if it's a simple value
  if (words.length <= 2) {
    const isSimpleValue = /^(male|female|skip|none|diabetes|hypertension|asthma|obesity|yes|no|nothing|nil|ok|okay|fine|good|bad|\d+)$/i.test(trimmed);
    if (isSimpleValue) return false;
  }
  
  // Check if it contains explicit question words or action verbs indicating a request
  const containsQuestionWord = /\b(how|what|who|why|where|when|which|can|could|should|would|tell|explain|symptom|treat|prevent|cure|medicine|clinical|advice|tips|help|why)\b/i.test(trimmed);
  if (containsQuestionWord) return true;
  
  // Check if the input is a comma-separated list of short onboarding values (e.g. "vishal, 99, male")
  const parts = trimmed.split(',');
  if (parts.length >= 2) {
    const allPartsShort = parts.every(part => part.trim().split(/\s+/).length <= 2);
    if (allPartsShort) return false;
  }
  
  // If it's a sentence (> 3 words) and contains clinical/health/lifestyle/symptom/habit keywords, classify it as a query
  const hasHealthKeywords = /\b(pain|hurt|ache|fever|cough|breath|dizzy|blood|glucose|pressure|heart|sugar|diet|nutrition|weight|fitness|exercise|sleep|stress|anxiety|depression|medication|dose|side\s*effect|pill|doctor|clinic|hospital|eat|eating|food|dinner|lunch|breakfast|meal|meals|midnight|night|morning|routine|habit|habits|drink|drinking|water|alcohol|smoke|smoking|workout|gym|run|running|walk|walking|hba1c|a1c|hb|bp|cholesterol|thyroid|creatinine|insulin|report|reports|diagnostic|test|tests|scan|scans|lab|labs|diabetic|asthmatic|obese|symptom|symptoms|disease|illness|medical|health|wellness|clinical|physician|gp|cgm|sensor|reading|readings|mg\/dl|mmhg|bpm|fatty\s*liver|kidney|uric\s*acid)\b/i.test(trimmed);
  const isSentence = words.length > 3;
  
  return isSentence && hasHealthKeywords;
}

function getOnboardingStepQuestion(
  step: OnboardingStep,
  profile: OnboardingProfile,
  isAlsoPrefix = false,
  hasJustNamed = false,
  hasError = false
): string {
  const greetingPrefix = hasJustNamed && profile.name
    ? `Nice to meet you, **${profile.name}**! Welcome to YHealth — your personal clinical intelligence assistant.\n\n`
    : '';

  if (step === 'not_started') {
    // Defensive fallback: treat an unstarted onboarding flow the same as the
    // first real step (asking for the user's name) so callers can never get
    // back an empty string here and leave the user with no next question.
    return getOnboardingStepQuestion(
      'asked_name',
      profile,
      isAlsoPrefix,
      hasJustNamed,
      hasError
    );
  }

  if (step === 'asked_name') {
    return isAlsoPrefix
      ? `By the way, I'm YHealth, your health assistant! **What should I call you?**`
      : `**What should I call you?**`;
  } else if (step === 'asked_age') {
    return isAlsoPrefix
      ? `Also — **how old are you?** It helps me tailor my suggestions for you.`
      : `${greetingPrefix}**How old are you?** *(This helps me give you better guidance)*`;
  } else if (step === 'asked_gender') {
    if (isAlsoPrefix) {
      return `Also — **what is your gender?**\n\n[FollowUps: Male | Female | Prefer not to say]`;
    }
    const transitionPrefix = hasError ? '' : 'Got it.\n\n';
    return `${greetingPrefix}${transitionPrefix}**What's your gender?**\n\n[FollowUps: Male | Female | Prefer not to say]`;
  } else if (step === 'asked_phone') {
    if (isAlsoPrefix) {
      return `Also — **what is your mobile/phone number?**`;
    }
    const transitionPrefix = hasError ? '' : 'Thanks! ';
    return `${greetingPrefix}${transitionPrefix}**What is your mobile/phone number?** *(This helps me save your secure progress)*`;
  } else if (step === 'asked_goal') {
    return isAlsoPrefix
      ? `Also — **what would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness | Hypertension | GLP-1 | Metabolic | Sexual Wellness | Mental Wellness | Longevity]`
      : `${greetingPrefix}**What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness | Hypertension | GLP-1 | Metabolic | Sexual Wellness | Mental Wellness | Longevity]`;
  } else if (step === 'asked_conditions') {
    if (isAlsoPrefix) {
      return `Also — **do you have any existing medical conditions?**\n\n[FollowUps: None | Diabetes | Hypertension | Asthma | Obesity | Metabolic health]`;
    }
    const transitionPrefix = hasError ? '' : 'Noted!\n\n';
    return `${transitionPrefix}**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma | Obesity | Metabolic health]`;
  } else if (step === 'asked_feeling') {
    if (isAlsoPrefix) {
      return `Also — **how are you feeling?**`;
    }
    const transitionPrefix = hasError ? '' : 'Got it.\n\n';
    return `${transitionPrefix}**Additional Note on how you are feeling?** *(Type a short note or feel free to say 'N/A' or 'None')*`;
  } else if (step === 'completed') {
    const conditionsSummary =
      profile.conditions && profile.conditions.length > 0
        ? profile.conditions.join(', ')
        : 'None mentioned';

    return `You're all set, **${profile.name || 'there'}**! 🎉\n\nHere's a quick look at your profile:\n*   **Age / Gender:** ${profile.age || '—'} / ${profile.gender || '—'}\n*   **Phone:** ${profile.phone_number || '—'}\n*   **Health Goal:** ${profile.health_goal || 'General wellness'}\n*   **Conditions:** ${conditionsSummary}\n*   **Additional Note:** ${profile.feeling_note || 'None'}\n\nWhat would you like to explore today?\n\n[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
  }
  return '';
}

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
  messageQueue: [],
  isProcessingQueue: false,

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
  utm_content: null,
  utm_term: null,
  isProgramActivated: false,
  isAbuseBlocked: false,
  abuseRemainingSeconds: 0,
  abuseBlockReason: null,
  micPermissionStatus: 'unknown',
  reportUploadCount: 0,
  prescriptionUploadCount: 0,

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
  setMicPermissionStatus: (status) => set({ micPermissionStatus: status }),
  incrementReportUploadCount: () => set((state) => ({ reportUploadCount: state.reportUploadCount + 1 })),
  incrementPrescriptionUploadCount: () => set((state) => ({ prescriptionUploadCount: state.prescriptionUploadCount + 1 })),
  setOnboardingProfile: (onboardingProfile) => set({ onboardingProfile }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  setIsExistingPatient: (isExistingPatient) => set({ isExistingPatient }),
  setIsVerified: (isVerified) => set({ isVerified }),
  setUserName: (userName) => set({ userName }),
  
  setAbuseBlocked: (blocked, remainingSeconds = 0, reason = null) => {
    set({ isAbuseBlocked: blocked, abuseRemainingSeconds: remainingSeconds, abuseBlockReason: reason });
    if (blocked && remainingSeconds > 0) {
      get().startAbuseTimer();
    }
  },

  checkAbuseStatus: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/abuse?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.blocked) {
          set({
            isAbuseBlocked: true,
            abuseRemainingSeconds: data.remainingSeconds,
            abuseBlockReason: data.reason || 'abuse'
          });
          get().startAbuseTimer();
        } else {
          set({ isAbuseBlocked: false, abuseRemainingSeconds: 0, abuseBlockReason: null });
        }
      }
    } catch (err) {
      console.warn('Failed to check abuse status:', err);
    }
  },

  startAbuseTimer: () => {
    if (abuseTimerInterval) {
      clearInterval(abuseTimerInterval);
      abuseTimerInterval = null;
    }

    abuseTimerInterval = setInterval(() => {
      const remaining = get().abuseRemainingSeconds ?? 0;
      if (remaining <= 1) {
        if (abuseTimerInterval) clearInterval(abuseTimerInterval);
        abuseTimerInterval = null;
        set({ isAbuseBlocked: false, abuseRemainingSeconds: 0, abuseBlockReason: null });
      } else {
        set({ abuseRemainingSeconds: remaining - 1 });
      }
    }, 1000);
  },
  
  skipOnboarding: async () => {
    const { onboardingProfile, sessionId, activeChatId } = get();
    const sessionUUID = sessionId || activeChatId || '';
    const ageNum = parseInt(String(onboardingProfile.age)) || 0;

    // Save lead locally
    if (typeof window !== 'undefined') {
      localStorage.setItem('yhealth_lead_v1', JSON.stringify({
        name: onboardingProfile.name,
        timestamp: new Date().toISOString(),
        onboarding: onboardingProfile,
      }));
    }

    set({ onboardingStep: 'completed', isVerified: true });

    // Send collected lead data to backend leads API proxy
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionUUID,
          name: onboardingProfile.name || '',
          age: ageNum,
          phone_number: onboardingProfile.phone_number || '',
          email: '',
          gender: onboardingProfile.gender || '',
          consent: true,
          lead_status: 'New',
          health_goal: onboardingProfile.health_goal || 'Skipped',
          utm_source: get().utm_source || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_source') : null) || '',
          utm_medium: get().utm_medium || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_medium') : null) || '',
          utm_campaign: get().utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default',
          utm_term: get().utm_term || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_term') : null) || '',
          utm_content: get().utm_content || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_content') : null) || '',
          additional_details: {
            conditions: onboardingProfile.conditions || [],
            feeling_note: onboardingProfile.feeling_note || 'Skipped',
          },
        })
      });

      if (res.ok) {
        console.log('Skipped onboarding lead data successfully sent to backend.');
        // Sync conversation history
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

          await fetch(`/api/leads/${sessionUUID}/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              history: chatPairs,
            }),
          });
        }
      } else {
        console.warn('Failed to send skipped lead to backend:', res.status, await res.text());
      }
    } catch (err) {
      console.warn('Failed to send skipped onboarding lead data:', err);
    }
  },

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
    if (!content.trim()) return;
    if (get().isAbuseBlocked) return;
    const { activeChatId } = get();
    let chatId = activeChatId;

    if (!chatId) {
      chatId = get().createNewChat(content);
      return;
    }

    // ── Abuse guard: check content before allowing send ──────────────────
    const sessionId = get().sessionId || chatId;
    // Fire abuse check asynchronously; if blocked, we'll add the user message
    // but inject a block notice and prevent AI call.
    const abuseCheckPromise = fetch('/api/abuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: content }),
    }).then((r) => r.json()).catch(() => ({ abusive: false, blocked: false }));

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = {
      id: generateUUIDv7(),
      sender: 'user',
      content,
      timestamp,
      created_at: Date.now(),
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
      if (!state.isVerified && state.onboardingStep !== 'completed') {
        syncSessionWithRedis(state.chatSessions, nextMessages, chatId);
      } else {
        triggerDebouncedSync(state.chatSessions, nextMessages, chatId);
      }
      return { 
        messages: nextMessages, 
        messageQueue: [...state.messageQueue, content],
        isTyping: true 
      };
    });

    const processMessageContent = async (targetChatId: string, msgContent: string) => {
      let matchedResponse = '';
      let nextBotMessageType: LastBotMessageType = 'health_reply';
      let nextStep = get().onboardingStep;
      let nextProfile = { ...get().onboardingProfile };

      // ── 0. Abuse & Repetition gate — await the server's verdict ───────────
      try {
        const abuseResult = await abuseCheckPromise;
        if (abuseResult.blocked) {
          // User has hit 3 violations — lock the input for 15 min
          get().setAbuseBlocked(true, abuseResult.remainingSeconds ?? 900, abuseResult.repetition ? 'repetition' : 'abuse');
          
          if (abuseResult.repetition) {
            matchedResponse = `I am unable to continue this conversation if you send the same message repeatedly. My purpose is to provide health support and information in a constructive manner.\n\nYour message field has been locked for **15 minutes** due to sending duplicate messages.\n\n[FollowUps: What health concerns can you address? | How can I start a fitness plan? | Let's focus on health]`;
          } else {
            matchedResponse = `I am unable to continue this conversation if it involves offensive language. My purpose is to provide health support and information in a respectful manner.\n\nIf you are experiencing distress or have thoughts of harming yourself, please reach out for immediate help. You can contact iCall at **9152987821** (24x7 in India) or speak with your doctor.\n\nYour message field has been locked for **15 minutes**. If you'd like to discuss your health or fitness goals constructively, I am here to help.\n\n[FollowUps: What health concerns can you address? | How can I start a fitness plan? | Let's focus on health]`;
          }
          nextBotMessageType = 'error';

          // Stream the block notice and return early — no AI call
          const assistantMessageId = generateUUIDv7();
          const assistantMessage: Message = {
            id: assistantMessageId,
            sender: 'assistant',
            content: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            created_at: Date.now(),
          };
          set((state) => {
            const currentMsgs = state.messages[targetChatId] || [];
            const updatedMsgs = currentMsgs.map((m, idx) => 
              (m.sender === 'user' && idx === currentMsgs.length - 1) ? { ...m, isAbusive: true } : m
            );
            const nextMessages = { ...state.messages, [targetChatId]: [...updatedMsgs, { ...assistantMessage, isAbusive: true }] };
            saveChatState(state.chatSessions, nextMessages, targetChatId);
            return { isTyping: false, streamingMessageId: assistantMessageId, messages: nextMessages, lastBotMessageType: nextBotMessageType };
          });
          let currentIdx = 0;
          await new Promise<void>((resolveStream) => {
            const interval = setInterval(() => {
              if (currentIdx >= matchedResponse.length) {
                clearInterval(interval);
                set({ streamingMessageId: null, activeIntervalId: null });
                saveChatState(get().chatSessions, get().messages, get().activeChatId);
                if (!get().isVerified && get().onboardingStep !== 'completed') {
                  syncSessionWithRedis(get().chatSessions, get().messages, targetChatId);
                } else {
                  triggerDebouncedSync(get().chatSessions, get().messages, targetChatId);
                }
                resolveStream();
              } else {
                currentIdx += Math.min(Math.floor(Math.random() * 4) + 6, matchedResponse.length - currentIdx);
                const sliced = matchedResponse.substring(0, currentIdx);
                set((state) => ({
                  messages: {
                    ...state.messages,
                    [targetChatId]: (state.messages[targetChatId] || []).map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: sliced } : msg
                    ),
                  },
                }));
              }
            }, 8);
            set({ activeIntervalId: interval });
          });
          return;
        }

        if (abuseResult.abusive && !abuseResult.blocked) {
          // Warn the user — this is violation 1 or 2
          const remaining = 3 - (abuseResult.count ?? 1);
          matchedResponse = `I am unable to continue this conversation if it involves offensive language. My purpose is to provide health support and information in a respectful manner.\n\nIf you are experiencing distress or have thoughts of harming yourself, please reach out for immediate help. You can contact iCall at **9152987821** (24x7 in India) or speak with your doctor.\n\nIf you'd like to discuss your health or fitness goals constructively, I am here to help.\n\n> ⚠️ ${remaining} more violation${remaining !== 1 ? 's' : ''} will lock your message field for 15 minutes.\n\n[FollowUps: What health concerns can you address? | How can I start a fitness plan? | Let's discuss my health goals]`;
          nextBotMessageType = 'error';

          const assistantMessageId = generateUUIDv7();
          const assistantMessage: Message = {
            id: assistantMessageId,
            sender: 'assistant',
            content: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            created_at: Date.now(),
          };
          set((state) => {
            const currentMsgs = state.messages[targetChatId] || [];
            const updatedMsgs = currentMsgs.map((m, idx) => 
              (m.sender === 'user' && idx === currentMsgs.length - 1) ? { ...m, isAbusive: true } : m
            );
            const nextMessages = { ...state.messages, [targetChatId]: [...updatedMsgs, { ...assistantMessage, isAbusive: true }] };
            saveChatState(state.chatSessions, nextMessages, targetChatId);
            return { isTyping: false, streamingMessageId: assistantMessageId, messages: nextMessages, lastBotMessageType: nextBotMessageType };
          });
          let currentIdx = 0;
          await new Promise<void>((resolveStream) => {
            const interval = setInterval(() => {
              if (currentIdx >= matchedResponse.length) {
                clearInterval(interval);
                set({ streamingMessageId: null, activeIntervalId: null });
                saveChatState(get().chatSessions, get().messages, get().activeChatId);
                if (!get().isVerified && get().onboardingStep !== 'completed') {
                  syncSessionWithRedis(get().chatSessions, get().messages, targetChatId);
                } else {
                  triggerDebouncedSync(get().chatSessions, get().messages, targetChatId);
                }
                resolveStream();
              } else {
                currentIdx += Math.min(Math.floor(Math.random() * 4) + 6, matchedResponse.length - currentIdx);
                const sliced = matchedResponse.substring(0, currentIdx);
                set((state) => ({
                  messages: {
                    ...state.messages,
                    [targetChatId]: (state.messages[targetChatId] || []).map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: sliced } : msg
                    ),
                  },
                }));
              }
            }, 8);
            set({ activeIntervalId: interval });
          });
          return;
        }

        if (abuseResult.repetition && !abuseResult.blocked) {
          // Warn the user about message repetition
          const remaining = 4 - (abuseResult.count ?? 3);
          matchedResponse = `Please avoid sending the same message repeatedly. I am here to help with your health and fitness goals.\n\n> ⚠️ ${remaining} more repetitive message${remaining !== 1 ? 's' : ''} will lock your message field for 15 minutes.\n\n[FollowUps: What health concerns can you address? | How can I start a fitness plan? | Let's focus on health]`;
          nextBotMessageType = 'error';

          const assistantMessageId = generateUUIDv7();
          const assistantMessage: Message = {
            id: assistantMessageId,
            sender: 'assistant',
            content: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            created_at: Date.now(),
          };
          set((state) => {
            const currentMsgs = state.messages[targetChatId] || [];
            const updatedMsgs = currentMsgs.map((m, idx) => 
              (m.sender === 'user' && idx === currentMsgs.length - 1) ? { ...m, isAbusive: true } : m
            );
            const nextMessages = { ...state.messages, [targetChatId]: [...updatedMsgs, { ...assistantMessage, isAbusive: true }] };
            saveChatState(state.chatSessions, nextMessages, targetChatId);
            return { isTyping: false, streamingMessageId: assistantMessageId, messages: nextMessages, lastBotMessageType: nextBotMessageType };
          });
          let currentIdx = 0;
          await new Promise<void>((resolveStream) => {
            const interval = setInterval(() => {
              if (currentIdx >= matchedResponse.length) {
                clearInterval(interval);
                set({ streamingMessageId: null, activeIntervalId: null });
                saveChatState(get().chatSessions, get().messages, get().activeChatId);
                if (!get().isVerified && get().onboardingStep !== 'completed') {
                  syncSessionWithRedis(get().chatSessions, get().messages, targetChatId);
                } else {
                  triggerDebouncedSync(get().chatSessions, get().messages, targetChatId);
                }
                resolveStream();
              } else {
                currentIdx += Math.min(Math.floor(Math.random() * 4) + 6, matchedResponse.length - currentIdx);
                const sliced = matchedResponse.substring(0, currentIdx);
                set((state) => ({
                  messages: {
                    ...state.messages,
                    [targetChatId]: (state.messages[targetChatId] || []).map((msg) =>
                      msg.id === assistantMessageId ? { ...msg, content: sliced } : msg
                    ),
                  },
                }));
              }
            }, 8);
            set({ activeIntervalId: interval });
          });
          return;
        }
      } catch {
        // Abuse check failed silently — allow the message through
      }

      const isGreeting = isGreetingOrFiller(msgContent);

      // ── 1. Gibberish guard ───────────────────────────────────────────────
      if (isLikelyGibberish(msgContent)) {
        matchedResponse = `Hmm, that didn't look like a question I can understand.

Could you rephrase that? Try something like:
*   *"I have a headache — what should I do?"*
*   *"Suggest a healthy meal plan"*
*   *"Analyze my blood report"*

[FollowUps: Check Symptoms | Meal plan ideas | Analyze a report]`;
        nextBotMessageType = 'error';
      }

      // ── 2. Onboarding Processing ──
      else if (!get().isVerified && get().onboardingStep !== 'completed') {
        const extracted = await extractOnboardingEntities(msgContent, get().onboardingStep);
        
        let anyNewExtraction = false;
        if (extracted.name && extracted.name !== get().onboardingProfile.name) {
          nextProfile.name = extracted.name;
          anyNewExtraction = true;
          set({ userName: extracted.name });
        }
        if (extracted.age && extracted.age !== get().onboardingProfile.age) {
          nextProfile.age = extracted.age;
          anyNewExtraction = true;
        }
        if (extracted.gender && extracted.gender !== get().onboardingProfile.gender) {
          nextProfile.gender = extracted.gender;
          anyNewExtraction = true;
        }
        if (extracted.phone_number && extracted.phone_number !== get().onboardingProfile.phone_number) {
          nextProfile.phone_number = extracted.phone_number;
          anyNewExtraction = true;
        }
        if (extracted.health_goal && extracted.health_goal !== get().onboardingProfile.health_goal) {
          nextProfile.health_goal = extracted.health_goal;
          anyNewExtraction = true;
        }
        if (extracted.conditions && JSON.stringify(extracted.conditions) !== JSON.stringify(get().onboardingProfile.conditions)) {
          nextProfile.conditions = extracted.conditions;
          anyNewExtraction = true;
        }
        if (extracted.feeling_note && extracted.feeling_note !== get().onboardingProfile.feeling_note) {
          nextProfile.feeling_note = extracted.feeling_note;
          anyNewExtraction = true;
        }

        // Check if there was any validation error specifically for the current step
        let currentStepError: string | undefined = undefined;
        const onboardingStep = get().onboardingStep;
        if (onboardingStep === 'asked_name' && extracted.errors?.name) {
          currentStepError = extracted.errors.name;
        } else if (onboardingStep === 'asked_age' && extracted.errors?.age) {
          currentStepError = extracted.errors.age;
        } else if (onboardingStep === 'asked_gender' && extracted.errors?.gender) {
          currentStepError = extracted.errors.gender;
        } else if (onboardingStep === 'asked_phone' && extracted.errors?.phone_number) {
          currentStepError = extracted.errors.phone_number;
        } else if (onboardingStep === 'asked_goal' && extracted.errors?.health_goal) {
          currentStepError = extracted.errors.health_goal;
        } else if (onboardingStep === 'asked_conditions' && extracted.errors?.conditions) {
          currentStepError = extracted.errors.conditions;
        } else if (onboardingStep === 'asked_feeling' && extracted.errors?.feeling_note) {
          currentStepError = extracted.errors.feeling_note;
        }

        const stepToField: Record<string, string> = {
          'not_started': 'name',
          'asked_name': 'name',
          'asked_age': 'age',
          'asked_gender': 'gender',
          'asked_phone': 'phone_number',
          'asked_goal': 'health_goal',
          'asked_conditions': 'conditions',
          'asked_feeling': 'feeling_note',
          'completed': '',
        };

        const getOutOrderAcknowledgment = (nextP: OnboardingProfile, prevP: OnboardingProfile, step: OnboardingStep): string => {
          const newlyExtracted: string[] = [];
          if (nextP.name && !prevP.name) newlyExtracted.push('name');
          if (nextP.age && !prevP.age) newlyExtracted.push('age');
          if (nextP.gender && !prevP.gender) newlyExtracted.push('gender');
          if (nextP.phone_number && !prevP.phone_number) newlyExtracted.push('phone_number');
          if (nextP.health_goal && !prevP.health_goal) newlyExtracted.push('health_goal');
          if (nextP.conditions && nextP.conditions.length > 0 && (!prevP.conditions || prevP.conditions.length === 0)) newlyExtracted.push('conditions');
          if (nextP.feeling_note && !prevP.feeling_note) newlyExtracted.push('feeling_note');

          const activeStepField = stepToField[step] || '';
          if (newlyExtracted.length > 0 && !newlyExtracted.includes(activeStepField)) {
            const list: string[] = [];
            if (newlyExtracted.includes('age')) list.push(`age as **${nextP.age}**`);
            if (newlyExtracted.includes('gender')) list.push(`gender as **${nextP.gender}**`);
            if (newlyExtracted.includes('phone_number')) list.push(`phone number`);
            if (newlyExtracted.includes('health_goal')) list.push(`health goals`);
            if (newlyExtracted.includes('conditions')) list.push(`medical conditions`);
            if (newlyExtracted.includes('feeling_note')) list.push(`feeling note`);
            return `Got it, recorded your ${list.join(', ')}.\n\n`;
          }
          return '';
        };

        const isQuery = isUserQueryOrQuestion(msgContent) || currentStepError === 'health_question';

        // Scenario 1: The user asked a health query or general question
        if (isQuery) {
          const onboardingHistory = get().messages[targetChatId] || [];
          const apiReply = await fetchGeminiResponse(msgContent, onboardingHistory.slice(-11, -1), nextProfile, get().isExistingPatient, get().activeChatId || undefined);
          
          if (anyNewExtraction && !currentStepError) {
            const resolvedNextStep = getNextOnboardingStep(nextProfile);
            nextStep = resolvedNextStep;
            nextBotMessageType = nextStep === 'completed' ? 'onboarding_complete' : 'onboarding_question';
            
            const hasJustNamed = !get().onboardingProfile.name && !!nextProfile.name;
            const nextStepQuestion = getOnboardingStepQuestion(nextStep, nextProfile, false, hasJustNamed);
            matchedResponse = `${apiReply}\n\n---\n\n${nextStepQuestion}`;
          } else {
            const activeStep = onboardingStep === 'not_started' ? 'asked_name' : onboardingStep;
            const acknowledgmentPrefix = getOutOrderAcknowledgment(nextProfile, get().onboardingProfile, activeStep);
            const activeQuestion = getOnboardingStepQuestion(activeStep, nextProfile, true);
            matchedResponse = `${apiReply}\n\n---\n\n${acknowledgmentPrefix}${activeQuestion}`;
            nextBotMessageType = 'health_reply';
            if (onboardingStep === 'not_started') {
              nextStep = 'asked_name';
              set({ greetingShown: true });
            }
          }
        }
        // Scenario 2: Validation error (no query, not a greeting, but has error, and no new valid info was extracted)
        else if (currentStepError && !isGreeting && !anyNewExtraction) {
          const activeStep = onboardingStep === 'not_started' ? 'asked_name' : onboardingStep;
          const activeQuestion = getOnboardingStepQuestion(activeStep, nextProfile, false, false, true);
          matchedResponse = `${currentStepError}\n\n${activeQuestion}`;
          nextBotMessageType = 'onboarding_question';
          nextStep = activeStep;
        }
        // Scenario 3: Greeting (no query, no extraction)
        else if (isGreeting && !anyNewExtraction) {
          const isFirstTime = !get().greetingShown;
          const history = get().messages[targetChatId] || [];
          const hasPersona = !!get().persona || !!activePersonaManager.getRawPersona();
          const greetingText = await fetchGreetingResponse(
            msgContent,
            isFirstTime,
            get().userName || undefined,
            history.slice(-11, -1),
            hasPersona
          );

          let baseGreeting = greetingText;
          if (baseGreeting.includes('[FollowUps:')) {
            baseGreeting = baseGreeting.split('[FollowUps:')[0].trim();
          }

          const activeStep = onboardingStep === 'not_started' ? 'asked_name' : onboardingStep;
          const activeQuestion = getOnboardingStepQuestion(activeStep, nextProfile);
          matchedResponse = `${baseGreeting}\n\n${activeQuestion}`;
          nextBotMessageType = 'onboarding_question';
          
          if (onboardingStep === 'not_started') {
            nextStep = 'asked_name';
          }
          set({ greetingShown: true });
        }
        // Scenario 4: Normal Progression (no query, valid answer extracted)
        else if (anyNewExtraction) {
          const resolvedNextStep = getNextOnboardingStep(nextProfile);
          nextStep = resolvedNextStep;
          nextBotMessageType = nextStep === 'completed' ? 'onboarding_complete' : 'onboarding_question';
          
          const hasJustNamed = !get().onboardingProfile.name && !!nextProfile.name;
          const nextStepQuestion = getOnboardingStepQuestion(nextStep, nextProfile, false, hasJustNamed);
          
          const acknowledgmentPrefix = getOutOrderAcknowledgment(nextProfile, get().onboardingProfile, get().onboardingStep);
          matchedResponse = `${acknowledgmentPrefix}${nextStepQuestion}`;
        }
        // Scenario 5: Fallback (no extraction, no greeting, not a query)
        else {
          const activeStep = onboardingStep === 'not_started' ? 'asked_name' : onboardingStep;
          const activeQuestion = getOnboardingStepQuestion(activeStep, nextProfile, false, false, true);
          matchedResponse = `I didn't quite get that.\n\n${activeQuestion}`;
          nextStep = activeStep;
          nextBotMessageType = 'onboarding_question';
        }

        if (onboardingStep === 'not_started') {
          set({ greetingShown: true });
        }

        if (nextStep === 'completed') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('yhealth_lead_v1', JSON.stringify({
              name: nextProfile.name,
              timestamp: new Date().toISOString(),
              onboarding: nextProfile,
            }));
          }

          const sessionUUID = get().sessionId || get().activeChatId || '';
          const ageNum = parseInt(String(nextProfile.age)) || 0;
          
          fetch('/api/leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'accept': 'application/json',
            },
            body: JSON.stringify({
              session_id: sessionUUID,
              name: nextProfile.name || '',
              age: ageNum,
              phone_number: nextProfile.phone_number || '',
              email: '',
              gender: nextProfile.gender || '',
              consent: true,
              lead_status: 'New',
              health_goal: nextProfile.health_goal || 'General wellness',
              utm_source: get().utm_source || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_source') : null) || '',
              utm_medium: get().utm_medium || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_medium') : null) || '',
              utm_campaign: get().utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default',
              utm_term: get().utm_term || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_term') : null) || '',
              utm_content: get().utm_content || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_content') : null) || '',
              additional_details: {
                conditions: nextProfile.conditions || [],
                feeling_note: nextProfile.feeling_note || '',
              },
            })
          })
            .then(async (res) => {
              if (res.ok) {
                const leadData = await res.json();
                console.log('Lead captured and sent to backend successfully:', leadData);

                const activeId = get().activeChatId;

                if (sessionUUID && activeId) {
                  const msgs = (get().messages[activeId] || []).filter((m) => !m.isAbusive);
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

                  chatPairs.push({
                    user: msgContent,
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

        if (nextStep !== get().onboardingStep) {
          captureAnalyticsEvent('onboarding_step_completed', {
            step: get().onboardingStep,
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

      // ── 5. Active chat (onboarding complete OR verified) ─────────────────
      else {
        const history = get().messages[targetChatId] || [];
        matchedResponse = await fetchGeminiResponse(msgContent, history.slice(-11, -1), get().onboardingProfile, get().isExistingPatient, get().activeChatId || undefined); // keep last 5 turns (10 messages) of context
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
      const assistantMessageId = generateUUIDv7();
      const assistantMessage: Message = {
        id: assistantMessageId,
        sender: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: Date.now(),
      };

      const messagesBefore = get().messages[targetChatId] || [];
      const isFirstAiResponse = messagesBefore.filter(m => m.sender === 'assistant').length === 0;

      await new Promise<void>((resolveStream) => {
        set((state) => {
          const nextMessages = { ...state.messages, [targetChatId]: [...(state.messages[targetChatId] || []), assistantMessage] };
          saveChatState(state.chatSessions, nextMessages, targetChatId);
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
            if (!get().isVerified && get().onboardingStep !== 'completed') {
              syncSessionWithRedis(get().chatSessions, get().messages, get().activeChatId);
            } else {
              triggerDebouncedSync(get().chatSessions, get().messages, get().activeChatId);
            }

            if (isFirstAiResponse) {
              captureAnalyticsEvent('first_ai_response');
            }
            if (msgContent.toLowerCase().includes('report')) {
              captureAnalyticsEvent('report_generated');
            }
            resolveStream();
          } else {
            currentIdx += Math.min(Math.floor(Math.random() * 4) + 6, responseLength - currentIdx);
            const slicedText = matchedResponse.substring(0, currentIdx);
            set((state) => ({
              messages: {
                ...state.messages,
                [targetChatId]: (state.messages[targetChatId] || []).map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, content: slicedText } : msg
                ),
              },
            }));
          }
        }, 8);

        set({ activeIntervalId: interval });
      });
    };

    const runQueue = async () => {
      if (get().isProcessingQueue) return;
      set({ isProcessingQueue: true });

      while (get().messageQueue.length > 0) {
        while (get().streamingMessageId !== null) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const nextContent = get().messageQueue[0];
        
        set((state) => ({
          messageQueue: state.messageQueue.slice(1)
        }));

        try {
          await processMessageContent(chatId!, nextContent);
        } catch (error) {
          console.error("Error processing queue message:", error);
        }
      }

      set({ isProcessingQueue: false, isTyping: false });
    };

    runQueue();
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

    // Escape a string for safe use inside a RegExp.
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Builds a function that strips this specific restored patient's name out
    // of any historic message content when we don't have a confirmed
    // first_name on the persona (i.e. we can't be sure showing their name is
    // appropriate/intended). Previously this was hardcoded to one literal
    // test name ("Lisha Karar"), which silently leaked the real name of any
    // other patient who hit this code path. Now it's derived from the actual
    // name passed in for this restore call.
    const firstNameOnly = capitalizedName.split(' ')[0] || '';
    const stripPatientName = (text: string): string => {
      if (!capitalizedName) return text;
      let result = text;
      if (firstNameOnly) {
        result = result
          .replace(new RegExp(`Welcome back, ${escapeRegExp(capitalizedName)}!`, 'g'), 'Welcome back!')
          .replace(new RegExp(`Hi ${escapeRegExp(firstNameOnly)}\\.`, 'g'), 'Hi.')
          .replace(new RegExp(escapeRegExp(capitalizedName), 'g'), '')
          .replace(new RegExp(escapeRegExp(firstNameOnly), 'g'), '');
      }
      return result;
    };
    
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

    let localSessions: ChatSession[] = [];
    let localMessages: Record<string, Message[]> = {};
    const hasName = !!(personaData?.identity?.first_name || '').trim();

    // 1. Try to load patient chat and queries record from Redis cache database
    try {
      const res = await fetch(`/api/session/load?sessionId=${resolvedSessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.sessions && data.sessions.length > 0) {
          localSessions = data.sessions;
          localMessages = data.messages;
          if (!hasName) {
            for (const key in localMessages) {
              localMessages[key] = localMessages[key].map(msg => ({
                ...msg,
                content: stripPatientName(msg.content)
              }));
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to restore patient history from Redis:', err);
    }

    // 2. Fetch history from the backend messages endpoint and merge
    try {
      const validUUID = toValidUUID(resolvedSessionId);
      const res = await fetch(`/api/chat/sessions/${validUUID}/messages?limit=100&offset=0`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const mappedBackendMessages: Message[] = data.messages.map((m: any) => {
            const baseTime = m.created_at ? new Date(m.created_at).getTime() : Date.now();
            // Offset each message by turn_index × 5 seconds so that messages sharing the
            // same backend created_at (e.g. user question + AI reply stored simultaneously)
            // still show distinct, sequential timestamps in the UI.
            const turnOffset = (typeof m.turn_index === 'number' ? m.turn_index : 0) * 5000;
            const adjustedTime = baseTime + turnOffset;
            const adjustedDate = new Date(adjustedTime);
            
            let content = m.content || '';
            if (!hasName) {
              content = stripPatientName(content);
            }

            return {
              id: generateUUIDv7(),
              sender: m.role === 'user' ? 'user' : 'assistant',
              content: content,
              timestamp: adjustedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              created_at: adjustedTime,
            };
          });

          // Retrieve messages for the active session, fallback to empty
          const targetSessionId = localSessions[0]?.id || resolvedSessionId;
          const currentLocalMsgs = localMessages[targetSessionId] || [];

          // Combine lists
          const allMessages = [...mappedBackendMessages, ...currentLocalMsgs];

          // De-duplicate using 5-minute time window
          const mergedMessages: Message[] = [];
          for (const msg of allMessages) {
            const isDuplicate = mergedMessages.some(existing => 
              existing.sender === msg.sender &&
              existing.content.trim() === msg.content.trim() &&
              Math.abs((existing.created_at || 0) - (msg.created_at || 0)) < 300000
            );
            if (!isDuplicate) {
              mergedMessages.push(msg);
            }
          }

          // Sort chronologically by created_at (ascending order)
          mergedMessages.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

          const activeId = targetSessionId;
          const updatedSessions = localSessions.length > 0
            ? localSessions
            : [{
                id: activeId,
                title: 'Active Health Companion',
                timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
              }];

          const updatedMessagesMap = {
            ...localMessages,
            [activeId]: mergedMessages,
          };

          set({
            chatSessions: updatedSessions,
            messages: updatedMessagesMap,
            activeChatId: activeId,
            isRestoring: false,
          });

          // Sync back to local storage and Redis cache
          saveChatState(updatedSessions, updatedMessagesMap, activeId);
          syncSessionWithRedis(updatedSessions, updatedMessagesMap, activeId);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch/merge patient history from backend API:', err);
    }

    // Fallback if no backend messages were restored
    if (localSessions.length > 0) {
      const activeId = localSessions[0].id;
      set({
        chatSessions: localSessions,
        messages: localMessages,
        activeChatId: activeId,
        isRestoring: false,
      });
      saveChatState(localSessions, localMessages, activeId);
      return;
    }

    // 3. Fallback: No history anywhere. Create fresh "welcome back" session
    const newChatId = generateUUID();
    const newSession = {
      id: newChatId,
      title: 'Active Health Companion',
      timestamp: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };

    // Compile welcome message dynamically based on resolved campaign
    const utmCampaign = get().utm_campaign || (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default';
    const config = CAMPAIGN_CONFIG[utmCampaign] || CAMPAIGN_CONFIG.default;
    const firstName = capitalizedName.split(' ')[0] || '';
    const welcomeTemplateText = config.welcomeTemplate(firstName);
    const followUpsText = config.suggestedPrompts.join(' | ');

    const welcomeMsg: Message = {
      id: generateUUIDv7(),
      sender: 'assistant',
      content: `Welcome back${capitalizedName ? `, ${capitalizedName}` : ''}! 👋\n\n${welcomeTemplateText}\n\n[FollowUps: ${followUpsText}]`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: Date.now(),
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
      const activeQuestion = getOnboardingStepQuestion('asked_name', {});
      const welcomeWithQuestion = `${welcomeText}\n\n${activeQuestion}`;

      const assistantMessageId = generateUUIDv7();
      const welcomeMsg: Message = {
        id: assistantMessageId,
        sender: 'assistant',
        content: welcomeWithQuestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        created_at: Date.now(),
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
      // Query microphone permission status
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'microphone' as PermissionName })
          .then((permissionStatus) => {
            set({ micPermissionStatus: permissionStatus.state as any });
            permissionStatus.onchange = () => {
              set({ micPermissionStatus: permissionStatus.state as any });
            };
          })
          .catch((err) => {
            console.warn('Failed to query mic permission status:', err);
          });
      }

      const savedSessions = localStorage.getItem('yhealth_chat_sessions');
      const savedMessages = localStorage.getItem('yhealth_chat_messages');
      const savedActiveId = localStorage.getItem('yhealth_active_chat_id');

      const savedReportUploadCount = localStorage.getItem('yhealth_report_uploads_count');
      const savedPrescriptionUploadCount = localStorage.getItem('yhealth_prescription_uploads_count');

      // Hydrate onboarding state from LocalStorage first (instant recovery)
      const savedOnboardingStep = localStorage.getItem('yhealth_onboarding_step') as any;
      const savedOnboardingProfile = localStorage.getItem('yhealth_onboarding_profile');
      const savedUserName = localStorage.getItem('yhealth_userName');
      const savedIsVerified = localStorage.getItem('yhealth_isVerified');

      if (savedOnboardingStep) {
        const parsedProfile = savedOnboardingProfile ? JSON.parse(savedOnboardingProfile) : {};
        const correctedStep = (savedOnboardingStep !== 'completed' && savedOnboardingStep !== 'not_started')
          ? getNextOnboardingStep(parsedProfile)
          : savedOnboardingStep;

        set({
          onboardingStep: correctedStep,
          onboardingProfile: parsedProfile,
          userName: savedUserName || '',
          isVerified: savedIsVerified ? JSON.parse(savedIsVerified) : false,
          reportUploadCount: savedReportUploadCount ? parseInt(savedReportUploadCount) : 0,
          prescriptionUploadCount: savedPrescriptionUploadCount ? parseInt(savedPrescriptionUploadCount) : 0,
        });
      } else {
        set({
          reportUploadCount: savedReportUploadCount ? parseInt(savedReportUploadCount) : 0,
          prescriptionUploadCount: savedPrescriptionUploadCount ? parseInt(savedPrescriptionUploadCount) : 0,
        });
      }
      
      // 1. Initial immediate hydration from local cache
      if (savedSessions && savedMessages) {
        set({
          chatSessions: JSON.parse(savedSessions),
          messages: JSON.parse(savedMessages),
          activeChatId: savedActiveId || null,
          sessionId: savedActiveId || null,
        });
        
        // Fetch latest server state from Redis to synchronize multi-device session
        const sessionId = savedActiveId || localStorage.getItem('yhealth_active_chat_id');
        if (sessionId) {
          const res = await fetch(`/api/session/load?sessionId=${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.sessions && data.sessions.length > 0) {
              const redisProfile = data.onboardingProfile || {};
              const redisStep = data.onboardingStep || 'not_started';
              const correctedRedisStep = (redisStep !== 'completed' && redisStep !== 'not_started')
                ? getNextOnboardingStep(redisProfile)
                : redisStep;

              set({
                chatSessions: data.sessions,
                messages: data.messages,
                sessionId: sessionId,
                onboardingStep: data.onboardingStep ? correctedRedisStep : get().onboardingStep,
                onboardingProfile: data.onboardingProfile ? redisProfile : get().onboardingProfile,
                userName: data.userName !== undefined ? data.userName : get().userName,
                isVerified: data.isVerified !== undefined ? data.isVerified : get().isVerified,
                reportUploadCount: data.reportUploadCount !== undefined ? data.reportUploadCount : get().reportUploadCount,
                prescriptionUploadCount: data.prescriptionUploadCount !== undefined ? data.prescriptionUploadCount : get().prescriptionUploadCount,
                isProgramActivated: data.isProgramActivated !== undefined ? data.isProgramActivated : get().isProgramActivated,
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

      // Mark all loaded/restored message IDs as enqueued
      const currentMessages = get().messages;
      const allMessageIds = new Set<string>();
      Object.values(currentMessages).forEach((msgs) => {
        msgs.forEach((m) => {
          if (m.id) allMessageIds.add(m.id);
        });
      });
      if (allMessageIds.size > 0) {
        try {
          const stored = localStorage.getItem('yhealth_enqueued_message_ids');
          const enqueuedSet = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
          let changed = false;
          allMessageIds.forEach((id) => {
            if (!enqueuedSet.has(id)) {
              enqueuedSet.add(id);
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem('yhealth_enqueued_message_ids', JSON.stringify(Array.from(enqueuedSet)));
          }
        } catch (e) {
          console.warn('Error marking restored messages as enqueued:', e);
        }
      }

      // 3. Polling dropped in favor of event-driven sync triggered when messages arrive (debounced)
    } catch (e) {
      console.error('Error loading persisted chats:', e);
    }
  },
}));

if (typeof window !== 'undefined') {
  useChatStore.subscribe((state) => {
    try {
      localStorage.setItem('yhealth_onboarding_step', state.onboardingStep);
      localStorage.setItem('yhealth_onboarding_profile', JSON.stringify(state.onboardingProfile || {}));
      localStorage.setItem('yhealth_userName', state.userName || '');
      localStorage.setItem('yhealth_isVerified', JSON.stringify(state.isVerified || false));
      localStorage.setItem('yhealth_report_uploads_count', String(state.reportUploadCount || 0));
      localStorage.setItem('yhealth_prescription_uploads_count', String(state.prescriptionUploadCount || 0));
    } catch (e) {
      console.error('Error saving onboarding state to localStorage:', e);
    }
  });
}
