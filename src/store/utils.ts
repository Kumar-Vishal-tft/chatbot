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

  // Construct user-agent conversation pairs sequentially
  const chatPairs: { user: string; agent: string }[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].sender === 'user') {
      const userContent = msgs[i].content;
      // Find subsequent assistant reply
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

  const payload = {
    session_id: sessionUUID,
    time: Math.floor(Date.now() / 1000), // Epoch format in seconds
    chat: chatPairs,
  };

  try {
    const res = await fetch('/api/chat/sync-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log('Successfully synced chat conversation to backend:', await res.json());
    } else {
      console.warn('Backend sync failed:', res.status, await res.text());
    }
  } catch (err) {
    console.warn('Failed to sync conversation to backend:', err);
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

