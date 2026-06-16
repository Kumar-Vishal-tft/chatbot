# 🏥 YHealth AI — Store Architecture

This document explains how the `src/store/` folder is structured, what each file does, and how data flows through the application.

---

## 📁 File Structure

```
src/store/
├── types.ts        → TypeScript interfaces & types
├── config.ts       → Environment variables (API key, backend URL)
├── constants.ts    → Static health responses & demo chat data
├── utils.ts        → Pure helper functions (no side effects)
├── api.ts          → Gemini LLM API calls & validators
└── chatStore.ts    → Zustand global state store (imports all above)
```

---

## 🔗 Dependency Flow

```
.env.local
    │
    ▼
config.ts          ← reads NEXT_PUBLIC_GEMINI_API_KEY, NEXT_PUBLIC_BACKEND_URL
    │
    ▼
api.ts             ← uses GEMINI_API_KEY to call Google Gemini REST API
    │
constants.ts       ← static keyword-response database, demo chat data
    │
types.ts           ← shared TypeScript interfaces used by all files
    │
utils.ts           ← pure helpers: localStorage, input guards, greeting text
    │
    ▼
chatStore.ts       ← Zustand store: imports everything above, manages all state
    │
    ▼
React Components   ← call useChatStore() to read state and dispatch actions
```

---

## 📄 File-by-File Breakdown

---

### 1. `types.ts` — Interfaces & Types

Defines **all shared TypeScript types** used across the app.

| Type | Description |
|---|---|
| `Message` | A single chat message with `id`, `sender`, `content`, `timestamp` |
| `ChatSession` | A chat thread entry shown in the sidebar |
| `OnboardingProfile` | Patient profile collected during onboarding (name, age, gender…) |
| `OnboardingStep` | Union type tracking which onboarding question is active |
| `ChatState` | Full Zustand store shape — all state fields + all action signatures |

**Example:**
```ts
export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

---

### 2. `config.ts` — Environment Variables

Reads secrets from `.env.local` so they are **never hardcoded** in source code.

```ts
export const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
export const BACKEND_URL    = process.env.NEXT_PUBLIC_BACKEND_URL    || 'http://localhost:8000';
```

> **Rule:** If you need to add a new API key or URL, add it to `.env` (template) and `.env.local` (real value), then export it from `config.ts`. Import from `config.ts` everywhere else.

---

### 3. `constants.ts` — Static Data

Contains **hardcoded health knowledge** and **demo chat history** for restored users. No logic — just data.

| Export | Description |
|---|---|
| `HEALTH_RESPONSES` | Array of `{ keywords[], response }` used for keyword-matched replies |
| `DEFAULT_RESPONSE` | Fallback message shown when no keyword matches |
| `RESTORED_SESSIONS` | Demo sidebar sessions shown for existing patients |
| `RESTORED_MESSAGES` | Demo conversation history for each restored session |

**How keyword matching works:**
```
User types: "I have a headache"
    │
    ▼
HEALTH_RESPONSES.find(r => r.keywords.some(k => message.includes(k)))
    │
    ▼
Returns the full markdown response for "headache"
```

---

### 4. `utils.ts` — Pure Helper Functions

Pure functions with **no side effects** — easy to unit test in isolation.

| Function | What it does |
|---|---|
| `saveChatState()` | Saves sessions, messages, and active chat ID to `localStorage` |
| `isLikelyGibberish(text)` | Returns `true` if text looks like a keyboard smash (e.g. `"asdfjkl"`) |
| `hasProfanity(text)` | Returns `true` if text contains blocked words |
| `isGreetingOrFiller(text)` | Returns `true` if text is just `"hi"`, `"hello"`, `"bot"`, etc. |
| `getTimeBasedGreeting()` | Returns `"Good morning"` / `"Good afternoon"` / `"Good evening"` |
| `getRandomGreeting()` | Returns a full random YHealth AI greeting string |

---

### 5. `api.ts` — Gemini API Layer

All **network calls to Google Gemini** live here. Two exported functions:

#### `fetchGeminiResponse(prompt, history, profile?)`

Calls Gemini `gemini-2.5-flash-lite` model to generate a clinical health response.

```
User sends message
    │
    ▼
Map chat history → Gemini format (role: 'user' | 'model')
    │
    ▼
POST https://generativelanguage.googleapis.com/.../gemini-2.5-flash-lite:generateContent
    │
    ▼
Extract text from candidates[0].content.parts[0].text
    │
    ▼
Return markdown string to chatStore
```

- Uses `systemInstruction` to enforce YHealth AI persona, markdown formatting, health cards, and follow-up tags.
- Passes patient `profile` (name, age, gender, health_goal, conditions) as context.
- Falls back to a polite error message if the API call fails.

---

#### `verifyUserData(step, content)`

LLM-powered validator for onboarding fields. Uses Gemini with `responseMimeType: "application/json"` to return structured validation results.

```
User types their name during onboarding
    │
    ▼
