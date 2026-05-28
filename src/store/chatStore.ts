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
import { saveChatState, isLikelyGibberish, isGreetingOrFiller } from './utils';
import { fetchGeminiResponse, fetchGreetingResponse, verifyUserData } from './api';
import { RESTORED_SESSIONS, RESTORED_MESSAGES } from './constants';

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
  userName: '',

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
      return { theme: nextTheme };
    }),

  // ── Sidebar ───────────────────────────────────────────────────────────────
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
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
  },

  createNewChat: (initialMessage) => {
    const id = Math.random().toString(36).substring(7);
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

    set((state) => {
      const nextSessions = [newSession, ...state.chatSessions];
      const nextMessages = { ...state.messages, [id]: [] };
      saveChatState(nextSessions, nextMessages, id);
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
      greetingShown: false,
      lastBotMessageType: 'none',
    });
  },

  // ── Send Message ──────────────────────────────────────────────────────────
  sendMessage: (content) => {
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

    // Update chat title from first user message
    const currentMessages = get().messages[chatId] || [];
    if (currentMessages.length === 0) {
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

      // ── 2. Greeting ── ALL handled by LLM, zero hardcoded strings ─────────────
      else if (isGreeting) {
        const isFirstTime = !greetingShown;
        const history = get().messages[chatId] || [];

        const greetingText = await fetchGreetingResponse(
          content,
          isFirstTime,
          userName || undefined,
          history.slice(0, -1) // exclude the greeting message just added
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
          } else if (onboardingStep === 'asked_goal') {
            activeQuestion = `**What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness]`;
          } else if (onboardingStep === 'asked_conditions') {
            activeQuestion = `**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma]`;
          } else if (onboardingStep === 'asked_verify') {
            activeQuestion = `**Would you like to save your profile by verifying your mobile number?**\n\n[FollowUps: Verify Now | Maybe Later]`;
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

      // ── 3. Onboarding in progress (name → age → gender → goal → conditions → verify) ──
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
          nextProfile.gender = content;
          matchedResponse = `Thanks! **What would you most like help with?**\n\n[FollowUps: Weight loss | Diabetes | Blood reports | Nutrition | Fitness | General wellness]`;
          nextStep = 'asked_goal';
          nextBotMessageType = 'onboarding_question';
        }

        else if (onboardingStep === 'asked_goal') {
          nextProfile.health_goal = content;
          matchedResponse = `Noted — **${content}** it is!\n\n**Do you have any existing medical conditions?** *(Type them out, or choose below)*\n\n[FollowUps: None | Diabetes | Hypertension | Asthma]`;
          nextStep = 'asked_conditions';
          nextBotMessageType = 'onboarding_question';
        }

        else if (onboardingStep === 'asked_conditions') {
          nextProfile.conditions = content.toLowerCase().includes('none')
            ? []
            : content.split(',').map((c) => c.trim());
          matchedResponse = `Got it! **Would you like to save your profile by verifying your mobile number?**\n\n[FollowUps: Verify Now | Maybe Later]`;
          nextStep = 'asked_verify';
          nextBotMessageType = 'onboarding_question';
        }

        else if (onboardingStep === 'asked_verify') {
          if (content.toLowerCase().includes('verify now')) {
            matchedResponse = `Tap "Verify Mobile Number" in the bottom panel or the top-right menu to complete verification.`;
          } else {
            const conditionsSummary =
              nextProfile.conditions && nextProfile.conditions.length > 0
                ? nextProfile.conditions.join(', ')
                : 'None mentioned';
            matchedResponse = `You're all set, **${nextProfile.name || 'there'}**!\n\nHere's a quick look at your profile:\n*   **Age / Gender:** ${nextProfile.age || '—'} / ${nextProfile.gender || '—'}\n*   **Health Goal:** ${nextProfile.health_goal || 'General wellness'}\n*   **Conditions:** ${conditionsSummary}\n\n[HealthCardsGrid: Metabolic Rate=Active=healthy | Profile=Complete=healthy]\n\nWhat would you like to explore today?\n\n[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
          }
          nextStep = 'completed';
          nextBotMessageType = 'onboarding_complete';

          if (typeof window !== 'undefined') {
            localStorage.setItem('yhealth_lead_v1', JSON.stringify({
              name: nextProfile.name,
              timestamp: new Date().toISOString(),
              onboarding: nextProfile,
            }));
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
        set({ onboardingStep: nextStep });
      }

      // ── 5. Active chat (onboarding complete OR verified) ─────────────────
      else {
        const history = get().messages[chatId] || [];
        matchedResponse = await fetchGeminiResponse(content, history.slice(0, -1), onboardingProfile);
        nextBotMessageType = 'health_reply';
      }

      // ── Stream the response character-by-character ─────────────────────
      const assistantMessageId = Math.random().toString(36).substring(7);
      const assistantMessage: Message = {
        id: assistantMessageId,
        sender: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

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
  },

  // ── Restore Existing Patient ──────────────────────────────────────────────
  restoreExistingUser: (name) => {
    const capitalizedName = name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    set({
      isVerified: true,
      isExistingPatient: true,
      userName: capitalizedName,
      onboardingStep: 'completed',
      greetingShown: true,
      lastBotMessageType: 'onboarding_complete',
      chatSessions: RESTORED_SESSIONS,
      messages: RESTORED_MESSAGES,
      activeChatId: RESTORED_SESSIONS[0].id,
    });
    saveChatState(RESTORED_SESSIONS, RESTORED_MESSAGES, RESTORED_SESSIONS[0].id);
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
        return { messages: nextMessages, lastBotMessageType: 'greeting' as LastBotMessageType };
      });
    }, 400);
  },


  // ── Load Persisted Chats from localStorage ────────────────────────────────
  loadPersistedChats: () => {
    if (typeof window === 'undefined') return;
    try {
      const savedSessions = localStorage.getItem('yhealth_chat_sessions');
      const savedMessages = localStorage.getItem('yhealth_chat_messages');
      const savedActiveId = localStorage.getItem('yhealth_active_chat_id');
      if (savedSessions && savedMessages) {
        set({
          chatSessions: JSON.parse(savedSessions),
          messages: JSON.parse(savedMessages),
          activeChatId: savedActiveId || null,
        });
      }
    } catch (e) {
      console.error('Error loading persisted chats:', e);
    }
  },
}));
