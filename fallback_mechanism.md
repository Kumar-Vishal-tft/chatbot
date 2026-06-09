# 🔄 YHealth AI — MongoDB Fallback Mechanism

This document details how the **MongoDB database fallback system** is designed, triggered, and executed when the Google Gemini LLM lacks specific patient data in its active context.

---

## 🏗️ Architectural Flow

When a user submits a message, the system attempts to answer using the local patient context (persona). If the data (such as detailed history, face-scan metrics, or specific labs) is missing, it triggers an automated database fallback.

```mermaid
sequenceDiagram
    autonumber
    actor User as Patient (UI)
    participant Store as Client Store (Zustand)
    participant Gemini as Gemini 2.5 Flash
    participant Proxy as Next.js API Proxy
    participant Backend as FastAPI Backend
    database Mongo as MongoDB

    User->>Store: Send query (e.g. "What was my last face-scan result?")
    Store->>Gemini: Request generation (includes User Query & active Persona)
    Note over Gemini: Checks rule: If query is patient-specific<br/>and data is missing from Persona
    Gemini-->>Store: Returns "[FALLBACK_TO_MONGO]"
    Store->>Proxy: POST /api/agent/query { user_id, query }
    Proxy->>Backend: Forward POST to {BACKEND_URL}/agent/query
    Backend->>Mongo: Query patient records
    Mongo-->>Backend: Return clinical details
    Backend-->>Proxy: Return JSON (answer & analytics details)
    Proxy-->>Store: Return JSON
    Note over Store: Formats fallback context block<br/>and updates system instructions
    Store->>Gemini: Request final generation (includes DB details)
    Gemini-->>Store: Returns natural clinical response
    Store->>User: Display response to Patient
```

---

## ⚙️ Detailed Execution Phases

### Phase 1: Fallback Rule in System Instructions (`src/store/api.ts`)
When a verified, existing patient profile is active (`hasPersona` evaluates to true ONLY if `isExistingPatient` is true), the system appends a set of critical responding rules to the Gemini LLM. Rule #4 directs the LLM to output a unique fallback token if it lacks the clinical context to answer:

> **Rule 4:** If the user's query is asking for extended patient details, previous/historical records, past logs, or older medical reports that are NOT present in the active patient clinical history & context block above, you MUST output exactly `[FALLBACK_TO_MONGO]` as your entire response. Do NOT output anything else. If the query can be answered using the basic patient summary and current details already provided in the context block above, or if it is a general health question, answer it directly.

---

### Phase 2: Client Detection & API Routing
Inside `src/store/api.ts` (`fetchGeminiResponse`), the client retrieves `isExistingPatient` from the Zustand store and checks it alongside the active persona. If the user is a new user, `hasPersona` will be false, and the client will bypass this check entirely:

```typescript
// Retrieve the patient type status from Zustand store
let isExistingPatient = false;
try {
  const { useChatStore } = require('./chatStore');
  isExistingPatient = useChatStore.getState().isExistingPatient;
} catch (e) { }

// Check if we have an active patient persona loaded AND the user is an existing patient
const hasPersona = !!activePersonaManager.getRawPersona() && isExistingPatient;

...

if (trimmed.includes('[FALLBACK_TO_MONGO]') && hasPersona) {
  const rawPersona = activePersonaManager.getRawPersona();
  const userId = rawPersona?._meta?.mongo_patient_id || rawPersona?.identity?.patient_id;

  if (userId) {
    // 1. Call Next.js API Route Proxy
    const agentRes = await fetch('/api/agent/query', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, query: prompt }),
    });
    ...
```

---

### Phase 3: Server Proxy Routing (`src/app/api/agent/query/route.ts`)
The client calls `/api/agent/query`, which is resolved on the Next.js server side. The server proxies the request to the FastAPI backend using `BACKEND_URL` environment variables:

```typescript
export async function POST(request: NextRequest) {
  const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const backendUrl = `${baseUrl.replace(/\/$/, '')}/agent/query`;

  try {
    const body = await request.json();
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data = JSON.parse(text);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    ...
  }
}
```

---

### Phase 4: Secondary Formatting & Generation
If the proxy fetch returns data containing `answer` or `analytics` fields:
1. **Context Block Injection**: A `fallbackContext` markdown block is prepared.
2. **System Prompt Update**: The clinical context header in the system instructions is swapped with the retrieved MongoDB data:
   ```typescript
   const finalInstruction = systemInstruction.replace(
     '### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:',
     `### ACTIVE PATIENT CLINICAL HISTORY & ROUTED CONTEXT:\n${fallbackContext}`
   );
   ```
3. **Conversational Sequence Realignment**: A payload is sent to Gemini where roles alternate cleanly:
   * Previous turns...
   * `user`: User's original prompt
   * `model`: `[Requesting clinical data fallback...]` *(Simulated state transition)*
   * `user`: `Here is the clinical data: <MongoDB data string>`
4. **Final Output**: Gemini produces the warm, natural clinical response containing the requested data.

---

### Phase 5: Resilience & Safety Net
To prevent an infinite loop or returning raw tokens to the user, if the MongoDB request or the secondary Gemini call fails, the client automatically strips the fallback instruction using a regex and retries a direct generation:

```typescript
if (trimmed.includes('[FALLBACK_TO_MONGO]')) {
  const fallbackInstruction = systemInstruction.replace(
    /4\.\s*If the user's query is asking for[\s\S]*?answer it directly\./i,
    ''
  );
  // Retry fetch with fallbackInstruction
}
```
This guarantees the user always receives a response, even if the database proxy times out or fails.