verifyUserData('asked_name', "Alex")
    │
    ▼
POST to Gemini with strict JSON schema prompt
    │
    ▼
Parse JSON response: { isValid: true, parsedValue: "Alex", isQuestionOrQuery: false }
    │
    ▼
chatStore uses result to advance onboarding step OR re-ask the question
```

- Falls back to **regex heuristics** if Gemini is unavailable.
- Detects if user typed a health question instead of their name/age and answers it before re-asking.

---

### 6. `chatStore.ts` — Zustand Global Store

The **single source of truth** for all application state. Uses [Zustand](https://github.com/pmndrs/zustand).

#### State Fields

| Field | Type | Description |
|---|---|---|
| `theme` | `'light' \| 'dark'` | Current UI theme |
| `sidebarExpanded` | `boolean` | Whether sidebar is open |
| `activeChatId` | `string \| null` | Currently selected chat thread |
| `chatSessions` | `ChatSession[]` | All chat threads shown in sidebar |
| `messages` | `Record<string, Message[]>` | All messages keyed by chat ID |
| `isTyping` | `boolean` | Shows the typing indicator |
| `streamingMessageId` | `string \| null` | ID of message being streamed |
| `onboardingStep` | `OnboardingStep` | Current onboarding stage |
| `onboardingProfile` | `OnboardingProfile` | Collected patient profile data |
| `isVerified` | `boolean` | Whether phone OTP was verified |
| `isExistingPatient` | `boolean` | Whether user logged in as existing |
| `userName` | `string` | Resolved patient name |

---

#### Key Action: `sendMessage(content)`

This is the most complex action. Here is the full flow:

```
sendMessage("I have a headache")
    │
    ├─ No active chat? → createNewChat() first, then return
    │
    ├─ Append user message to state
    │
    └─ setTimeout(1000ms) ──────────────────────────────────────────────────┐
                                                                             │
        ┌────────────────────────────────────────────────────────────────────┘
        │
        ├─ isLikelyGibberish? → return gibberish error message
        │
        ├─ !isVerified AND onboardingStep !== 'completed'?
        │       │
        │       ├─ 'not_started'    → fetchGeminiResponse() + ask for name
        │       ├─ 'asked_name'     → verifyUserData() → advance or re-ask
        │       ├─ 'asked_age'      → verifyUserData() → advance or re-ask
        │       ├─ 'asked_gender'   → store gender, ask health goal
        │       ├─ 'asked_goal'     → store goal, ask conditions
        │       ├─ 'asked_conditions' → store conditions, ask for OTP verify
        │       └─ 'asked_verify'   → complete onboarding, save lead to localStorage
        │
        └─ isVerified OR onboardingStep === 'completed'?
                │
                └─ fetchGeminiResponse(content, history, profile)
                        │
                        └─ Stream response character-by-character (setInterval 8ms)
```

---

#### Streaming Simulation

```ts
// After Gemini returns the full response string:
let currentIdx = 0;

const interval = setInterval(() => {
  currentIdx += random(6, 10);          // advance 6-10 chars per tick
  slicedText = fullResponse.substring(0, currentIdx);
  // update message content in state → React re-renders → typewriter effect
}, 8);                                   // 8ms per tick = ~125 chars/sec
```

---

## 🔑 Environment Variables

| Variable | Where used | Description |
|---|---|---|
| `NEXT_PUBLIC_GEMINI_API_KEY` | `config.ts` → `api.ts` | Google Gemini API key |
| `NEXT_PUBLIC_BACKEND_URL` | `config.ts` | Your backend REST API base URL |

### Setup

```bash
# 1. Copy the template
cp .env .env.local

# 2. Fill in your real values in .env.local
NEXT_PUBLIC_GEMINI_API_KEY=your_real_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# 3. Restart dev server
npm run dev
```

> ⚠️ `.env.local` is gitignored. Never commit real API keys.

---

## 🧩 How Components Use the Store

```tsx
import { useChatStore } from '@/store/chatStore';

export default function ChatInput() {
  const { sendMessage, isTyping } = useChatStore();

  return (
    <button onClick={() => sendMessage("Hello")} disabled={isTyping}>
      Send
    </button>
  );
}
```

Only import `useChatStore` from `chatStore.ts`. All types can be imported from `types.ts`.

---

## ✅ Adding New Features — Checklist

| Task | Where to edit |
|---|---|
| New TypeScript interface | `types.ts` |
| New API key or URL | `.env` + `.env.local` + `config.ts` |
| New static health topic | `constants.ts` → `HEALTH_RESPONSES` array |
| New input guard / text helper | `utils.ts` |
| New API call (Gemini or backend) | `api.ts` |
| New state field or action | `types.ts` (ChatState) + `chatStore.ts` |
