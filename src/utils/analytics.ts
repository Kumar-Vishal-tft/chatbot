export type AnalyticsEvent = 
  | 'landing_view'
  | 'card_click'
  | 'first_message'
  | 'otp_sent'
  | 'otp_verified'
  | 'consultation_booked'
  | 'program_activated';

export interface AnalyticsPayload {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  program?: string;
  persona?: string;
  [key: string]: any;
}

/**
 * Capture and record analytical events with prominent console logging badges
 */
export function captureAnalyticsEvent(event: AnalyticsEvent, payload: AnalyticsPayload = {}) {
  // Try retrieving UTM parameters from sessionStorage if not explicitly passed
  let utm_source = payload.utm_source;
  let utm_medium = payload.utm_medium;
  let utm_campaign = payload.utm_campaign;

  if (typeof window !== 'undefined') {
    utm_source = utm_source || sessionStorage.getItem('utm_source');
    utm_medium = utm_medium || sessionStorage.getItem('utm_medium');
    utm_campaign = utm_campaign || sessionStorage.getItem('utm_campaign');
  }

  const finalPayload = {
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    program: payload.program || 'metabolic',
    persona: payload.persona || 'metabolic_agent',
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Beautiful stylized console badges
  const badgeStyles = {
    landing_view: 'background: #6366f1; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    card_click: 'background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    first_message: 'background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    otp_sent: 'background: #f59e0b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    otp_verified: 'background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    consultation_booked: 'background: #ec4899; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #db2777;',
    program_activated: 'background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #dc2626;',
  };

  const currentStyle = badgeStyles[event] || 'background: #6b7280; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;';

  console.log(
    `%c[Analytics Event: ${event.toUpperCase()}]`,
    currentStyle,
    finalPayload
  );
}
