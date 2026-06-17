# YHealth AI Chatbot — Project Structure

> **Stack:** Next.js 14 (App Router) · TypeScript · Zustand · Redis (ioredis) · Google Gemini API · Tailwind CSS · Framer Motion · Langfuse · Umami Analytics

---

## Table of Contents

1. [Root Level](#root-level)
2. [src/app — Pages & API Routes](#srcapp--pages--api-routes)
3. [src/components — UI Components](#srccomponents--ui-components)
4. [src/store — State Management & API Layer](#srcstore--state-management--api-layer)
5. [src/persona — Clinical Context Engine](#srcpersona--clinical-context-engine)
6. [src/hooks — Custom React Hooks](#srchooks--custom-react-hooks)
7. [src/lib — Server-Side Clients](#srclib--server-side-clients)
8. [src/utils — Utilities](#srcutils--utilities)
9. [src/constants — Shared Constants](#srcconstants--shared-constants)
10. [src/types — Global TypeScript Types](#srctypes--global-typescript-types)
11. [docs/ — Internal Documentation](#docs--internal-documentation)
12. [Infrastructure](#infrastructure)
13. [Architecture Diagrams](#architecture-diagrams)
14. [Environment Variables](#environment-variables)

---

## Root Level

```
frontend/
├── src/                          # All application source code
├── public/                       # Static assets served by Next.js
│   └── Y-Health.png              # App logo / brand asset
├── docs/                         # Internal technical documentation (markdown)
├── .env                          # Environment variables (never commit)
├── .gitignore
├── Dockerfile                    # Multi-stage production container build
├── docker-compose.yml            # Orchestrates frontend + Redis services
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS theme configuration
├── postcss.config.js
├── tsconfig.json
├── package.json
├── README.md                     # High-level developer README
├── PROJECT_STRUCTURE.md          # This file — full project map
└── onboarding_state_machine.svg  # Visual diagram of the onboarding FSM
```

---

## `src/app` — Pages & API Routes

```
src/app/
├── layout.tsx          # Root layout: fonts, Umami analytics script, metadata
├── globals.css         # Global CSS: CSS variables, Tailwind base overrides
├── output.css          # Compiled Tailwind output (auto-generated)
├── page.tsx            # ⭐ Main application page (entry point UI)
│                       #   Manages welcome → chat stage transitions,
│                       #   patient restoration, dashboard rendering, and
│                       #   anchors all major child components.
│
└── api/                # Next.js API routes (server-side only)
    │
    ├── abuse/
    │   └── route.ts                # GET  — Checks if a session is currently blocked
    │                               #          (returns blocked, reason, remainingSeconds).
    │                               # POST — Abuse detection middleware backed by Redis.
    │                               #          Detects profane language (word-list match)
    │                               #          and message repetition (≥4 identical msgs).
    │                               #          Blocks offending sessions for 15 min (900s)
    │                               #          after 3 abuse strikes or 4 repetitions.
    │                               #          Counters reset on block; 24 h TTL otherwise.
    │
    ├── agent/
    │   └── query/route.ts          # POST — Proxies natural language queries to
    │                               #   the FastAPI MongoDB Agent backend.
    │                               #   Triggered by the [FALLBACK_TO_MONGO] LLM flag.
    │
    ├── auth/
    │   ├── send-otp/route.ts       # POST — Sends OTP to patient phone via backend
    │   └── verify-otp/route.ts     # POST — Verifies OTP & returns patient session
    │
    ├── chat/
    │   ├── enqueue/route.ts        # POST — Stores chat messages in Redis lists;
    │                               #   runs lead extraction via Gemini JSON mode;
    │                               #   auto-submits qualified leads to backend.
    │   ├── sessions/
    │   │   └── [sessionId]/
    │   │       └── messages/
    │   │           └── route.ts    # GET  — Paginated proxy to backend for fetching
    │   │                           #         a session's message history.
    │   │                           #         Params: limit (default 100), offset (default 0).
    │   │                           #         Transparently forwards backend HTTP status.
    │   └── sync-messages/route.ts  # POST — Batch syncs messages from Redis → backend
    │
    ├── extract/route.ts            # POST — LLM-powered entity extraction for onboarding
    │                               #   (name, age, gender, phone, goal, conditions,
    │                               #   feeling_note) from free-text user input.
    │                               #   Includes profanity guard (returns error early).
    │
    ├── leads/
    │   ├── route.ts                # POST — Registers a new lead/patient in the backend
    │   └── [id]/session/route.ts   # GET  — Fetches lead session data by lead ID
    │
    ├── predefined-persona/route.ts # GET  — Fetches campaign-specific system prompts
    │                               #   from backend by utm_campaign name.
    │
    ├── session/
    │   ├── load/route.ts           # GET  — Loads full session state from Redis by sessionId
    │   └── save/route.ts           # POST — Saves/updates full session state to Redis
    │                               #   (7-day TTL). Stores messages, onboarding step,
    │                               #   profile, userName, isVerified.
    │
    ├── test/
    │   ├── test-lead/route.ts      # POST — Dev-only: manually fires a test lead payload
    │   └── trigger-worker/route.ts # POST — Dev-only: manually triggers sync worker
    │
    ├── trace/route.ts              # POST — Server-side Langfuse tracing proxy.
    │                               #   Prevents exposing LANGFUSE_SECRET_KEY to client.
    │
    └── validate/route.ts           # POST — LLM-powered field validation for onboarding
                                    #   steps. Returns {valid, normalized, reason}.
                                    #   Includes profanity guard.
```

---

## `src/components` — UI Components

```
src/components/
│
├── ChatInput.tsx           # ⭐ Main chat text input bar
│                           #   Handles send, shift+enter, file upload trigger,
│                           #   voice activation button, prompt pill suggestions.
│                           #   Fires analytics events on submit.
│
├── ChatMessage.tsx         # Individual message bubble renderer
│                           #   Renders Markdown via react-markdown + remark-gfm.
│                           #   Handles custom blocks:
│                           #     [FollowUps: ...] → clickable suggestion pills
│                           #     [HealthCardsGrid: ...] → health metric cards
│                           #     > [!NOTE/TIP/WARNING/IMPORTANT] → styled alerts
│
├── LeadCaptureCard.tsx     # Onboarding completion confirmation card
│                           #   Shown when a new user finishes the 7-step flow.
│
├── Navbar.tsx              # Top navigation bar
│                           #   App logo, session controls, theme toggle button,
│                           #   new chat button, mobile menu.
│
├── PromptCards.tsx         # Campaign-specific suggested prompt pill cards
│                           #   Displayed on the welcome screen before chat starts.
│                           #   Content driven by CAMPAIGN_CONFIG in store/.
│
├── Sidebar.tsx             # Chat history sidebar
│                           #   Lists all chat sessions, allows switching/deleting.
│                           #   Collapsible on mobile.
│
├── SuggestionPills.tsx     # Inline follow-up suggestion chip renderer
│                           #   Displays the parsed [FollowUps: a | b | c] chips
│                           #   from bot messages as clickable buttons.
│
├── ThemeToggle.tsx         # Light/dark mode toggle button
│                           #   Reads/writes theme to localStorage and document class.
│
├── TourTooltip.tsx         # Guided product tour overlay component
│                           #   Step-by-step tooltips for first-time users.
│
├── TypingLoader.tsx        # Animated "..." typing indicator shown while bot responds
│
├── UploadModal.tsx         # File upload modal (lab reports, prescriptions)
│                           #   Accepts PDF/image; sends to backend for parsing.
│
├── VerificationPanel.tsx   # ⭐ Existing patient OTP verification flow
│                           #   Phone entry → OTP send → OTP verify → persona load.
│                           #   Triggers restoreExistingUser() on success.
│
├── VoiceAssistantPanel.tsx # ⭐ Live voice assistant (WebSocket + Web Audio)
│                           #   16kHz PCM input → Gemini Live API WebSocket
│                           #   24kHz Float32 playback scheduler
│                           #   Animated canvas waveform (RMS-based)
│                           #   Screen Wake Lock, smart interruption handling.
│
└── persona.ts              # (legacy helper) Persona display formatting utilities
```

---

## `src/store` — State Management & API Layer

```
src/store/
│
├── chatStore.ts         # ⭐ Central Zustand store — single source of truth
│                        #
│                        #   STATE managed:
│                        #     chatSessions, messages, activeChatId
│                        #     onboardingStep (FSM: not_started → completed)
│                        #     onboardingProfile (name, age, gender, phone,
│                        #                       health_goal, conditions, feeling_note)
│                        #     userName, isVerified, isExistingPatient
│                        #     persona (raw patient data), sessionId
│                        #     streamingMessageId, isTyping, messageQueue
│                        #     greetingShown, isDarkMode
│                        #     utm_campaign, utm_source, utm_medium, utm_content
│                        #
│                        #   KEY ACTIONS:
│                        #     sendMessage()         — Full message lifecycle
│                        #     processMessageContent() — Onboarding FSM + LLM routing
│                        #     restoreExistingUser() — Verified patient session restore
│                        #     loadPersistedChats()  — localStorage + Redis hydration
│                        #     toggleTheme()         — Dark/light mode persistence
│                        #
│                        #   ONBOARDING SCENARIOS (in processMessageContent):
│                        #     1. Health query → LLM answer + repeat question
│                        #     2. Validation error (non-greeting) → error + re-ask
│                        #     3. Greeting → LLM greeting response + re-ask name
│                        #     4. Valid entity extracted → advance to next step
│                        #     5. Fallback → "I didn't quite get that" + re-ask
│
├── api.ts               # ⭐ Client-side Gemini API layer
│                        #
│                        #   FUNCTIONS:
│                        #     fetchGeminiResponse()       — Main LLM chat call
│                        #                                   Builds system instruction
│                        #                                   with clinical context,
│                        #                                   campaign focus, and
│                        #                                   Gemini Context Cache.
│                        #                                   Handles [FALLBACK_TO_MONGO].
│                        #     fetchGreetingResponse()     — Contextual LLM greeting
│                        #     verifyUserData()            — Single-field validation
│                        #                                   via /api/validate proxy
│                        #     extractOnboardingEntities() — Multi-field extraction
│                        #                                   via /api/extract proxy.
│                        #                                   Profanity guard + 7-step
│                        #                                   client fallback heuristics.
│                        #     getOrCreateGeminiCache()    — Gemini Context Cache mgr
│                        #                                   (>8500 char threshold)
│                        #     fetchPredefinedPersona()    — Campaign persona loader
│                        #     getOfflineCampaignFocusPrompt() — Offline fallback prompts
│                        #     validateAndNormalizePhone() — Shared phone validator
│
├── campaign-config.ts   # Campaign branding config keyed by utm_campaign
│                        #   Exports: CampaignDetail, ProgramCard interfaces
│                        #           and the CAMPAIGN_CONFIG record.
│                        #   Controls per-campaign: heroTagline, programDescription,
│                        #   ctaText, welcomeTemplate, suggestedPrompts, cards.
│                        #   Campaigns:
│                        #     diabetes_reversal — Diabetes coach (HbA1c, CGM)
│                        #     bp_control        — Heart health / hypertension coach
│                        #     weight_loss        — Weight loss & metabolic optimisation
│                        #     metabolic_health   — Metabolic & preventive wellness coach
│                        #     default            — General health assistant
│
├── config.ts            # Environment variable exports (GEMINI_API_KEY, etc.)
│
├── constants.ts         # RESTORED_SESSIONS, RESTORED_MESSAGES, and other
│                        #   static data used during session hydration.
│
├── types.ts             # TypeScript interfaces:
│                        #   Message, ChatSession, OnboardingProfile,
│                        #   OnboardingStep, LastBotMessageType
│
├── utils.ts             # Pure utility functions:
│                        #   saveChatState()           — localStorage persistence
│                        #   syncSessionWithRedis()    — Immediate Redis sync
│                        #   triggerDebouncedSync()    — 5s debounced sync
│                        #   syncConversationWithBackend() — Chat enqueue sync
│                        #   isLikelyGibberish()       — Input quality guard
│                        #   hasProfanity()            — Profanity filter
│                        #   isGreetingOrFiller()      — Greeting detector
│                        #   getContextualGreeting()   — Offline greeting fallback
│                        #   getNextOnboardingStep()   — FSM next-step resolver
│                        #   generateUUID() / generateUUIDv7()
│                        #   toValidUUID()             — RFC4122 compliance fixer
│
└── README.md            # Store-level documentation
```

---

## `src/persona` — Clinical Context Engine

```
src/persona/
│
├── PersonaManager.ts        # Singleton persona registry
│                            #   loadPersona(rawData) — loads + parses patient data
│                            #   getSection(name) → { summary, risks, recommendations }
│                            #   getRawPersona() — returns raw patient JSON
│                            #   Supported sections: identity, clinical_context,
│                            #   lab_results_profile, medications_profile, cgm_profile,
│                            #   glucometer_profile, nutrition_profile, symptoms_profile,
│                            #   face_scan_profile, activity_profile,
│                            #   blood_pressure_profile, weight_and_composition_profile,
│                            #   care_team
│
├── PersonaContextBuilder.ts # Assembles formatted clinical context block
│                            #   for injection into the Gemini system prompt.
│                            #   Prioritises sections relevant to the user query.
│
├── safeGet.ts               # Null-safe getter utility for deeply nested persona fields
│
├── patientMock.ts           # Full mock patient record (schema v2.0.0)
│                            #   Used for development/testing without a live backend.
│                            #   Patient: Neha Aggarwal, 37F, gestational diabetes.
│
├── runTests.ts              # CLI test suite for all 13 parsers + safeGet utility
│                            #   Run: npx tsx src/persona/runTests.ts
│
└── parsers/                 # 13 individual clinical data parsers
    ├── identity.parser.ts        # Name, age, BMI, anthropometry
    ├── clinical.parser.ts        # Diagnoses, goals, allergies, comorbidities
    ├── labs.parser.ts            # HbA1c, lipids, thyroid, hematology, kidney
    ├── medication.parser.ts      # Active meds, adherence rates
    ├── cgm.parser.ts             # CGM TIR, average glucose, sensor status
    ├── glucometer.parser.ts      # Glucometer readings, flagged highs/lows
    ├── nutrition.parser.ts       # Last meal, macros, glycemic load
    ├── symptoms.parser.ts        # Symptom logs, severity, frequency
    ├── facescan.parser.ts        # HRV, stress index, risk scores, wellness
    ├── activity.parser.ts        # Steps, active minutes, HealthKit data
    ├── bloodpressure.parser.ts   # BP readings, trend analysis
    ├── weight.parser.ts          # Weight, BMI, body composition
    └── careteam.parser.ts        # Assigned doctor, program, consultation history
```

---

## `src/hooks` — Custom React Hooks

```
src/hooks/
└── useWakeLock.ts     # Screen Wake Lock API wrapper
                       #   Prevents device sleep during voice assistant sessions.
                       #   Gracefully degrades on unsupported browsers.
```

---

## `src/lib` — Server-Side Clients

```
src/lib/
├── redis.ts           # ioredis client singleton
│                      #   Connects via REDIS_URL env var.
│                      #   Used by all /api/session/* and /api/chat/* routes.
│
└── syncWorker.ts      # Background message sync worker
                       #   Batch-processes Redis message queues →
                       #   submits to backend API in bulk.
```

---

## `src/utils` — Utilities

```
src/utils/
└── analytics.ts       # Umami analytics event wrapper
                       #   captureAnalyticsEvent(name, props) — fires events
                       #   to the Umami instance configured by
                       #   NEXT_PUBLIC_UMAMI_WEBSITE_ID.
                       #
                       #   Tracked events include:
                       #     chat_started, message_sent, onboarding_step_*,
                       #     persona_loaded, voice_session_started,
                       #     cta_clicked, theme_toggled, verification_success
```

---

## `src/constants` — Shared Constants

```
src/constants/
└── validationErrors.ts  # Shared validation error message strings
                         #   Consumed by /api/validate and chatStore.
```

---

## `src/types` — Global TypeScript Types

```
src/types/
└── next-server.d.ts    # Ambient type declarations for Next.js server runtime
```

---

## `docs/` — Internal Documentation

```
docs/
├── chat_flow_documentation.md      # Full chat lifecycle and onboarding FSM docs
├── fallback_mechanism.md           # [FALLBACK_TO_MONGO] pattern and MongoDB agent docs
├── lead_capture_validation.md      # Lead extraction, qualification, and submission flow
├── redis_sync_batching.md          # Redis session sync strategy and debounce logic
└── umami_events_tracking.md        # Complete Umami analytics event reference
```

---

## Infrastructure

### Docker Compose (`docker-compose.yml`)

| Service | Image | Port | Role |
|---|---|---|---|
| `yhealth-frontend` | Custom Dockerfile | `3000` | Next.js standalone production server |
| `yhealth-redis` | `redis:7-alpine` | `6379` | Session cache, message queue, lead dedup store |

**Redis persistence:** `redis-server --appendonly yes` with a named volume `redis-data`.

### Dockerfile (Multi-stage)

| Stage | Base | Purpose |
|---|---|---|
| `builder` | `node:20-slim` | Installs deps, runs `npm run build`, produces `.next/standalone` |
| `runner` | `node:20-slim` | Copies standalone output, runs as non-root `nextjs` user |

---

## Architecture Diagrams

### Request Flow — Chat Message

```
User types message
      │
      ▼
ChatInput.tsx → sendMessage() [chatStore.ts]
      │
      ├─ Save to localStorage (immediate)
      ├─ Sync to Redis via /api/session/save (debounced 5s)
      │
      ▼
processMessageContent() [chatStore.ts]
      │
      ├─── isLikelyGibberish? → Error message
      │
      ├─── isVerified / onboarding completed?
      │       └── fetchGeminiResponse() → Streaming bot reply
      │
      └─── Onboarding active:
              │
              ├─ extractOnboardingEntities() → /api/extract → Gemini JSON
              │   (profanity guard fires first, bypasses LLM)
              │
              ├─ Scenario 1: Health query → fetchGeminiResponse() + repeat question
              ├─ Scenario 2: Validation error (non-greeting) → error message + re-ask
              ├─ Scenario 3: Greeting → fetchGreetingResponse() + re-ask name
              ├─ Scenario 4: Valid entity → advance FSM step
              └─ Scenario 5: Fallback → "I didn't get that" + re-ask
```

### Onboarding State Machine

```
not_started
    │ (first message / greeting)
    ▼
asked_name ──────────────────────────────────────────────► [invalid / retry]
    │ (valid name extracted)
    ▼
asked_age ───────────────────────────────────────────────► [invalid / retry]
    │
    ▼
asked_gender ────────────────────────────────────────────► [invalid / retry]
    │
    ▼
asked_phone ─────────────────────────────────────────────► [invalid / retry]
    │
    ▼
asked_goal ──────────────────────────────────────────────► [invalid / retry]
    │
    ▼
asked_conditions ────────────────────────────────────────► [invalid / retry]
    │
    ▼
asked_feeling ───────────────────────────────────────────► [invalid / retry]
    │
    ▼
completed → Lead submitted to backend → Full LLM chat mode
```

### Clinical Persona System

```
VerificationPanel (OTP verified)
    │
    ▼
restoreExistingUser(name, phone, personaData, sessionId)
    │
    ├── PersonaManager.loadPersona(personaData)
    │       └── Runs all 13 parsers → section cache
    │
    └── fetchGeminiResponse()
            │
            └── PersonaContextBuilder.buildContext(query, manager)
                    └── Injects relevant sections into system prompt
                            └── Gemini responds with clinical awareness
```

---

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Client + Server | Google Gemini REST API authentication |
| `NEXT_PUBLIC_BACKEND_URL` | Client + Server | FastAPI backend base URL |
| `NEXT_PUBLIC_APP_NAME` | Client | App display name (branding) |
| `NEXT_PUBLIC_APP_ENV` | Client | Environment flag (`development`/`production`) |
| `REDIS_URL` | Server only | Redis connection string (e.g. `redis://redis:6379`) |
| `LANGFUSE_SECRET_KEY` | Server only (`/api/trace`) | Langfuse tracing authentication |
| `LANGFUSE_PUBLIC_KEY` | Server only (`/api/trace`) | Langfuse project identification |
| `LANGFUSE_BASE_URL` | Server only (`/api/trace`) | Langfuse host (`https://us.cloud.langfuse.com`) |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Client | Umami analytics site ID |

> **Security note:** All keys with `NEXT_PUBLIC_` prefix are exposed to the browser bundle. `LANGFUSE_SECRET_KEY`, `REDIS_URL` and server-only keys are never sent to the client — they are consumed exclusively in Next.js API routes.
