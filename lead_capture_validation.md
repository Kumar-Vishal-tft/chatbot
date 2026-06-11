# Lead Capture & Onboarding Validation Logic

> **Files involved:**
> - `src/components/LeadCaptureCard.tsx` — UI card form (Name + Phone)
> - `src/store/chatStore.ts` — Conversational 7-step onboarding state machine
> - `src/store/api.ts` — `verifyUserData()` LLM validation connector with fallback heuristics
> - `src/app/api/validate/route.ts` — Unified `POST /api/validate` route handler using Gemini 2.5 Flash
> - `src/constants/validationErrors.ts` — Centralized standard validation error messages

---

## Table of Contents

1. [Unified Validation Architecture](#unified-validation-architecture)
2. [Lead Capture Card — 2-Step Form](#1-lead-capture-card--2-step-form)
   - [Step Flow](#step-flow)
   - [Name Validation](#name-validation)
   - [Phone Validation](#phone-validation)
3. [Conversational Onboarding — 7-Step Validation](#2-conversational-onboarding--7-step-validation)
   - [Step 1 — Name (`asked_name`)](#step-1--name-asked_name)
   - [Step 2 — Age (`asked_age`)](#step-2--age-asked_age)
   - [Step 3 — Gender (`asked_gender`)](#step-3--gender-asked_gender)
   - [Step 4 — Phone (`asked_phone`)](#step-4--phone-asked_phone)
   - [Step 5 — Health Goal (`asked_goal`)](#step-5--health-goal-asked_goal)
   - [Step 6 — Medical Conditions (`asked_conditions`)](#step-6--medical-conditions-asked_conditions)
   - [Step 7 — Feeling Note (`asked_feeling`)](#step-7--feeling-note-asked_feeling)
4. [Centralized Error Messages](#centralized-error-messages)
5. [Fallback & Resiliency Protocol](#fallback--resiliency-protocol)

---

## Unified Validation Architecture

All validation is powered by a central API endpoint `POST /api/validate` that executes prompt templates on Gemini 2.5 Flash. The prompts return structured JSON:

```json
{
  "valid": boolean,
  "normalized": string,
  "reason": string
}
```

To ensure bulletproof reliability:
- Calls to the endpoint are capped at a **3-second timeout**.
- If a timeout or server error occurs, the system automatically falls back to **local regex/heuristic validators** defined in `verifyUserData()`.
- On validation failures, errors are standardly formatted and logged to server-side logs.
- If the user asks a medical or health query mid-onboarding, the LLM sets `reason: "health_question"`. The assistant answers the question, then re-asks the pending onboarding question.

---

## 1. Lead Capture Card — 2-Step Form

The `LeadCaptureCard` is a **2-step sequential UI form** collecting **Name** and **Phone number** (email has been removed).

### Step Flow

```
Step 0 → Name (LLM Validated)
Step 1 → Phone (LLM Validated)
         ↓
      Completion → onComplete(LeadData) callback fired
```

- When validating, the **Continue / Get Started** button displays a loading spinner and disables both input and button interactions.
- If the validation API is unreachable or fails, the card falls back to local name and phone regexes.

---

### Name Validation

- **Prompt Rules:** Must be a real human name. Min 2 chars. No digits, no symbols. Reject single letters and health questions.
- **Normalized Output:** Capitalized name (e.g. `"vishal"` → `"Vishal"`).
- **Error message:** `Please enter your real first name (at least 2 letters).`

---

### Phone Validation

- **Prompt Rules:** Validate Indian (10-digit starting 6-9, with/without 0 or 91 prefix) or international (`+XX...`). Strip spaces/dashes before validation.
- **Normalized Output:** Clean digits-only string (e.g., `"98765 43210"` → `"9876543210"`) or standard international format.
- **Error message:** `Please enter a valid mobile number.`

---

## 2. Conversational Onboarding — 7-Step Validation

Conversational onboarding runs in `chatStore.ts`. The state progression is:

```
not_started → asked_name → asked_age → asked_gender → asked_phone
            → asked_goal → asked_conditions → asked_feeling → completed
```

---

### Step 1 — Name (`asked_name`)
- **LLM Prompt Rules:** Must be a real name. Min 2 chars. No digits or symbols.
- **Error Behavior:** If invalid format, returns standard error. If health question, answers and re-asks.
- **Standard Error:** `VALIDATION_ERRORS.name`

### Step 2 — Age (`asked_age`)
- **LLM Prompt Rules:** Must be an age between 5 and 110. Accepts written numbers (e.g., `"twenty two"`).
- **Normalized Output:** Integer string (e.g., `"22"`).
- **Standard Error:** `VALIDATION_ERRORS.age`

### Step 3 — Gender (`asked_gender`)
- **LLM Prompt Rules:** Maps any natural phrasing (e.g. `"I'm a guy"`, `"she/her"`, `"skip"`) to one of: `Male`, `Female`, `Prefer not to say`.
- **Standard Error:** `VALIDATION_ERRORS.gender`

### Step 4 — Phone (`asked_phone`)
- **LLM Prompt Rules:** Cleans and validates Indian and international numbers.
- **Standard Error:** `VALIDATION_ERRORS.phone`

### Step 5 — Health Goal (`asked_goal`)
- **LLM Prompt Rules:** Maps natural language input to one or more of these 12 goals:
  `[Weight loss, Diabetes, Blood reports, Nutrition, Fitness, General wellness, Hypertension, GLP-1, Metabolic, Sexual Wellness, Mental Wellness, Longevity]`
- **Normalized Output:** Comma-separated matched goals (e.g. `"Fitness, Nutrition"`).
- **Standard Error:** `VALIDATION_ERRORS.goal`

### Step 6 — Medical Conditions (`asked_conditions`)
- **LLM Prompt Rules:** Maps natural language to one or more of:
  `[None, Diabetes, Hypertension, Asthma, Obesity, Metabolic health]`
- **Normalized Output:** Comma-separated matched conditions or `"None"`.
- **Standard Error:** `VALIDATION_ERRORS.conditions`

### Step 7 — Feeling Note (`asked_feeling`)
- **LLM Prompt Rules:** Must be between 2 and 500 characters. Rejects XSS script/HTML tags and gibberish repeats.
- **Standard Error:** `VALIDATION_ERRORS.feeling`

---

## Centralized Error Messages

Standard errors are exported from `src/constants/validationErrors.ts`:

```ts
export const VALIDATION_ERRORS = {
  name:        'Please enter your real first name (at least 2 letters).',
  age:         'Please enter a valid age between 5 and 110.',
  gender:      'Please select Male, Female, or Prefer not to say.',
  phone:       'Please enter a valid mobile number.',
  goal:        'Please describe your health goal — e.g. weight loss, diabetes, fitness.',
  conditions:  'Please mention any medical conditions, or type "None".',
  feeling:     'Please share how you\'re feeling (2–500 characters).',
};
```

---

## Fallback & Resiliency Protocol

When the LLM endpoint times out (>3 seconds) or errors:
1. **Warning Logged:** Server-side warning `[VALIDATION FAILURE]` details the step, input, and failure cause.
2. **Local Heuristics Run:** The application falls back to regex and string-matching routines inside `verifyUserData`:
   - **Name:** Checks `length >= 2 && length <= 30`, no digits, no profanity.
   - **Age:** Parses digits and checks `age >= 5 && age <= 110`.
   - **Gender:** Standardizes `m`/`male` → `Male`, `f`/`female` → `Female`, `prefer not to say`/`skip` → `Prefer not to say`.
   - **Phone:** Local multi-branch regex check.
   - **Goal & Conditions:** Substring and keyword alias lookup.
   - **Feeling:** Sanitizes script tags `/ <[^>]*> /g` and checks length (2 to 500 characters).
3. **Graceful UI Transition:** The user is never blocked and can progress through onboarding seamlessly.
