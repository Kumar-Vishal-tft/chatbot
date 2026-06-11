'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────── */
export interface LeadData {
  name: string;
  phone: string;
  email: string;
  timestamp: string;
  device: string;
  source: string;
}

interface LeadCaptureCardProps {
  /** Called once Name and Phone are collected */
  onComplete: (data: LeadData) => void;
}

/* ─── Step config ─────────────────────────────────────── */
const STEPS = [
  {
    key: 'name' as const,
    prompt: 'What should we call you?',
    placeholder: 'Your name…',
    type: 'text',
    inputMode: 'text' as React.HTMLAttributes<HTMLInputElement>['inputMode'],
  },
  {
    key: 'phone' as const,
    prompt: "What's your mobile number?",
    placeholder: '+91 98765 43210',
    type: 'tel',
    inputMode: 'tel' as React.HTMLAttributes<HTMLInputElement>['inputMode'],
  },
];

/* ─── Animation variants ─────────────────────────────── */
const slideIn = {
  initial: { opacity: 0, y: 18, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit:    { opacity: 0, y: -14, filter: 'blur(4px)' },
  transition: { duration: 0.28, ease: 'easeInOut' as const },
};

/* ─── Component ───────────────────────────────────────── */
export default function LeadCaptureCard({ onComplete }: LeadCaptureCardProps) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ name: '', phone: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = STEPS[step];

  /* Auto-focus the input whenever the step changes */
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [step]);

  const handleContinue = async () => {
    if (isValidating) return;
    const val = values[current.key];
    if (!val.trim()) {
      setError(current.key === 'name' ? 'Please enter your name.' : 'Please enter your phone number.');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: current.key, value: val }),
      });

      if (!response.ok) {
        throw new Error('Validation API error');
      }

      const result = await response.json();
      if (!result.valid) {
        setError(result.reason || (current.key === 'name' ? 'Please enter a valid name.' : 'Please enter a valid phone number.'));
        setIsValidating(false);
        return;
      }

      // Update value with normalized output if any
      const finalVal = result.normalized || val;
      setValues(prev => ({ ...prev, [current.key]: finalVal }));

      if (step < STEPS.length - 1) {
        setStep(s => s + 1);
      } else {
        setDone(true);
        const lead: LeadData = {
          name: current.key === 'name' ? finalVal : values.name,
          phone: current.key === 'phone' ? finalVal : values.phone,
          email: '', // no longer collecting email
          timestamp: new Date().toISOString(),
          device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          source: window.location.href,
        };
        localStorage.setItem('yhealth_lead_v1', JSON.stringify(lead));
        setTimeout(() => onComplete(lead), 1400);
      }
    } catch (err) {
      console.warn('Lead capture LLM validation failed/timed out, falling back to local check:', err);
      // Fallback
      if (current.key === 'name') {
        const words = val.trim().split(/\s+/);
        const containsQuestionWord = /\b(how|what|who|why|where|when|can|you|please|help|greet|tell|symptom|treat|prevent|cure|medicine|clinical)\b/i.test(val);
        const isSentence = words.length > 3 || containsQuestionWord || val.includes('?');
        const isBad = val.trim().length < 2 || val.trim().length > 30 || /\d/.test(val) || isSentence;
        
        if (isBad) {
          setError('Please enter your real name (at least 2 letters, no numbers).');
          setIsValidating(false);
          return;
        }
      } else if (current.key === 'phone') {
        const digits = val.replace(/\D/g, '');
        const startsWithPlus = val.trim().startsWith('+');
        let isPhoneValid = false;

        if (digits.length === 10) {
          isPhoneValid = /^[6-9]\d{9}$/.test(digits);
        } else if (digits.length === 11) {
          isPhoneValid = /^0[6-9]\d{9}$/.test(digits);
        } else if (digits.length === 12) {
          isPhoneValid = /^91[6-9]\d{9}$/.test(digits);
        } else if (startsWithPlus) {
          isPhoneValid = digits.length >= 10 && digits.length <= 15;
        }

        if (!isPhoneValid) {
          setError('Please enter a valid mobile number.');
          setIsValidating(false);
          return;
        }
      }

      if (step < STEPS.length - 1) {
        setStep(s => s + 1);
      } else {
        setDone(true);
        const lead: LeadData = {
          name: values.name || val,
          phone: values.phone || val,
          email: '',
          timestamp: new Date().toISOString(),
          device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          source: window.location.href,
        };
        localStorage.setItem('yhealth_lead_v1', JSON.stringify(lead));
        setTimeout(() => onComplete(lead), 1400);
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleContinue();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValues(prev => ({ ...prev, [current.key]: val }));
    if (error) setError(null);
  };

  /* Progress dots */
  const Dots = () => (
    <div className="flex gap-1.5 items-center">
      {STEPS.map((_, i) => (
        <div
          key={i}
          style={{
            width: i < step || done ? 6 : i === step ? 18 : 6,
            height: 6,
            borderRadius: 99,
            transition: 'all 0.35s ease',
            background: i < step || done ? '#22c55e' : i === step ? 'var(--dot-active, #111)' : 'rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </div>
  );

  /* ──────────────────────────────────────── RENDER ─── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-[420px] mx-auto"
      style={{ '--dot-active': '#111111' } as React.CSSProperties}
    >
      <div
        className="rounded-[24px] px-5 py-5 md:px-6 md:py-6"
        style={{
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.05)',
          colorScheme: 'light',
        }}
      >
        {/* ── Header ── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#111111' }}
            >
              <img src="/Y-Health.png" alt="Y" className="w-4 h-4 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#888888' }}>
              YHealth AI
            </span>
          </div>
          <h2 className="text-[17px] md:text-[19px] font-extrabold leading-snug mt-2" style={{ color: '#111111' }}>
            {done ? `You're all set, ${values.name} ✨` : 'Before we begin'}
          </h2>
          {!done && (
            <p className="text-[12px] mt-0.5 font-medium" style={{ color: '#888888' }}>
              Your private clinical intelligence assistant.
            </p>
          )}
        </div>

        {/* ── Step content (animated) ── */}
        <AnimatePresence mode="wait">
          {done ? (
            /* Completion state */
            <motion.div
              key="done"
              {...slideIn}
              className="flex flex-col items-center gap-3 py-4"
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              >
                <CheckCircle2 className="w-12 h-12" style={{ color: '#22c55e' }} />
              </motion.div>
              <p className="text-[14px] font-medium text-center" style={{ color: '#555555' }}>
                How can I help you today?
              </p>
            </motion.div>
          ) : (
            /* Input step */
            <motion.div key={step} {...slideIn} className="flex flex-col gap-3">
              {/* Step prompt */}
              <label
                htmlFor="lead-input"
                className="text-[14px] md:text-[15px] font-semibold"
                style={{ color: '#111111' }}
              >
                {current.prompt}
              </label>

              {/* Input field */}
              <input
                id="lead-input"
                ref={inputRef}
                type={current.type}
                inputMode={current.inputMode}
                placeholder={current.placeholder}
                value={values[current.key]}
                onChange={handleChange}
                onKeyDown={handleKey}
                disabled={isValidating}
                autoComplete="off"
                className="w-full outline-none font-medium placeholder:font-normal transition-all duration-200 disabled:opacity-60"
                style={{
                  height: 52,
                  borderRadius: 14,
                  padding: '0 18px',
                  fontSize: 15,
                  background: 'rgba(0,0,0,0.04)',
                  border: error ? '1.5px solid rgba(239,68,68,0.55)' : '1.5px solid rgba(0,0,0,0.08)',
                  color: '#111111',
                  caretColor: '#111111',
                }}
              />

              {/* Inline error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="text-[12px] font-medium"
                    style={{ color: '#ef4444', marginTop: -4 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Continue button */}
              <button
                onClick={handleContinue}
                disabled={isValidating}
                className="w-full flex items-center justify-center gap-2 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  height: 50,
                  borderRadius: 14,
                  fontSize: 14,
                  background: '#111111',
                  color: '#ffffff',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
                }}
              >
                {isValidating ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Validating…</span>
                  </div>
                ) : (
                  <>
                    <span>{step < STEPS.length - 1 ? 'Continue' : 'Get Started'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer: dots + step counter ── */}
        {!done && (
          <div className="flex items-center justify-between mt-4">
            <Dots />
            <span className="text-[11px] font-semibold" style={{ color: '#aaaaaa' }}>
              {step + 1} of {STEPS.length}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
