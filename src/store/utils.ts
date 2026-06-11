// ─── Pure Utility / Helper Functions ──────────────────────────────────────

import { ChatSession, Message } from './types';

// ── localStorage persistence ───────────────────────────────────────────────

export const saveChatState = (
  sessions: ChatSession[],
  messages: Record<string, Message[]>,
  activeId: string | null
) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('yhealth_chat_sessions', JSON.stringify(sessions));
    localStorage.setItem('yhealth_chat_messages', JSON.stringify(messages));
    if (activeId) {
      localStorage.setItem('yhealth_active_chat_id', activeId);
    } else {
      localStorage.removeItem('yhealth_active_chat_id');
    }
  } catch (e) {
    console.error('Error saving chat to localStorage:', e);
  }
};

export const syncSessionWithRedis = async (
  sessions: ChatSession[],
  messages: Record<string, Message[]>,
  activeId: string | null
) => {
  if (typeof window === 'undefined') return;

  // Dynamically import store to resolve the verified login session ID
  const { useChatStore } = await import('./chatStore');
  const storeState = useChatStore.getState();

  // Prioritize verified session ID, then fallback to activeId
  const sessionId = storeState.sessionId || activeId || localStorage.getItem('yhealth_active_chat_id');
  if (!sessionId) return;

  try {
    await fetch('/api/session/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        sessions,
        messages,
      }),
    });
  } catch (err) {
    console.warn('Failed to sync session to Redis:', err);
  }
};

let debouncedSyncTimeout: NodeJS.Timeout | null = null;

export const triggerDebouncedSync = (
  sessions: ChatSession[],
  messages: Record<string, Message[]>,
  activeId: string | null
) => {
  if (typeof window === 'undefined') return;

  if (debouncedSyncTimeout) {
    clearTimeout(debouncedSyncTimeout);
  }

  debouncedSyncTimeout = setTimeout(async () => {
    console.log('Event-driven debounced sync executing...');
    try {
      await syncSessionWithRedis(sessions, messages, activeId);
    } catch (e) {
      console.warn('Failed to sync session to Redis in debounced callback:', e);
    }
    try {
      await syncConversationWithBackend(messages, activeId);
    } catch (e) {
      console.warn('Failed to sync conversation to backend in debounced callback:', e);
    }
  }, 5000);
};


// ── Input Guards ───────────────────────────────────────────────────────────

export function isLikelyGibberish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;

  // Bypass gibberish check if input is purely numeric or phone characters (e.g. phone numbers, ages)
  if (/^[0-9+\-\s()]+$/.test(trimmed)) return false;

  // 1. Repeated identical characters (e.g. "aaaaaaa", "xxxxxx")
  if (/(.)\\1{4,}/.test(trimmed)) return true;

  // 2. Too many consecutive consonants (e.g. "bcdfghjklmn")
  if (/[bcdfghjklmnpqrstvwxyz]{7,}/i.test(trimmed)) return true;

  // 3. Random keyboard smash (long alphanumeric string with zero vowels)
  if (/^[a-z0-9\s]{10,}$/i.test(trimmed) && !/[aeiouy]/i.test(trimmed)) {
    return true;
  }

  // 4. Alternating keyboard patterns or repeating syllables (e.g. "asdfasdfasdf")
  const words = trimmed.split(/\s+/);
  for (const word of words) {
    if (word.length >= 8) {
      const half = Math.floor(word.length / 2);
      if (word.substring(0, half) === word.substring(half)) return true;
    }
  }

  return false;
}

export function hasProfanity(text: string): boolean {
  const badWords = [
    'fuck', 'shit', 'bitch', 'asshole', 'crap', 'dick', 'pussy', 'bastard',
    'idiot', 'dumb', 'stupid', 'whore', 'slut', 'cunt', 'fag', 'nigger',
    'retard', 'wanker', 'motherfucker', 'cocksucker',
  ];
  const lower = text.toLowerCase();
  return badWords.some((word) => lower.includes(word));
}

export function isGreetingOrFiller(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  // Strict list: only pure social openers, not health-topic words
  const greetings = [
    'hi', 'hello', 'hey', 'yo', 'sup', 'ola', 'namaste', 'hola', 'hallo',
    'good morning', 'good afternoon', 'good evening', 'good day', 'welcome',
  ];
  return greetings.some(
    (g) => trimmed === g || trimmed.startsWith(g + ' ') || trimmed.endsWith(' ' + g)
  );
}

// ── Greeting Helpers ───────────────────────────────────────────────────────

