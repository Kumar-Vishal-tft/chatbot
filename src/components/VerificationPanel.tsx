'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, RefreshCw, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useChatStore, getTimeBasedGreeting } from '@/store/chatStore';
import { BACKEND_URL } from '@/store/config';
import { PATIENT_PERSONA_MOCK } from '@/persona/patientMock';

/* ─── Types ────────────────────────────────────────────── */
export interface VerifiedUser {
  name: string;
  phone: string;
  persona?: any;
  session_id?: string;
}

interface VerificationPanelProps {
  onVerified: (user: VerifiedUser) => void;
  onClose: () => void;
}

type PanelStep = 'phone' | 'otp' | 'loading' | 'success';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/* ─── Helpers ──────────────────────────────────────────── */
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `+91 ${'X'.repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}`;
}

function validatePhone(v: string) {
  const d = v.replace(/\D/g, '');
  return d.length >= 7 && d.length <= 15;
}
function getFriendlyErrorMessage(msg: string, defaultMsg: string) {
  if (!msg) return defaultMsg;
  const lowercase = msg.toLowerCase();
  
  if (
    lowercase.includes('json') ||
    lowercase.includes('fetch') ||
    lowercase.includes('network') ||
    lowercase.includes('syntax') ||
    lowercase.includes('unexpected') ||
    lowercase.includes('proxy') ||
    lowercase.includes('internal') ||
    lowercase.includes('server') ||
    lowercase.includes('500') ||
    lowercase.includes('econnrefused') ||
    lowercase.includes('cors')
  ) {
    return "We're having trouble connecting to the secure registry. Please try again in a moment.";
  }
  
  return msg;
}

