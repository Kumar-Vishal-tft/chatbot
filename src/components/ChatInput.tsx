'use client';

import { useChatStore } from '@/store/chatStore';
import { SendHorizontal, Mic, Lock, Plus, X, FileText, Pill, Image as ImageIcon, Camera } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import VoiceAssistantPanel from './VoiceAssistantPanel';

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
}

export default function ChatInput({ disabled: externalDisabled = false, onAttachClick }: ChatInputProps) {
  const { sendMessage, isTyping, streamingMessageId, stopStreaming, onboardingStep } = useChatStore();
  const isAIResponding = isTyping || streamingMessageId !== null;
  const isDisabled = externalDisabled || isAIResponding;

  const [text, setText]           = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Typewriter is active when: input is empty AND not focused AND menu is closed
  const typewriterActive = !text && !isFocused && !isMenuOpen;
  const animatedPlaceholder = useTypewriter(typewriterActive);

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

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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
    if (!text.trim() || isDisabled) return;
    sendMessage(text.trim());
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
    setShowVoicePanel(true);
  };

  const handleMenuOption = (option: string) => {
    setIsMenuOpen(false);
    switch (option) {
      case 'report':
        onAttachClick?.();
        break;
      case 'image':
        onAttachClick?.();
        break;
      case 'medicine':
        sendMessage('Scan medicine: Analyze my prescription bottle for dosage guidance.');
        break;
      case 'camera':
        sendMessage('Capture clinical photo: Analyze this skin condition or medical symptom.');
        break;
      case 'voice':
        openVoiceAssistant();
        break;
      default:
        break;
    }
  };

  return (
    <div className="w-full bg-gradient-to-t from-white/90 via-white/40 to-transparent dark:from-[#0a0a0a]/90 dark:via-[#0a0a0a]/40 dark:to-transparent pt-6 pb-4 px-4">
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
                onboardingStep === 'asked_name' ? '1/6 (Identity)' :
                onboardingStep === 'asked_age' ? '2/6 (Demography)' :
                onboardingStep === 'asked_gender' ? '3/6 (Biological)' :
                onboardingStep === 'asked_goal' ? '4/6 (Ambition)' :
                onboardingStep === 'asked_conditions' ? '5/6 (Symptom Index)' :
                '6/6 (Verification Sync)'
              }
            </span>
          </div>
          <button 
            onClick={() => useChatStore.setState({ onboardingStep: 'completed', isVerified: true })}
            className="text-[10px] font-extrabold text-neutral-400 dark:text-neutral-500 hover:text-black dark:hover:text-white uppercase transition cursor-pointer"
          >
            Skip personalizing
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
            className="absolute bottom-[64px] left-[8px] md:left-[12px] z-50 w-[220px] 
              bg-white/95 dark:bg-[#141414]/95 border border-black/[0.08] dark:border-white/[0.12] 
              rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] 
              backdrop-blur-xl p-2.5 flex flex-col gap-1.5 animate-fade-in transition-all duration-200"
          >
            <button
              onClick={() => handleMenuOption('report')}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition duration-150 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors duration-150" />
              <span>Upload Report</span>
            </button>
            <button
              onClick={() => handleMenuOption('image')}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition duration-150 cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors duration-150" />
              <span>Medical Image</span>
            </button>
            <button
              onClick={() => handleMenuOption('medicine')}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition duration-150 cursor-pointer"
            >
              <Pill className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors duration-150" />
              <span>Scan Medicine</span>
            </button>
            <button
              onClick={() => handleMenuOption('camera')}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition duration-150 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors duration-150" />
              <span>Open Camera</span>
            </button>
            <button
              onClick={() => handleMenuOption('voice')}
              className="group flex items-center gap-3 w-full px-3 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition duration-150 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors duration-150" />
              <span>Voice Consultation</span>
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
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder=""
            rows={1}
            disabled={isDisabled}
            className="w-full bg-transparent text-[#111111] dark:text-white text-sm md:text-[15px] font-medium resize-none focus:outline-none disabled:opacity-50 relative z-10 caret-[#111111] dark:caret-white pl-1.5 pr-2 no-scrollbar max-h-[120px] md:max-h-[180px] overflow-y-auto"
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
      <div className="hidden md:flex items-center justify-center gap-1.5 mt-1 select-none">
        <Lock className="w-3 h-3 text-black/20 dark:text-white/20 flex-shrink-0" />
        <span className="text-[11px] text-black/30 dark:text-white/25 font-medium tracking-wide">
          Private · Encrypted · HIPAA Compliant
        </span>
      </div>
      {/* Root level Voice Assistant Bottom Sheet / Modal */}
      <VoiceAssistantPanel
        isOpen={showVoicePanel}
        onClose={() => setShowVoicePanel(false)}
        onSendQuery={(query) => sendMessage(query)}
        isAISpeaking={isAIResponding}
      />
    </div>
  );
}
