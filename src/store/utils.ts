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

// ── Input Guards ───────────────────────────────────────────────────────────

export function isLikelyGibberish(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;

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
