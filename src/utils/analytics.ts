export type AnalyticsEvent = 
  | 'landing_view'
  | 'get_started_clicked'
  | 'home_loaded'
  | 'feature_selected'
  | 'patient_restore_banner_shown'
  | 'verify_mobile_clicked'
  | 'otp_sent'
  | 'patient_verified'
  | 'patient_verification_failed'
  | 'message_composing_started'
  | 'message_sent'
  | 'voice_opened'
  | 'voice_recording_started'
  | 'voice_recording_completed'
  | 'voice_session_started'
  | 'voice_session_ended'
  | 'upload_clicked'
  | 'file_uploaded'
  | 'report_analysis_started'
  | 'report_generated'
  | 'chat_started'
  | 'first_ai_response'
  | 'session_completed'
  | 'persona_loaded'
  | 'card_click'
  | 'first_message'
  | 'consultation_booked'
  | 'program_activated'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'theme_toggled'
  | 'sidebar_toggled'
  | 'chat_created';

export interface AnalyticsPayload {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  program?: string;
  persona?: string;
  [key: string]: any;
}

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, any>) => void;
    };
  }
}

/**
 * Capture and record analytical events with prominent console logging badges
 * and dispatch them directly to Umami Cloud analytics.
 */
export function captureAnalyticsEvent(event: AnalyticsEvent, payload: AnalyticsPayload = {}) {
  // Try retrieving UTM parameters from sessionStorage if not explicitly passed
  let utm_source = payload.utm_source;
  let utm_medium = payload.utm_medium;
  let utm_campaign = payload.utm_campaign;
  let utm_content = payload.utm_content;

  if (typeof window !== 'undefined') {
    utm_source = utm_source || sessionStorage.getItem('utm_source');
    utm_medium = utm_medium || sessionStorage.getItem('utm_medium');
    utm_campaign = utm_campaign || sessionStorage.getItem('utm_campaign');
    utm_content = utm_content || sessionStorage.getItem('utm_content');
  }

  const finalPayload = {
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    utm_content: utm_content || null,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Beautiful stylized console badges
  const badgeStyles: Record<string, string> = {
    landing_view: 'background: #6366f1; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    get_started_clicked: 'background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    home_loaded: 'background: #0ea5e9; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    feature_selected: 'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    patient_restore_banner_shown: 'background: #eab308; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    verify_mobile_clicked: 'background: #ca8a04; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    otp_sent: 'background: #f97316; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    patient_verified: 'background: #22c55e; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    patient_verification_failed: 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    message_composing_started: 'background: #a855f7; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    message_sent: 'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    voice_opened: 'background: #db2777; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    voice_recording_started: 'background: #ec4899; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    voice_recording_completed: 'background: #be185d; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    voice_session_started: 'background: #db2777; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #be185d;',
    voice_session_ended: 'background: #4b5563; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    upload_clicked: 'background: #06b6d4; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    file_uploaded: 'background: #0891b2; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    report_analysis_started: 'background: #14b8a6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    report_generated: 'background: #0f766e; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    chat_started: 'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    first_ai_response: 'background: #84cc16; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    session_completed: 'background: #15803d; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    persona_loaded: 'background: #6366f1; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    onboarding_step_completed: 'background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    onboarding_completed: 'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #047857;',
    theme_toggled: 'background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    sidebar_toggled: 'background: #6b7280; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    chat_created: 'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #1d4ed8;',
  };

  const currentStyle = badgeStyles[event] || 'background: #6b7280; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;';

  console.log(
    `%c[Analytics Event: ${event.toUpperCase()}]`,
    currentStyle,
    finalPayload
  );

  // Dispatch to Umami Cloud Analytics global tracking instance if available
  if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
    window.umami.track(event, finalPayload);
  }
}