export function getTimeBasedGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  if (hr < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Returns a single, consistent, context-aware greeting.
 * Replaces the old getRandomGreeting() which picked a random corporate title every call.
 *
 * @param isFirstTime  true = user has never been greeted this session
 * @param userName     provided = user's name is already known
 */
export function getContextualGreeting(
  isFirstTime: boolean,
  userName?: string
): string {
  if (isFirstTime) {
    return `Hi there Welcome to YHealth — your personal health assistant.

I'm here to help with symptoms, lab reports, diet, fitness, and general wellness.

To get started, **what should I call you?**

[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
  }

  if (userName) {
    return `Hey **${userName}** — good to see you! How can I help you today?

[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
  }

  return `Hello again How can I help you today?

[FollowUps: Check Symptoms | Analyze Report | Diet Guidance | Medicine Help]`;
}

// Keep export alias so any existing import of getRandomGreeting still compiles
/** @deprecated Use getContextualGreeting() instead */
export const getRandomGreeting = () => getContextualGreeting(false);

/**
 * Ensures any string conforms deterministic-ally to a standard-compliant, parseable UUID v4 format.
 * This guarantees that all session IDs pass Pydantic UUID validation on the FastAPI backend.
 */
export function toValidUUID(input: string): string {
  // If already a valid UUID, return it directly
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) {
    return input;
  }
  
  // Clean input to keep only hex-compatible characters
  let clean = input.replace(/[^0-9a-f]/gi, '').toLowerCase();
  
  // Deterministic padding to guarantee at least 32 characters
  if (clean.length < 32) {
    clean = (clean + 'abcdef0123456789abcdef0123456789').substring(0, 32);
  } else {
    clean = clean.substring(0, 32);
  }
  
  // Structure conformant to RFC4122 v4
  const part1 = clean.substring(0, 8);
  const part2 = clean.substring(8, 12);
  const part3 = '4' + clean.substring(13, 16); // force version 4
  const part4 = '8' + clean.substring(17, 20); // force variant 1 (8, 9, a, or b)
  const part5 = clean.substring(20, 32);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

/**
 * Background Sync Scheduler helper:
 * Syncs the active session's conversation user-agent pairs to backend registry.
 */
export const syncConversationWithBackend = async (
  messages: Record<string, Message[]>,
  activeId: string | null
) => {
  if (typeof window === 'undefined') return;

  // Dynamically import store to completely bypass potential compilation circular dependency limits
  const { useChatStore } = await import('./chatStore');
  const storeState = useChatStore.getState();

  // Resolve session UUID (prioritizing the verified backend UUID, fallback to activeChatId)
  const rawId = storeState.sessionId || activeId || storeState.activeChatId || localStorage.getItem('yhealth_active_chat_id') || 'guest-session';
  const sessionUUID = toValidUUID(rawId);

  // Retrieve local active messages
  const messageLookupKey = activeId || storeState.activeChatId || localStorage.getItem('yhealth_active_chat_id');
  if (!messageLookupKey) return;

  const msgs = messages[messageLookupKey] || [];
  if (msgs.length === 0) return;

  // Extract user ID
  const rawPersona = storeState.persona;
  const userId = rawPersona?._meta?.mongo_patient_id || rawPersona?.identity?.patient_id || storeState.sessionId || 'guest';

  // Get enqueued messages tracker from localStorage
  const getEnqueuedMessageIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem('yhealth_enqueued_message_ids');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markMessageAsEnqueued = (msgId: string) => {
    try {
      const ids = getEnqueuedMessageIds();
      ids.add(msgId);
      localStorage.setItem('yhealth_enqueued_message_ids', JSON.stringify(Array.from(ids)));
    } catch (err) {
      console.error(err);
    }
  };

  const enqueuedIds = getEnqueuedMessageIds();
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const pendingMsgs = msgs.filter((m) => {
    // Only enqueue messages that were created within the last 15 minutes of active session
    if (!m.created_at || m.created_at < fifteenMinutesAgo) {
      return false;
    }
    return !enqueuedIds.has(m.id);
  });
  
  // Do not enqueue streaming/typing assistant response until it finishes
  const filteredPending = pendingMsgs.filter((m) => m.id !== storeState.streamingMessageId);

  for (const msg of filteredPending) {
    if (!msg.content || msg.content.trim() === '...') continue;

    const payload = {
      user_id: userId,
      session_id: sessionUUID,
      role: msg.sender, // 'user' or 'assistant'
      message: msg.content,
      timestamp: Math.floor((msg.created_at || Date.now()) / 1000),
      is_existing_patient: storeState.isExistingPatient,
    };

    try {
      const res = await fetch('/api/chat/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log(`Successfully enqueued message ${msg.id} to Redis`);
        markMessageAsEnqueued(msg.id);
      } else {
        console.warn(`Failed to enqueue message ${msg.id}:`, res.status, await res.text());
      }
    } catch (err) {
      console.warn(`Error enqueuing message ${msg.id}:`, err);
    }
  }
};

/**
 * Generates a valid, secure standard-compliant RFC4122 UUID v4.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates an RFC 9562 compliant UUID v7 (time-based with 1ms resolution).
 * Safe to run in both browser and Server/Node.js environments.
 */
export function generateUUIDv7(): string {
  const now = Date.now();
  const hexTime = now.toString(16).padStart(12, '0');
  
  const randomArray = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomArray);
  } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomArray);
  } else {
    for (let i = 0; i < 10; i++) {
      randomArray[i] = Math.floor(Math.random() * 256);
    }
  }
  
  let randomHex = '';
  randomArray.forEach(b => {
    randomHex += b.toString(16).padStart(2, '0');
  });

  return [
    hexTime.slice(0, 8),
    hexTime.slice(8, 12),
    '7' + randomHex.slice(1, 4),
    (parseInt(randomHex.slice(4, 5), 16) & 0x3 | 0x8).toString(16) + randomHex.slice(5, 8),
    randomHex.slice(8, 20)
  ].join('-');
}

