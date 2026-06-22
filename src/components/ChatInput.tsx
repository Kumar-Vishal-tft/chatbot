'use client';

import { useChatStore } from '@/store/chatStore';
import { SendHorizontal, Mic, Lock, Plus, X, FileText, Pill, Camera, Activity, Sparkles, Smartphone, UserCheck } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import VoiceAssistantPanel from './VoiceAssistantPanel';
import ScheduleCallModal from './ScheduleCallModal';
import { captureAnalyticsEvent } from '@/utils/analytics';

/* ─── Typewriter prompts ─────────────────────────────────────── */
const PROMPTS = [
  'Ask anything about your health…',
  'Upload and analyze blood reports…',
  'Check symptoms instantly…',
  'Get diabetes nutrition guidance…',
  'Create a personalized diet plan…',
  'Track glucose and metabolic insights…',
];

const TYPING_SPEED  = 50;   // ms per character typed
const ERASING_SPEED = 28;   // ms per character erased
const PAUSE_AFTER   = 1600; // ms to pause when fully typed
const GOAL_OPTIONS = [
  'Weight loss', 'Diabetes', 'Blood reports', 'Nutrition', 'Fitness', 'General wellness',
  'Hypertension', 'GLP-1', 'Metabolic', 'Sexual Wellness', 'Mental Wellness', 'Longevity'
];

const CONDITION_OPTIONS = [
  'None', 'Diabetes', 'Hypertension', 'Asthma', 'Obesity', 'Metabolic health'
];

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

/* ─── Typewriter hook ────────────────────────────────────────── */
function useTypewriter(active: boolean) {
  const [display, setDisplay]       = useState('');
  const [promptIdx, setPromptIdx]   = useState(0);
  const [isErasing, setIsErasing]   = useState(false);
  const [isPaused, setIsPaused]     = useState(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplay('');
      setIsErasing(false);
      setIsPaused(false);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      return;
    }

    const full = PROMPTS[promptIdx];

    if (isPaused) return; // pause timer drives the next step

    const delay = isErasing ? ERASING_SPEED : TYPING_SPEED;

    const t = setTimeout(() => {
      if (!isErasing) {
        // Typing forward
        const next = full.substring(0, display.length + 1);
        setDisplay(next);
        if (next === full) {
          // Fully typed — pause before erasing
          setIsPaused(true);
          pauseTimer.current = setTimeout(() => {
            setIsPaused(false);
            setIsErasing(true);
          }, PAUSE_AFTER);
        }
      } else {
        // Erasing
        const next = full.substring(0, display.length - 1);
        setDisplay(next);
        if (next === '') {
          setIsErasing(false);
          setPromptIdx((i) => (i + 1) % PROMPTS.length);
        }
      }
    }, delay);

    return () => clearTimeout(t);
  }, [active, display, isErasing, isPaused, promptIdx]);

  // Reset on prompt change
  useEffect(() => {
    setDisplay('');
  }, [promptIdx]);

  useEffect(() => {
    return () => { if (pauseTimer.current) clearTimeout(pauseTimer.current); };
  }, []);

  return display;
}

/* ─── Component ──────────────────────────────────────────────── */
interface ChatInputProps {
  disabled?: boolean;
  onAttachClick?: () => void;
  onVerify?: () => void;
}

