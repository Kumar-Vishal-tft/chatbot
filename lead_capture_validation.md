# Lead Capture & Onboarding Validation Logic

> **Files involved:**
> - `src/components/LeadCaptureCard.tsx` — UI card form (Name + Phone)
> - `src/store/chatStore.ts` — Conversational 7-step onboarding state machine

---

## Table of Contents

1. [Lead Capture Card — 2-Step Form](#1-lead-capture-card--2-step-form)
   - [Step Flow](#step-flow)
   - [Step 1 — Name](#step-1--name)
   - [Step 2 — Phone](#step-2--phone)
   - [Validation Triggers](#validation-triggers)
   - [Error Display](#error-display)
   - [On Completion](#on-completion)
2. [Conversational Onboarding — 7-Step Validation](#2-conversational-onboarding--7-step-validation)
   - [Step 1 — Name (asked_name)](#step-1--name-asked_name)
   - [Step 2 — Age (asked_age)](#step-2--age-asked_age)
   - [Step 3 — Gender (asked_gender)](#step-3--gender-asked_gender)
   - [Step 4 — Phone (asked_phone)](#step-4--phone-asked_phone)
   - [Step 5 — Health Goal (asked_goal)](#step-5--health-goal-asked_goal)
   - [Step 6 — Medical Conditions (asked_conditions)](#step-6--medical-conditions-asked_conditions)
   - [Step 7 — Feeling Note (asked_feeling)](#step-7--feeling-note-asked_feeling)
   - [On Onboarding Completion](#on-onboarding-completion)
   - [Full State Machine](#full-state-machine)

---

## 1. Lead Capture Card — 2-Step Form

The `LeadCaptureCard` is a **2-step sequential UI form** that collects a new user's **Name** and **Phone number** before they can begin chatting. Each step validates on **Continue / Get Started** button click or **Enter** key press.

### Step Flow

```
Step 0 → Name
Step 1 → Phone
         ↓
      Completion  →  onComplete(LeadData) callback fired
```

Progress is tracked via a `step` state variable (`0–1`). On passing validation, `step` increments. On the final step, collected data is packaged into a `LeadData` object and persisted.

---

### Step 1 — Name

| Property    | Value       |
|-------------|-------------|
| Input type  | `text`      |
| Input mode  | `text`      |
| Placeholder | `Your name…` |

**Validation Rule:**

```ts
v.trim().length >= 2
  ? null                                    // ✅ Valid
  : 'Please enter at least 2 characters.'  // ❌ Error
```

**Behaviour:**
- Strips leading/trailing whitespace before checking.
- Minimum **2 characters** required.
- No character type restriction — accepts any Unicode name.

**Error message:** `Please enter at least 2 characters.`

---

### Step 2 — Phone

| Property    | Value              |
|-------------|--------------------|
| Input type  | `tel`              |
| Input mode  | `tel`              |
| Placeholder | `+91 98765 43210`  |

**Validation Rule (multi-branch):**

```ts
const digits = v.replace(/\D/g, '');          // strip all non-digits
const startsWithPlus = v.trim().startsWith('+');

if (digits.length === 10)
  isPhoneValid = /^[6-9]\d{9}$/.test(digits); // Indian mobile (starts 6–9)

else if (digits.length === 11)
  isPhoneValid = /^0[6-9]\d{9}$/.test(digits); // STD format: 0XXXXXXXXXX

else if (digits.length === 12)
  isPhoneValid = /^91[6-9]\d{9}$/.test(digits); // Country code: 91XXXXXXXXXX

else if (startsWithPlus)
  isPhoneValid = digits.length >= 10 && digits.length <= 15; // International
```

**Accepted formats:**

| Format                  | Example           | Valid?                  |
|-------------------------|-------------------|-------------------------|
| 10-digit Indian         | `9876543210`      | ✅ (must start with 6–9) |
| 11-digit with 0 prefix  | `09876543210`     | ✅                       |
| 12-digit with 91 prefix | `919876543210`    | ✅                       |
| International `+`       | `+447911123456`   | ✅ (10–15 digits)        |
| Starts with 0–5 (India) | `5876543210`      | ❌                       |
| Too short / too long    | `12345`           | ❌                       |

**Error message:** `Please enter a valid mobile number.`

---

### Validation Triggers

Validation runs in three ways:

**1. Button Click**
```ts
const handleContinue = () => {
  const val = values[current.key];
  const err = current.validate(val);
  if (err) { setError(err); return; }   // show inline error, block progress
  setError(null);
  if (step < STEPS.length - 1) {
    setStep(s => s + 1);                // advance to next step
  } else {
    // final step — trigger completion
  }
};
```

**2. Enter Key**
```ts
const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') handleContinue();
};
```

**3. Error Auto-clear on Typing**
```ts
const handleChange = (e) => {
  setValues(prev => ({ ...prev, [current.key]: val }));
  if (error) setError(null);  // clears error as soon as user starts typing
};
```

---

### Error Display

Errors render as an **inline animated message** directly below the input using Framer Motion:

```tsx
<AnimatePresence>
  {error && (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      style={{ color: '#ef4444' }}
    >
      {error}
    </motion.p>
  )}
</AnimatePresence>
```

The input **border turns red** (`rgba(239, 68, 68, 0.55)`) when an error is active.

---

### On Completion

Once both steps pass validation:

```ts
const lead: LeadData = {
  name:      values.name,
  phone:     values.phone,
  timestamp: new Date().toISOString(),
  device:    /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
  source:    window.location.href,
};

localStorage.setItem('yhealth_lead_v1', JSON.stringify(lead));
setTimeout(() => onComplete(lead), 1400);  // 1.4s delay for success animation
```

The `LeadData` object is:

| Field       | Source                            | Purpose                              |
|-------------|-----------------------------------|--------------------------------------|
| `name`      | User input (Step 1)               | Personalization                      |
| `phone`     | User input (Step 2)               | Contact & identity                   |
| `timestamp` | `new Date().toISOString()`        | Lead tracking                        |
| `device`    | `navigator.userAgent`             | Analytics (`mobile` / `desktop`)     |
| `source`    | `window.location.href`            | Attribution (UTM page URL)           |

**After completion:**
- Persisted to `localStorage` under key `yhealth_lead_v1` for session restore.
- Passed to `onComplete()` callback — triggers backend lead submission and chat start.

---

## 2. Conversational Onboarding — 7-Step Validation

These steps run **inside the chat conversation** via `chatStore.ts`. The bot guides the user through 7 sequential fields using the state machine:

```
not_started → asked_name → asked_age → asked_gender → asked_phone
           → asked_goal → asked_conditions → asked_feeling → completed
```

Each step uses one of three validator types:
- **LLM-assisted** — `verifyUserData()` call to Gemini
- **Keyword matching** — local dictionary lookup
- **Regex / string normalization** — pure client-side check

> [!NOTE]
> At **any step**, if the user sends a greeting (`hi`, `hello`, etc.), the bot responds naturally and re-appends the active onboarding question — **progress is never lost**.

---

### Step 1 — Name (`asked_name`)

**Validator:** `verifyUserData('asked_name', content)` — LLM-assisted

| Outcome             | Condition                        | Bot Response                                                                 |
|---------------------|----------------------------------|------------------------------------------------------------------------------|
| ✅ Valid            | LLM confirms it's a name         | Stores name → advances to `asked_age`                                        |
| ❌ Health question  | LLM detects a health query       | Answers the health question first, then re-asks: *"What should I call you?"* |
| ❌ Invalid          | Anything else (gibberish, etc.)  | *"That doesn't look like a name I can use. Could you share your first name?"* |

**First-message trigger patterns:**
- `"my name is..."`, `"I am..."`, `"call me..."`, `"introducing myself..."`
- OR: a 1–2 word input that is not a greeting or health keyword

---

### Step 2 — Age (`asked_age`)

**Validator:** `verifyUserData('asked_age', content)` — LLM-assisted

| Outcome             | Condition                        | Bot Response                                                              |
|---------------------|----------------------------------|---------------------------------------------------------------------------|
| ✅ Valid            | LLM confirms a valid age number  | Stores age → advances to `asked_gender`                                   |
| ❌ Health question  | LLM detects a health query       | Answers the question, then re-asks: *"How old are you?"*                  |
| ❌ Invalid          | Non-numeric or out-of-range      | *"Please share a valid age — just a number works great!"*                  |

---

### Step 3 — Gender (`asked_gender`)

**Validator:** Client-side string normalization — no LLM call

```ts
const normalized = content.trim().toLowerCase();

'male'  or 'm'                              → 'Male'
'female' or 'f'                             → 'Female'
includes 'not to say' or includes 'prefer'  → 'Prefer not to say'
'skip'                                      → 'Prefer not to say'
```

**Accepted inputs:**

| Input                             | Parsed As          |
|-----------------------------------|--------------------|
| `male`, `m`                       | Male               |
| `female`, `f`                     | Female             |
| `prefer not to say`, `skip`, `prefer` | Prefer not to say |
| Anything else                     | ❌ Re-asks         |

**Suggested prompt chips:** `Male | Female | Prefer not to say`

**On failure:** *"Please select or enter Male, Female, or Prefer not to say."*

---

### Step 4 — Phone (`asked_phone`)

**Validator:** Regex — same multi-branch logic as the LeadCaptureCard

```ts
const cleaned = content.replace(/\D/g, '');

10 digits  → /^[6-9]\d{9}$/          Indian mobile (starts 6–9)
11 digits  → /^0[6-9]\d{9}$/         STD format (0-prefix)
12 digits  → /^91[6-9]\d{9}$/        Country code 91
starts +   → 10–15 total digits       International
```

| Outcome    | Bot Response                                                                   |
|------------|--------------------------------------------------------------------------------|
| ✅ Valid   | Stores phone → advances to `asked_goal`                                        |
| ❌ Invalid | *"That doesn't look like a valid phone number. Please share your 10-digit mobile number."* |

---

### Step 5 — Health Goal (`asked_goal`)

**Validator:** Keyword + substring matching — no LLM call

**Valid goals (12 total):**

`Weight loss` · `Diabetes` · `Blood reports` · `Nutrition` · `Fitness` · `General wellness` · `Hypertension` · `GLP-1` · `Metabolic` · `Sexual Wellness` · `Mental Wellness` · `Longevity`

**Keyword aliases:**

| User types                        | Resolves to      |
|-----------------------------------|------------------|
| `weight`, `loss`                  | Weight loss      |
| `diet`, `food`, `nutrition`       | Nutrition        |
| `fitness`, `exercise`, `gym`, `workout` | Fitness    |
| `diabetic`, `sugar`               | Diabetes         |
| `blood`, `report`, `reports`      | Blood reports    |
| `bp`, `pressure`                  | Hypertension     |
| `glp`, `glp1`, `glp-1`           | GLP-1            |
| `metabolic`, `metabolism`         | Metabolic        |
| `mental`, `stress`, `anxiety`     | Mental Wellness  |
| `sexual`                          | Sexual Wellness  |
| `longevity`, `aging`              | Longevity        |

**Rules:**
- **Multiple goals** are allowed — all matched goals stored as a comma-separated string.
- If **no keyword matches**, re-asks with the full list of options.

---

### Step 6 — Medical Conditions (`asked_conditions`)

**Validator:** Keyword + substring matching — no LLM call

**Valid conditions (6 total):**

`None` · `Diabetes` · `Hypertension` · `Asthma` · `Obesity` · `Metabolic health`

**Keyword aliases:**

| User types                            | Resolves to      |
|---------------------------------------|------------------|
| `none`, `no`, `nothing`, `na`, `n/a`, `nil` | None       |
| `diabetic`, `sugar`                   | Diabetes         |
| `bp`, `pressure`                      | Hypertension     |
| `asthmatic`                           | Asthma           |
| `obese`, `overweight`                 | Obesity          |
| `metabolism`                          | Metabolic health |

**Rules:**
- If `None` is matched → `conditions` stored as `[]` (empty array).
- Multiple conditions can be matched simultaneously.
- If **no keyword matches**, re-asks with the full list.

---

### Step 7 — Feeling Note (`asked_feeling`)

**Validator:** None — **any input is accepted**

```ts
nextProfile.feeling_note = content;  // stored as-is, no validation
```

**Behaviour:**
- User can type a free-text note, or simply say `"N/A"` / `"None"`.
- This is the **final step** — always advances to `completed`.
- A personalized profile summary is displayed immediately after.

---

### On Onboarding Completion

After Step 7 passes, three actions fire in sequence:

```ts
// 1. Persist onboarding profile locally
localStorage.setItem('yhealth_lead_v1', JSON.stringify({
  name:      nextProfile.name,
  timestamp: new Date().toISOString(),
  onboarding: nextProfile,
}));

// 2. Submit lead to backend
POST /api/leads
Body: { session_id, name, age, phone_number, gender, additional_details }

// 3. Sync full chat history
POST /api/leads/{session_id}/session
Body: { history: [{ user: string, agent: string }] }
```

---

### Full State Machine

```
not_started
    │
    ▼  (name detected in first message)
asked_name        ──── LLM: verifyUserData('asked_name')
    │
    ▼  (valid name)
asked_age         ──── LLM: verifyUserData('asked_age')
    │
    ▼  (valid age)
asked_gender      ──── string normalization (male / female / prefer not to say)
    │
    ▼  (valid gender)
asked_phone       ──── regex (Indian 10/11/12-digit or international +)
    │
    ▼  (valid phone)
asked_goal        ──── keyword matching (12 valid goals + aliases)
    │
    ▼  (≥ 1 goal matched)
asked_conditions  ──── keyword matching (6 valid conditions + aliases)
    │
    ▼  (≥ 1 condition matched)
asked_feeling     ──── free text, always valid
    │
    ▼
completed ──── lead submitted to backend (/api/leads + /api/leads/{id}/session)
```

---

### Quick Reference — All Steps

| # | State              | Field             | Validator Type        | Can Skip? | Error Behaviour                     |
|---|--------------------|-------------------|-----------------------|-----------|-------------------------------------|
| 1 | `asked_name`       | Name              | LLM (verifyUserData)  | No        | Re-asks; answers health Qs first    |
| 2 | `asked_age`        | Age               | LLM (verifyUserData)  | No        | Re-asks; answers health Qs first    |
| 3 | `asked_gender`     | Gender            | String normalization  | No        | Re-asks with chips                  |
| 4 | `asked_phone`      | Phone             | Regex                 | No        | Re-asks for valid number            |
| 5 | `asked_goal`       | Health Goal       | Keyword matching      | No        | Re-asks with full goal list         |
| 6 | `asked_conditions` | Medical Conditions| Keyword matching      | No        | Re-asks with full conditions list   |
| 7 | `asked_feeling`    | Feeling Note      | None (free text)      | Yes       | Never fails — any input accepted    |
