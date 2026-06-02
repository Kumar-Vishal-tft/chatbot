// ─── Message & Session ─────────────────────────────────────────────────────

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

// ─── Onboarding ────────────────────────────────────────────────────────────

export interface OnboardingProfile {
  name?: string;
  age?: string;
  phone_number?: string;
  gender?: string;
  health_goal?: string;
  conditions?: string[];
  mobile_verified?: boolean;
}

export type OnboardingStep =
  | 'not_started'
  | 'asked_name'
  | 'asked_age'
  | 'asked_phone'
  | 'asked_gender'
  | 'asked_goal'
  | 'asked_conditions'
  | 'completed';

// Tracks what type the last bot message was — used to prevent duplicate greetings/questions
export type LastBotMessageType =
  | 'greeting'
  | 'health_reply'
  | 'onboarding_question'
  | 'onboarding_complete'
  | 'error'
  | 'none';

// High-level conversation mode for intent routing
export type ConversationMode =
  | 'NEW_USER'
  | 'ASKING_NAME'
  | 'ONBOARDING'
  | 'ACTIVE_CHAT';

// ─── Store State & Actions ─────────────────────────────────────────────────

export interface ChatState {
  theme: 'light' | 'dark';
  sidebarExpanded: boolean;
  activeChatId: string | null;
  chatSessions: ChatSession[];
  messages: Record<string, Message[]>;
  isTyping: boolean;
  streamingMessageId: string | null;
  activeIntervalId: any | null;
  searchQuery: string;

  // Onboarding States
  onboardingProfile: OnboardingProfile;
  onboardingStep: OnboardingStep;
  isExistingPatient: boolean;
  isVerified: boolean;
  userName: string;
  userType?: 'guest' | 'existing';
  personaLoaded?: boolean;
  persona?: any | null;
  sessionId?: string | null;
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  isProgramActivated?: boolean;

  // Conversation State
  greetingShown: boolean;           // true after first welcome message is displayed
  lastBotMessageType: LastBotMessageType; // prevents duplicate greetings/questions

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  createNewChat: (initialMessage?: string) => string;
  deleteChat: (id: string) => void;
  sendMessage: (content: string) => void;
  stopStreaming: () => void;
  setSearchQuery: (query: string) => void;
  clearAllChats: () => void;

  // Onboarding Actions
  setOnboardingProfile: (profile: OnboardingProfile) => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setIsExistingPatient: (val: boolean) => void;
  setIsVerified: (val: boolean) => void;
  setUserName: (name: string) => void;
  restoreExistingUser: (name: string, phone: string, persona?: any, sessionId?: string) => void | Promise<void>;

  startOnboardingConversation: () => void;
  loadPersistedChats: () => void;
  activateProgram?: () => void;
}