export default function ChatInput({ disabled: externalDisabled = false, onAttachClick, onVerify }: ChatInputProps) {
  const { sendMessage, isTyping, streamingMessageId, stopStreaming, onboardingStep, isExistingPatient, isVerified, isAbuseBlocked, abuseRemainingSeconds, checkAbuseStatus, sessionId, abuseBlockReason } = useChatStore();
  const isAIResponding = isTyping || streamingMessageId !== null;
  const isDisabled = externalDisabled || isAIResponding || isAbuseBlocked;

  const [text, setText]           = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [ctaModal, setCtaModal] = useState<'about' | 'expert' | 'download' | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isSubmitting = useRef(false);
  const hasTrackedComposing = useRef(false);

  // Typewriter is active when: input is empty AND not focused AND menu is closed AND onboarding is not active
  const isOnboardingActive = onboardingStep !== 'completed' && onboardingStep !== 'not_started';
  const typewriterActive = !text && !isFocused && !isMenuOpen && !isOnboardingActive;
  const animatedPlaceholder = useTypewriter(typewriterActive);

  const selectedOptions = text
    ? text.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const handlePillToggle = (option: string) => {
    if (onboardingStep === 'asked_gender') {
      setText(option);
      return;
    }

    const optionLower = option.toLowerCase();
    const isAlreadySelected = selectedOptions.some((o) => o.toLowerCase() === optionLower);

    let currentOptions: string[] = [];

    if (option === 'None') {
      if (isAlreadySelected) {
        currentOptions = [];
      } else {
        currentOptions = ['None'];
      }
    } else {
      const cleanOptions = selectedOptions.filter((o) => o.toLowerCase() !== 'none');
      if (isAlreadySelected) {
        currentOptions = cleanOptions.filter((o) => o.toLowerCase() !== optionLower);
      } else {
        currentOptions = [...cleanOptions, option];
      }
    }

    setText(currentOptions.join(', '));
  };

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const maxH = isMobile ? 120 : 180;
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxH)}px`;
    }
  }, [text]);

  // Check abuse status when sessionId becomes available/changes (e.g. after loading persisted chats)
  useEffect(() => {
    if (sessionId) {
      checkAbuseStatus();
    }
  }, [sessionId, checkAbuseStatus]);

  // Auto-focus when not blocked
  useEffect(() => {
    if (!isAbuseBlocked) {
      textareaRef.current?.focus();
    }
  }, [isAbuseBlocked]);

  // Re-focus after AI response completes entirely (typewriter + fetch)
  const prevIsAIResponding = useRef(false);
  useEffect(() => {
    if (prevIsAIResponding.current === true && isAIResponding === false) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
    prevIsAIResponding.current = isAIResponding;
  }, [isAIResponding]);

  const handleSubmit = useCallback(() => {
    if (!text.trim() || isDisabled || isSubmitting.current) return;
    isSubmitting.current = true;
    sendMessage(text.trim());
    setText('');
    hasTrackedComposing.current = false;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setTimeout(() => {
      isSubmitting.current = false;
    }, 500);
  }, [text, isDisabled, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isAIResponding) {
        handleSubmit();
      }
    }
  };

  const handleButtonClick = () => {
    if (isAIResponding) {
      stopStreaming();
    } else {
      handleSubmit();
    }
  };

  const openVoiceAssistant = () => {
    if (isDisabled) return;
    captureAnalyticsEvent('voice_opened');
    setShowVoicePanel(true);
  };

  const handleMenuOption = (option: string) => {
    setIsMenuOpen(false);
    switch (option) {
      default:
        break;
    }
  };

  // Format remaining seconds as mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full bg-gradient-to-t from-white/90 via-white/40 to-transparent dark:from-[#0a0a0a]/90 dark:via-[#0a0a0a]/40 dark:to-transparent pt-6 pb-4 px-4">
      {/* ── Abuse Block Banner ─────────────────────────────────────── */}
      {isAbuseBlocked && (
        <div className="w-full max-w-[860px] mx-auto mb-3 flex items-center justify-between gap-3 px-4 py-3
          bg-red-50/95 dark:bg-red-950/60
          border border-red-200/80 dark:border-red-500/30
          rounded-2xl backdrop-blur-md shadow-sm animate-fade-in select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <Lock className="w-4 h-4 text-red-500 dark:text-red-400" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wide">
                Message field locked
              </p>
              <p className="text-[11px] text-red-500/80 dark:text-red-400/70 mt-0.5 leading-snug">
                {abuseBlockReason === 'repetition'
                  ? 'Duplicate messages were detected. You can send messages again after the cooldown.'
                  : 'Abusive language was detected. You can send messages again after the cooldown.'}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-1.5
            bg-red-100/80 dark:bg-red-900/40
            border border-red-200/60 dark:border-red-500/20
            rounded-xl min-w-[62px]"
          >
            <span className="text-[10px] font-bold text-red-400 dark:text-red-500 uppercase tracking-wider">Unlocks in</span>
            <span className="text-lg font-black text-red-600 dark:text-red-400 tabular-nums leading-tight">
              {formatCountdown(abuseRemainingSeconds)}
            </span>
          </div>
        </div>
      )}

      {/* Onboarding bottom prompt helper banner */}
      {onboardingStep !== 'completed' && onboardingStep !== 'not_started' && (
        <div className="w-full max-w-[860px] mx-auto mb-3 flex items-center justify-between px-4 py-2.5 
          bg-neutral-50/90 dark:bg-[#121212]/90 border border-black/[0.05] dark:border-white/[0.08]
          rounded-2xl backdrop-blur-md shadow-sm select-none animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 dark:bg-neutral-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500 dark:bg-neutral-400"></span>
            </span>
            <span className="text-[11px] font-bold tracking-tight text-neutral-500 dark:text-neutral-400 uppercase">
              Clinical Profiling: Stage {
                onboardingStep === 'asked_name' ? '1/7 (Identity)' :
                onboardingStep === 'asked_age' ? '2/7 (Demography)' :
                onboardingStep === 'asked_gender' ? '3/7 (Biological)' :
                onboardingStep === 'asked_phone' ? '4/7 (Verification Sync)' :
                onboardingStep === 'asked_goal' ? '5/7 (Goal Selection)' :
                onboardingStep === 'asked_conditions' ? '6/7 (Symptom Index)' :
                '7/7 (Current State)'
              }
            </span>
          </div>
          {onboardingStep !== 'asked_name' &&
           onboardingStep !== 'asked_age' &&
           onboardingStep !== 'asked_gender' &&
           onboardingStep !== 'asked_phone' && (
            <button 
              onClick={() => useChatStore.getState().skipOnboarding()}
              className="text-[10px] font-extrabold text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white uppercase transition cursor-pointer"
            >
              Skip personalizing
            </button>
          )}
        </div>
      )}

      {/* Interactive multi-select panels for goals and conditions */}
      {onboardingStep === 'asked_gender' && (
        <div className="w-full max-w-[860px] mx-auto mb-3 px-4 py-3 bg-neutral-50/50 dark:bg-[#121212]/30 border border-black/[0.05] dark:border-white/[0.08] rounded-2xl backdrop-blur-md select-none animate-fade-in">
          <span className="block text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase mb-2">Select your gender:</span>
          <div className="flex flex-wrap gap-2">
            {GENDER_OPTIONS.map((opt) => {
              const isSelected = selectedOptions.some((s) => s.toLowerCase() === opt.toLowerCase());
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handlePillToggle(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 border ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onboardingStep === 'asked_goal' && (
        <div className="w-full max-w-[860px] mx-auto mb-3 px-4 py-3 bg-neutral-50/50 dark:bg-[#121212]/30 border border-black/[0.05] dark:border-white/[0.08] rounded-2xl backdrop-blur-md select-none animate-fade-in">
          <span className="block text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase mb-2">What would you most like help with? (Tap to select multiple)</span>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((opt) => {
              const isSelected = selectedOptions.some((s) => s.toLowerCase() === opt.toLowerCase());
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handlePillToggle(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 border ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onboardingStep === 'asked_conditions' && (
        <div className="w-full max-w-[860px] mx-auto mb-3 px-4 py-3 bg-neutral-50/50 dark:bg-[#121212]/30 border border-black/[0.05] dark:border-white/[0.08] rounded-2xl backdrop-blur-md select-none animate-fade-in">
          <span className="block text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase mb-2">Do you have any existing medical conditions? (Tap to select multiple)</span>
          <div className="flex flex-wrap gap-2">
            {CONDITION_OPTIONS.map((opt) => {
              const isSelected = selectedOptions.some((s) => s.toLowerCase() === opt.toLowerCase());
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handlePillToggle(opt)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-95 border ${
                    isSelected 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-300 hover:border-black/20 dark:hover:border-white/20'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating CTA row (only shows when clinical profiling flow is not active AND user is not an existing patient) */}
      {!isExistingPatient && onboardingStep === 'completed' && (
        <div className="w-full max-w-[860px] mx-auto mb-2.5 flex flex-nowrap md:flex-wrap items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar px-4 md:px-2 select-none animate-fade-in">
          {/* 2. Speak to YHealth Expert */}
          <button
            onClick={() => setCtaModal('expert')}
            className="group flex flex-shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
              bg-white/80 dark:bg-black/20 
              border border-black/[0.08] dark:border-white/[0.08]
              hover:border-black/20 dark:hover:border-white/25
              text-neutral-600 dark:text-neutral-300 
              hover:text-black dark:hover:text-white
              hover:bg-white dark:hover:bg-white/[0.02]
              shadow-sm hover:shadow-md hover:-translate-y-0.5
              transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
            <span>Speak to YHealth Expert</span>
          </button>

          {/* 3. Existing Patient */}
          {!isExistingPatient && onVerify && (
            <button
              onClick={onVerify}
              className="group flex flex-shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                bg-white/80 dark:bg-black/20 
                border border-black/[0.08] dark:border-white/[0.08]
                hover:border-black/20 dark:hover:border-white/25
                text-neutral-600 dark:text-neutral-300 
                hover:text-black dark:hover:text-white
                hover:bg-white dark:hover:bg-white/[0.02]
                shadow-sm hover:shadow-md hover:-translate-y-0.5
                transition-all duration-300 active:scale-95 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300" />
              <span>Existing Patient</span>
            </button>
          )}

          {/* 4. About YHealth */}
          <button
            onClick={() => setCtaModal('about')}
            className="group flex flex-shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
              bg-white/80 dark:bg-black/20 
              border border-black/[0.08] dark:border-white/[0.08]
              hover:border-black/20 dark:hover:border-white/25
              text-neutral-600 dark:text-neutral-300 
              hover:text-black dark:hover:text-white
              hover:bg-white dark:hover:bg-white/[0.02]
              shadow-sm hover:shadow-md hover:-translate-y-0.5
              transition-all duration-300 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300" />
            <span>About YHealth</span>
          </button>
        </div>
      )}

      {/* Capsule */}
      <div
        className="relative flex items-end gap-2 md:gap-3 min-h-[52px] md:min-h-[58px] px-3 md:px-5 py-2 md:py-2.5
          bg-white/80 dark:bg-[#111111]/80
          border border-black/[0.08] dark:border-white/[0.10]
          shadow-[0_4px_24px_rgba(0,0,0,0.06)] md:shadow-[0_8px_40px_rgba(0,0,0,0.08)]
          rounded-[26px] md:rounded-[28px] backdrop-blur-[32px]
          transition-all duration-300 ease-out
          focus-within:border-black/20 dark:focus-within:border-white/25
          focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.06),0_8px_40px_rgba(0,0,0,0.10)]
          dark:focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.06),0_8px_40px_rgba(0,0,0,0.5)]
          w-full max-w-[860px] mx-auto"
      >
        {/* Multi-Action Floating Menu popover */}
        {isMenuOpen && (
          <div 
            ref={menuRef}
            className="absolute bottom-[64px] left-[8px] md:left-[12px] z-50 w-[280px] max-w-[calc(100vw-32px)] 
              bg-white/95 dark:bg-[#141414]/95 border border-black/[0.08] dark:border-white/[0.12] 
              rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] 
              backdrop-blur-xl p-2.5 flex flex-col gap-1.5 animate-fade-in transition-all duration-200"
          >
            <button
              type="button"
              onClick={() => {
                onAttachClick?.();
                setIsMenuOpen(false);
              }}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-750 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04] rounded-xl text-left whitespace-nowrap transition-all duration-200 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 group-hover:scale-110 transition-transform duration-200" />
              <span>Upload Report</span>
            </button>
          </div>
        )}
        {/* Multi-Action trigger button "+" / "x" */}
        <button
          id="tour-plus"
          ref={buttonRef}
          onClick={() => setIsMenuOpen((o) => !o)}
          disabled={isDisabled}
          className={`w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full self-end mb-1 md:mb-1.5
            transition-all duration-200 disabled:opacity-40 flex-shrink-0 cursor-pointer ${
              isMenuOpen 
                ? 'bg-black/10 dark:bg-white/10 text-neutral-800 dark:text-white rotate-45' 
                : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-[#888] dark:text-[#666] hover:text-[#111111] dark:hover:text-white'
            }`}
          type="button"
          title="Open actions menu"
        >
          {isMenuOpen ? (
            <X className="w-5 h-5 stroke-[2.5]" />
          ) : (
            <Plus className="w-5 h-5 stroke-[2.5]" />
          )}
        </button>

        {/* Input wrapper — position relative for overlay */}
        <div className="relative flex-1 flex items-center min-w-0 py-1.5 md:py-2">

          {/* ── Typewriter animated placeholder overlay ── */}
          {typewriterActive && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center pointer-events-none select-none overflow-hidden pl-1.5"
            >
              <span className="text-sm md:text-[15px] font-medium text-black/35 dark:text-white/30 whitespace-nowrap overflow-hidden animate-fade-in">
                {animatedPlaceholder}
              </span>
              {/* Blinking cursor */}
              <span className="ml-[1.5px] inline-block w-[1.5px] h-[14px] md:h-[16px] bg-black/30 dark:bg-white/25 animate-pulse flex-shrink-0" />
            </span>
          )}

          {/* Actual transparent textarea — always on top */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              if (val.trim() && !hasTrackedComposing.current) {
                hasTrackedComposing.current = true;
                captureAnalyticsEvent('message_composing_started');
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={
              onboardingStep === 'asked_name' ? 'Type your name...' :
              onboardingStep === 'asked_age' ? 'Type your age...' :
              onboardingStep === 'asked_gender' ? 'Select or type gender...' :
              onboardingStep === 'asked_phone' ? 'Type mobile number...' :
              onboardingStep === 'asked_goal' ? 'What can I help with?...' :
              onboardingStep === 'asked_conditions' ? 'Medical conditions...' :
              onboardingStep === 'asked_feeling' ? 'How are you feeling?...' :
              ""
            }
            rows={1}
            disabled={isDisabled}
            className="w-full bg-transparent text-[#111111] dark:text-white text-sm md:text-[15px] font-medium resize-none focus:outline-none disabled:opacity-50 relative z-10 caret-[#111111] dark:caret-white pl-1.5 pr-2 no-scrollbar max-h-[120px] md:max-h-[180px] overflow-y-auto placeholder:truncate"
            style={{
              height: '24px',
              lineHeight: '24px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          />
        </div>

        {/* Voice Button - Premium Symmetric Touch Target with breathing pulse ring */}
        <button
          onClick={openVoiceAssistant}
          disabled={isDisabled}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full transition-all duration-300 flex-shrink-0 cursor-pointer self-end mb-0.5 md:mb-1
            bg-neutral-100 hover:bg-neutral-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-[#888] dark:text-[#666] hover:text-[#111111] dark:hover:text-white
            shadow-sm hover:shadow-md hover:scale-105 active:scale-95 disabled:opacity-40"
          type="button"
          title="Open Premium Voice Assistant"
        >
          <Mic className="w-[18px] h-[18px] stroke-[2]" />
        </button>

        {/* Send / Stop */}
        <button
          onClick={handleButtonClick}
          disabled={!isAIResponding && (!text.trim() || isDisabled)}
          className={`w-9 h-9 md:w-10 md:h-10 rounded-full transition-all duration-200 flex-shrink-0 flex items-center justify-center cursor-pointer hover:scale-[1.06] active:scale-95 self-end mb-0.5 md:mb-1 ${
            isAIResponding
              ? 'bg-[#111111] dark:bg-white text-white dark:text-black shadow-md animate-stop-pulse hover:shadow-lg'
              : text.trim()
                ? 'bg-[#111111] dark:bg-white text-white dark:text-black shadow-md hover:shadow-lg'
                : 'bg-black/[0.06] dark:bg-white/[0.08] text-black/25 dark:text-white/30 cursor-not-allowed'
          }`}
          type="button"
          title={isAIResponding ? "Stop generation" : "Send"}
        >
          {isAIResponding ? (
            <div className="w-[10px] h-[10px] md:w-3 md:h-3 bg-white dark:bg-black rounded-[2px] transition-all duration-200 scale-95" />
          ) : (
            <SendHorizontal className="w-4 h-4 md:w-[18px] md:h-[18px] fill-none stroke-[2.5] transition-all duration-200" />
          )}
        </button>
      </div>

      {/* Trust badge */}
      <div className="hidden md:flex items-center justify-center gap-1.5 mt-1">
        <span className="text-[11px] text-black/30 dark:text-white/25 font-medium tracking-wide">
          <a
            href="https://yhealth.me/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-black/60 dark:hover:text-white/60 underline transition-colors cursor-pointer"
          >
            Privacy Policy
          </a>
        </span>
      </div>
      {/* Root level Voice Assistant Bottom Sheet / Modal */}
      <VoiceAssistantPanel
        isOpen={showVoicePanel}
        onClose={() => setShowVoicePanel(false)}
        onSendQuery={(query) => sendMessage(query)}
        isAISpeaking={isAIResponding}
      />

      <ScheduleCallModal
        isOpen={ctaModal === 'expert'}
        onClose={() => setCtaModal(null)}
      />

      {/* CTA Detail Modals */}
      {ctaModal && ctaModal !== 'expert' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0e0e0e] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setCtaModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {ctaModal === 'about' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#111111] dark:text-white">About YHealth</h3>
                </div>
                <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed flex flex-col gap-3">
                  <p>
                    <strong>YHealth AI</strong> is your personal health assistant, designed to help you analyze medical reports, check symptoms, monitor vital trends, and manage your wellness journey conversationally.
                  </p>
                  <p>
                    Built with high-trust clinical security guidelines, YHealth ensures your conversation history is safe, private, and encrypted.
                  </p>
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">Website</div>
                    <a
                      href="https://yhealth.me/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors w-fit cursor-pointer"
                    >
                      <span>yhealth.me</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link shrink-0"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                    </a>
                  </div>
                  <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl text-[11px] text-neutral-500 dark:text-neutral-500">
                    Note: YHealth is an AI health companion. For clinical diagnosis or emergencies, always seek help from a qualified medical professional.
                  </div>
                </div>
              </div>
            )}

            {ctaModal === 'download' && (
              <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#111111] dark:text-white">Download YHealth App</h3>
                </div>
                <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed flex flex-col gap-3">
                  <p>
                    Take YHealth wherever you go. Get instant notifications, symptom trackers, and seamless report uploads on your phone.
                  </p>
                  <div className="flex gap-3 mt-2">
                    <div className="flex-1 p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all">
                      <span className="text-[11px] font-bold text-[#111111] dark:text-white">App Store (iOS)</span>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">Coming Soon</span>
                    </div>
                    <div className="flex-1 p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all">
                      <span className="text-[11px] font-bold text-[#111111] dark:text-white">Google Play</span>
                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
