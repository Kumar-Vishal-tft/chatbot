# Umami Events Tracking Documentation

This document provides a comprehensive catalog of all analytics events tracked in the YHealth UI Chatbot frontend and dispatched to **Umami Cloud Analytics**.

---

## Architecture & Setup

### 1. Script Injection
The Umami tracking script is conditionally injected in the root layout if the environment variable `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is defined.
* **Script Source:** `https://cloud.umami.is/script.js`
* **File Location:** [layout.tsx](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/layout.tsx#L50-L56)

### 2. Global Dispatch Helper
All events are funneled through the central `captureAnalyticsEvent` utility function located in [analytics.ts](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/utils/analytics.ts#L58-L126). 
* It automatically appends **UTM Parameters** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) extracted from URL/sessionStorage to the payload.
* It prints stylized, color-coded badges to the browser console during development mode to facilitate event debugging.
* Finally, it checks if `window.umami.track` is available and dispatches the event.

---

## Tracked Events Reference

### 1. Navigation & System Events

#### `landing_view`
* **Source:** [page.tsx:L183](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L183)
* **Trigger:** Fired immediately on component mount (landing page load) to track traffic entry points.
* **Payload:**
  ```json
  {
    "utm_source": "string | null",
    "utm_medium": "string | null",
    "utm_campaign": "string",
    "utm_content": "string | null",
    "utm_term": "string | null",
    "program": "string",
    "persona": "string"
  }
  ```

#### `home_loaded`
* **Source:** [page.tsx:L273](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L273)
* **Trigger:** Fired when the main chat workspace stage is successfully rendered/loaded.
* **Payload:** None (inherits global UTM parameters).

#### `theme_toggled`
* **Source:** [chatStore.ts:L64](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L64)
* **Trigger:** Fired when the user switches between light and dark modes.
* **Payload:**
  ```json
  {
    "theme": "light | dark"
  }
  ```

#### `sidebar_toggled`
* **Source:** [chatStore.ts:L72](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L72)
* **Trigger:** Fired when the chat sidebar expansion is toggled.
* **Payload:**
  ```json
  {
    "expanded": "boolean"
  }
  ```

---

### 2. User Engagement & Chat Lifecycle Events

#### `get_started_clicked`
* **Source:** [page.tsx:L295](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L295)
* **Trigger:** Fired when the user clicks the "Get Started" CTA button on the splash/welcome screen.
* **Payload:**
  ```json
  {
    "tenant": "yhealth",
    "session_type": "anonymous",
    "utm_campaign": "string | null",
    "utm_source": "string | null",
    "utm_medium": "string | null",
    "utm_content": "string | null",
    "utm_term": "string | null"
  }
  ```

#### `feature_selected`
* **Source:** [PromptCards.tsx:L135](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/PromptCards.tsx#L135)
* **Trigger:** Fired when the user selects a quick suggested prompt action card.
* **Payload:**
  ```json
  {
    "feature": "analyze_report | check_symptoms | diet_guidance | general_health",
    "utm_campaign": "string",
    "persona": "string",
    "program": "string",
    "card_title": "string"
  }
  ```

#### `chat_created`
* **Source:** [chatStore.ts:L193](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L193)
* **Trigger:** Fired when a new chat session is generated in the store.
* **Payload:**
  ```json
  {
    "initial_message_present": "boolean"
  }
  ```

#### `chat_started`
* **Source:** [chatStore.ts:L289](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L289)
* **Trigger:** Fired when the first message is sent in a newly created chat session.
* **Payload:** None.

#### `message_composing_started`
* **Source:** [ChatInput.tsx:L532](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/ChatInput.tsx#L532)
* **Trigger:** Fired the moment a user begins typing in the chat input text box.
* **Payload:** None.

#### `message_sent`
* **Source:** [chatStore.ts:L281](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L281)
* **Trigger:** Fired each time a user message is sent to the backend/AI.
* **Payload:**
  ```json
  {
    "length": "number", // Length of the character text sent
    "persona": "string" // Active health assistant persona
  }
  ```

#### `first_ai_response`
* **Source:** [chatStore.ts:L690](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L690)
* **Trigger:** Fired when the first AI assistant reply is loaded/streamed in the chat.
* **Payload:** None.

#### `report_generated`
* **Source:** [chatStore.ts:L693](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L693)
* **Trigger:** Fired when the AI assistant returns a response that includes the term "report".
* **Payload:** None.

---

### 3. Patient Onboarding & Personalization

#### `persona_loaded`
* **Source:** [page.tsx:L194](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L194)
* **Trigger:** Fired on mount when the specific persona configuration is loaded for the user's UTM campaign.
* **Payload:**
  ```json
  {
    "persona": "string",
    "campaign": "string"
  }
  ```

#### `patient_restore_banner_shown`
* **Source:** [page.tsx:L280](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L280)
* **Trigger:** Fired when the floating "Existing Patient?" banner/card is shown to unverified visitors.
* **Payload:** None.

#### `verify_mobile_clicked`
* **Source:** [page.tsx:L629](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L629), [page.tsx:L657](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L657)
* **Trigger:** Fired when the user clicks the "Verify Mobile Number" action button to trigger verification.
* **Payload:** None.

#### `onboarding_step_completed`
* **Source:** [chatStore.ts:L620](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L620)
* **Trigger:** Fired when the user successfully answers a personal clinical profiling step (e.g., name, age, goal).
* **Payload:**
  ```json
  {
    "step": "asked_name | asked_age | asked_gender | asked_phone | asked_goal | asked_conditions | asked_feeling",
    "next_step": "string | 'completed'"
  }
  ```

#### `onboarding_completed`
* **Source:** [chatStore.ts:L625](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L625)
* **Trigger:** Fired when the final onboarding registration step is completed and lead details are persisted.
* **Payload:**
  ```json
  {
    "age": "string",
    "gender": "string",
    "health_goal": "string"
  }
  ```

---

### 4. OTP & Verification Flow

#### `otp_sent`
* **Source:** [VerificationPanel.tsx:L164](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VerificationPanel.tsx#L164), [VerificationPanel.tsx:L174](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VerificationPanel.tsx#L174)
* **Trigger:** Fired when an OTP code is successfully generated and sent to the patient's phone.
* **Payload:** None.

#### `patient_verified`
* **Source:** [VerificationPanel.tsx:L293](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VerificationPanel.tsx#L293)
* **Trigger:** Fired when the user submits a correct OTP and is authenticated as a registered patient.
* **Payload:** None.

#### `patient_verification_failed`
* **Source:** [VerificationPanel.tsx:L243](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VerificationPanel.tsx#L243), [VerificationPanel.tsx:L307](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VerificationPanel.tsx#L307)
* **Trigger:** Fired when the OTP code is rejected or verification fails due to internal errors.
* **Payload:**
  ```json
  {
    "reason": "string" // e.g. "Blocked Demo OTP Code" or details of the network error
  }
  ```

---

### 5. Media & Uploads

#### `upload_clicked`
* **Source:** [page.tsx:L653](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/app/page.tsx#L653)
* **Trigger:** Fired when the user clicks the upload attachment icon in the chat bar.
* **Payload:** None.

---

### 6. Voice Assistant Events

#### `voice_opened`
* **Source:** [ChatInput.tsx:L223](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/ChatInput.tsx#L223)
* **Trigger:** Fired when the user taps the mic icon to activate the real-time Voice Assistant panel.
* **Payload:** None.

#### `voice_session_started`
* **Source:** [VoiceAssistantPanel.tsx:L408](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VoiceAssistantPanel.tsx#L408)
* **Trigger:** Fired when the live audio connection to the Gemini Live session is successfully established.
* **Payload:** None.

#### `voice_recording_started`
* **Source:** [VoiceAssistantPanel.tsx:L173](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VoiceAssistantPanel.tsx#L173)
* **Trigger:** Fired when the web microphone media stream starts recording user voice.
* **Payload:** None.

#### `voice_recording_completed`
* **Source:** [VoiceAssistantPanel.tsx:L145](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VoiceAssistantPanel.tsx#L145)
* **Trigger:** Fired when the recording stream is closed/stopped.
* **Payload:** None.

#### `voice_session_ended`
* **Source:** [VoiceAssistantPanel.tsx:L158](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/components/VoiceAssistantPanel.tsx#L158)
* **Trigger:** Fired when the Voice Assistant panel is dismissed or closed.
* **Payload:**
  ```json
  {
    "duration_seconds": "number" // Total duration of the live voice session
  }
  ```

---

### 7. Attribution & Activation Events

#### `consultation_booked`
* **Source:** [chatStore.ts:L902](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L902)
* **Trigger:** Fired when the user triggers the primary attribution program CTA (e.g. booking a consultation/session).
* **Payload:**
  ```json
  {
    "utm_campaign": "string",
    "persona": "string",
    "program": "string",
    "cta_text": "string"
  }
  ```

#### `program_activated`
* **Source:** [chatStore.ts:L909](file:///home/vishal_kumar/Desktop/yhealth-UI-chatbot/frontend/src/store/chatStore.ts#L909)
* **Trigger:** Fired in lockstep with the attribution program activation trigger.
* **Payload:**
  ```json
  {
    "utm_campaign": "string",
    "persona": "string",
    "program": "string",
    "cta_text": "string"
  }
  ```

---

## Declared but Unused Events

The following event types are registered under the `AnalyticsEvent` type definition in `analytics.ts` but are currently **not triggered** anywhere within the codebase:

1. `file_uploaded`
2. `report_analysis_started`
3. `session_completed`
4. `card_click` (replaced by `feature_selected` logic)
5. `first_message` (replaced by `chat_started` logic)
