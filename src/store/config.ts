// ─── Environment Configuration ─────────────────────────────────────────────
// All sensitive keys are read from .env.local (never hardcoded).
// See frontend/.env for the template with all required variable names.

export const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