/* ─── Animation presets ────────────────────────────────── */
const slideUp = {
  initial: { opacity: 0, y: 18, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit:    { opacity: 0, y: 14, scale: 0.97 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
};

/* ─── Main Component ───────────────────────────────────── */
export default function VerificationPanel({ onVerified, onClose }: VerificationPanelProps) {
  const { userName } = useChatStore();
  const [step, setStep] = useState<PanelStep>('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [verifiedPatientName, setVerifiedPatientName] = useState('');

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  /* Auto-focus phone on mount */
  useEffect(() => {
    const t = setTimeout(() => phoneRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  /* Resend countdown */
  useEffect(() => {
    if (step !== 'otp') return;
    setResendSeconds(RESEND_SECONDS);
    setCanResend(false);
    const id = setInterval(() => {
      setResendSeconds(s => {
        if (s <= 1) { clearInterval(id); setCanResend(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step]);

  /* Auto-focus first OTP box when step changes */
  useEffect(() => {
    if (step === 'otp') {
      const t = setTimeout(() => otpRefs.current[0]?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [step]);

  /* ── Phone submit ── */
  const handleSendOtp = () => {
    if (!validatePhone(phone)) {
      setPhoneError('Please enter a valid mobile number.');
      return;
    }
    setPhoneError('');
    setIsSendingOtp(true);

    fetch(`${BACKEND_URL}/auth/send-otp?t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        country_code: '+91',
        phone_number: phone.trim()
      })
    })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const rawMsg = errData.detail || errData.message || "";
          const errMsg = getFriendlyErrorMessage(rawMsg, "We couldn't find a health profile linked to this mobile number.");
          const errorObj = new Error(errMsg);
          (errorObj as any).status = res.status;
          throw errorObj;
        }

        // Enforce that only the registered patient mobile number is allowed to proceed
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.endsWith('8777846383')) {
          const errorObj = new Error("We couldn't find a health profile linked to this mobile number.");
          (errorObj as any).status = 404;
          throw errorObj;
        }

        return res.json();
      })
      .then(() => {
        setStep('otp');
      })
      .catch(err => {
        if (err.status) {
          // Real backend validation error (e.g. 400/404)
          setPhoneError(err.message || "We couldn't find a health profile linked to this mobile number.");
        } else {
          // Connection refused / server completely offline
          const isMockNumber = phone.replace(/\D/g, '').endsWith('8777846383');
          if (isMockNumber) {
            console.warn('Failed to send OTP to backend. Proceeding to OTP step for offline/fallback mode.', err);
            setStep('otp');
          } else {
            setPhoneError("We couldn't find a health profile linked to this mobile number.");
          }
        }
      })
      .finally(() => {
        setIsSendingOtp(false);
      });
  };

  /* ── OTP change handler ── */
  const handleOtpChange = useCallback((idx: number, val: string) => {
    setOtpError('');

    // Handle paste
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const next = Array(OTP_LENGTH).fill('');
      digits.split('').forEach((d, i) => { next[i] = d; });
      setOtp(next);
      // Focus last filled or next empty
      const focusIdx = Math.min(digits.length, OTP_LENGTH - 1);
      otpRefs.current[focusIdx]?.focus();
      // Auto-submit if full
      if (digits.length === OTP_LENGTH) {
        setTimeout(() => submitOtp(next), 80);
      }
      return;
    }

    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);

    if (digit && idx < OTP_LENGTH - 1) {
      otpRefs.current[idx + 1]?.focus();
    }
    // Auto-submit
    if (digit && idx === OTP_LENGTH - 1) {
      const full = [...next];
      if (full.every(d => d)) {
        setTimeout(() => submitOtp(full), 80);
      }
    }
  }, [otp]);

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otp[idx]) {
        const next = [...otp]; next[idx] = '';
        setOtp(next);
      } else if (idx > 0) {
        otpRefs.current[idx - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) otpRefs.current[idx + 1]?.focus();
  };

  /* ── OTP submit ── */
  const submitOtp = (digits: string[]) => {
    const code = digits.join('');
    // Demo: accept any 6-digit code
    if (code.length < OTP_LENGTH || digits.some(d => !d)) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }
    // For demo, treat "000000" as wrong
    if (code === '000000') {
      setOtpError("That code doesn't look right. Try again.");
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      return;
    }
    setStep('loading');

    let fetchedPersona: any = null;

    fetch(`${BACKEND_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        country_code: '+91',
        phone_number: phone.trim(),
        otp: code
      })
    })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const rawMsg = errData.detail || errData.message || "";
          const errMsg = getFriendlyErrorMessage(rawMsg, 'Incorrect verification code. Please try again.');
          const errorObj = new Error(errMsg);
          (errorObj as any).status = res.status;
          throw errorObj;
        }
        return res.json();
      })
      .then(data => {
        console.log('Successfully verified OTP and synchronized patient persona:', data);
        
        // Throw an explicit error if the persona object is not present in the database response
        if (!data.persona) {
          const errorObj = new Error("We couldn't find a health profile linked to this mobile number.");
          (errorObj as any).status = 404;
          throw errorObj;
        }

        fetchedPersona = data.persona;
        const finalName = fetchedPersona?.identity?.first_name
          ? `${fetchedPersona.identity.first_name} ${fetchedPersona.identity.last_name || ''}`.trim()
          : 'Lisha Karar';
        setVerifiedPatientName(finalName);

        // Success transition
        setTimeout(() => {
          setStep('success');
          setTimeout(() => {
            onVerified({
              name: finalName,
              phone: phone || fetchedPersona?.identity?.phone || '+91 87778 46383',
              persona: fetchedPersona,
              session_id: data.session_id
            });
          }, 1600);
        }, 1800);
      })
      .catch(err => {
        if (err.status) {
          // Real backend validation error (e.g. 400 Bad Request / 404 Not Found)
          setOtpError(err.message || "We couldn't find a health profile linked to this mobile number.");
          setStep('otp');
          setOtp(Array(OTP_LENGTH).fill(''));
          setTimeout(() => otpRefs.current[0]?.focus(), 50);
        } else {
          // Server completely offline: fallback to local patient mock only for mock number
          const isMockNumber = phone.replace(/\D/g, '').endsWith('8777846383');
          if (isMockNumber) {
            console.warn('verify-otp API unreachable/failed. Falling back to offline patient mock profile:', err);
            fetchedPersona = PATIENT_PERSONA_MOCK;
            const finalName = fetchedPersona?.identity?.first_name
              ? `${fetchedPersona.identity.first_name} ${fetchedPersona.identity.last_name || ''}`.trim()
              : 'Neha Aggarwal';
            setVerifiedPatientName(finalName);

            setTimeout(() => {
              setStep('success');
              setTimeout(() => {
                onVerified({
                  name: finalName,
                  phone: phone || fetchedPersona?.identity?.phone || '+91 87778 46383',
                  persona: fetchedPersona
                });
              }, 1600);
            }, 1800);
          } else {
            setOtpError("We couldn't find a health profile linked to this mobile number.");
            setStep('otp');
            setOtp(Array(OTP_LENGTH).fill(''));
            setTimeout(() => otpRefs.current[0]?.focus(), 50);
          }
        }
      });
  };

  const handleResend = () => {
    if (!canResend) return;
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');

    fetch(`${BACKEND_URL}/auth/send-otp?t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        country_code: '+91',
        phone_number: phone.trim()
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to send OTP');
        const cleanPhone = phone.replace(/\D/g, '');
        if (!cleanPhone.endsWith('8777846383')) {
          throw new Error("We couldn't find a health profile linked to this mobile number.");
        }
        return res.json();
      })
      .catch(err => {
        console.warn('Failed to resend OTP to backend:', err);
      });

    setStep('otp'); // re-triggers the countdown effect
  };

  const goBackToPhone = () => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setStep('phone');
  };

  // Progressive loading checklist steps
  const [loadingStep, setLoadingStep] = useState(0);
  useEffect(() => {
    if (step !== 'loading') return;
    setLoadingStep(0);
    const intervals = [400, 800, 1200, 1600];
    const timers = intervals.map((delay, idx) => {
      return setTimeout(() => {
        setLoadingStep(idx + 1);
      }, delay);
    });
    return () => timers.forEach(clearTimeout);
  }, [step]);

  /* ─── Card wrapper ─────────────────────────────────── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.96 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="w-full max-w-md mx-auto relative rounded-3xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-y-auto max-h-[90dvh] no-scrollbar"
    >
      <div>
        {/* Trust header strip */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pl-5 pr-3 py-3 bg-neutral-50/50 dark:bg-neutral-900/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Secure Patient Verification
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step content */}
        <div className="px-5 py-6 md:px-6 md:py-8">
          <AnimatePresence mode="wait">

            {/* ── PHONE STEP ── */}
            {step === 'phone' && (
              <motion.div key="phone" {...slideUp} className="flex flex-col gap-4">
                <div>
                  <h2 className="text-2xl md:text-[28px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
                    Welcome back
                  </h2>
                  <p className="text-sm md:text-base text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                    Enter your registered mobile number.
                    <span className="block text-xs text-neutral-400 dark:text-neutral-600 mt-1 font-medium">We'll securely retrieve your clinical history.</span>
                  </p>
                </div>

                {/* Phone input row: side-by-side on all screen sizes */}
                <div className="flex flex-row gap-2.5 mt-1 w-full items-center">
                  {/* Country code pill */}
                  <div className="flex items-center justify-center gap-1.5 h-14 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/50 px-2.5 w-[84px] font-bold text-neutral-800 dark:text-neutral-200 flex-shrink-0">
                    <span className="text-base">🇮🇳</span>
                    <span className="text-xs">+91</span>
                  </div>

                  <input
                    ref={phoneRef}
                    type="tel"
                    inputMode="tel"
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
                    className={`h-14 flex-1 min-w-0 rounded-2xl border ${
                      phoneError
                        ? 'border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-neutral-200 dark:border-neutral-800 focus:border-neutral-900 dark:focus:border-white focus:ring-4 focus:ring-neutral-900/5 dark:focus:ring-white/10'
                    } bg-[#fafafa] dark:bg-neutral-900/50 px-4 text-sm font-semibold text-neutral-900 dark:text-white placeholder:font-normal placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none transition-all duration-200`}
                  />
                </div>

                {/* Phone error */}
                <AnimatePresence>
                  {phoneError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs font-medium text-red-500 -mt-1"
                    >
                      {phoneError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className="mt-2 h-14 w-full rounded-[18px] bg-black dark:bg-white text-white dark:text-black text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] cursor-pointer flex items-center justify-center shadow-lg shadow-black/10 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingOtp && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Send verification code
                </button>
              </motion.div>
            )}

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
              <motion.div key="otp" {...slideUp} className="flex flex-col gap-6 pt-1">
                {/* Back + heading */}
                <div className="space-y-1.5">
                  <button
                    onClick={goBackToPhone}
                    className="flex items-center gap-1 text-[11px] font-bold tracking-wider uppercase text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Change number
                  </button>
                  <h2 className="text-xl md:text-[22px] font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
                    Enter verification code
                  </h2>
                  <p className="text-xs md:text-sm font-medium text-neutral-500 dark:text-neutral-400 leading-normal">
                    Code sent to {maskPhone(phone)}
                  </p>
                </div>

                {/* OTP boxes — Centered perfectly & scales automatically on small viewports */}
                <div className="flex justify-center items-center gap-2.5 sm:gap-3 w-full">
                  {Array(OTP_LENGTH).fill(0).map((_, i) => {
                    const isFocused = focusedIdx === i;
                    const hasVal = !!otp[i];
                    return (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="one-time-code"
                        value={otp[i]}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        onFocus={e => {
                          setFocusedIdx(i);
                          e.target.select();
                        }}
                        onBlur={() => setFocusedIdx(null)}
                        className={`text-center font-extrabold outline-none transition-all duration-200 select-none
                          w-11 sm:w-14 h-14 sm:h-16 rounded-[16px] text-lg sm:text-[22px] cursor-text
                          ${otpError
                            ? 'border-[1.5px] border-red-500 bg-red-50/30 dark:bg-red-950/10 text-red-600 dark:text-red-400 ring-4 ring-red-500/10'
                            : isFocused
                              ? 'border-2 border-neutral-900 dark:border-white bg-white dark:bg-[#141414] text-neutral-900 dark:text-white ring-4 ring-neutral-900/5 dark:ring-white/10 shadow-sm'
                              : hasVal
                                ? 'border-[1.5px] border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                                : 'border-[1.5px] border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 text-neutral-900 dark:text-white'
                          }
                        `}
                        style={{
                          caretColor: 'transparent',
                        }}
                      />
                    );
                  })}
                </div>

                {/* OTP error */}
                <AnimatePresence>
                  {otpError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs font-semibold text-center text-red-500 -mt-1"
                    >
                      {otpError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Verify button */}
                <button
                  onClick={() => submitOtp(otp)}
                  className="w-full h-14 rounded-[18px] font-semibold text-sm bg-black dark:bg-white text-white dark:text-black flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-lg shadow-black/10 dark:shadow-none"
                >
                  Verify & Continue
                </button>

                {/* Resend */}
                <div className="text-center mt-0.5">
                  {canResend ? (
                    <button
                      onClick={handleResend}
                      className="text-xs font-bold inline-flex items-center justify-center gap-1.5 mx-auto text-neutral-900 hover:text-neutral-700 dark:text-white dark:hover:text-neutral-200 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend code
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                      Resend code in {resendSeconds}s
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── LOADING STATE ── */}
            {step === 'loading' && (
              <motion.div key="loading" {...slideUp} className="flex flex-col items-center gap-5 py-4 w-full">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="mb-2"
                >
                  <Loader2 className="w-8 h-8 text-neutral-950 dark:text-white" />
                </motion.div>

                <div className="flex flex-col gap-2.5 w-full max-w-[280px]">
                  {[
                    'Retrieving reports',
                    'Restoring consultations',
                    'Initializing AI insights',
                    'Ready',
                  ].map((label, idx) => {
                    const isDone = loadingStep > idx;
                    const isCurrent = loadingStep === idx;
                    return (
                      <div
                        key={label}
                        className={`flex items-center gap-3 text-xs font-bold transition-all duration-300 ${
                          isDone
                            ? 'text-green-600 dark:text-green-400'
                            : isCurrent
                              ? 'text-neutral-900 dark:text-white scale-[1.02]'
                              : 'text-neutral-300 dark:text-neutral-700'
                        }`}
                      >
                        <span className={`flex-shrink-0 flex items-center justify-center w-4.5 h-4.5 rounded-full border border-current text-[10px] ${isDone ? 'bg-green-500/10' : ''}`}>
                          {isDone ? '✓' : '•'}
                        </span>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── SUCCESS STATE ── */}
            {step === 'success' && (
              <motion.div key="success" {...slideUp} className="flex flex-col items-center gap-4 py-8">
                <motion.div
                  initial={{ scale: 0.8, rotate: -15, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center text-green-500 dark:text-green-400 border border-green-500/30 shadow-[0_8px_24px_rgba(34,197,94,0.2)]"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="text-lg md:text-xl font-extrabold text-center text-neutral-900 dark:text-white"
                >
                  {getTimeBasedGreeting()}, {verifiedPatientName || userName || 'Patient'} ✨
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="text-xs md:text-sm font-semibold text-center text-neutral-400 dark:text-neutral-500"
                >
                  Loading your clinical history…
                </motion.p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

