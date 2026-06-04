import { useChatStore } from '@/store/chatStore';
import { 
  Sparkles, 
  Settings, 
  Trash2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { useWakeLock } from '@/hooks/useWakeLock';

export default function Navbar() {
  const { isVerified, userName, onboardingStep, clearAllChats, startOnboardingConversation } = useChatStore();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  
  const { isSupported: isWakeLockSupported, isActive: isWakeLockActive, isEnabled: isWakeLockEnabled, toggleKeepAwake } = useWakeLock();

  // Close dropdown on outside clicks
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'GP';

  return (
    <header 
      id="tour-navbar"
      className="fixed top-0 left-0 right-0 z-50 h-[64px] md:h-[56px] w-full flex items-center justify-between px-4 md:px-[clamp(12px,3vw,32px)] select-none bg-[#f0f0f2]/85 dark:bg-[#161618]/75 border-b border-black/[0.07] dark:border-white/[0.08] backdrop-blur-[18px] dark:backdrop-blur-[20px] transition-all duration-300"
    >
      {/* BRANDING LOGO (LEFT SECTION) */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="relative flex items-center justify-center flex-shrink-0">
          {/* Subtle silver radial glow behind logo */}
          <div className="absolute w-8 h-8 md:w-9 md:h-9 bg-black/[0.02] dark:bg-white/5 rounded-full logo-glow-silver" />
          <div className="relative w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white dark:bg-black/60 border border-black/10 dark:border-white/10 flex items-center justify-center p-1.5 md:p-2 shadow-sm">
            <img 
              src="/Y-Health.png" 
              alt="Y-Health Logo" 
              className="w-full h-full object-contain brightness-0 dark:brightness-100 transition-all duration-300" 
            />
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[#111111] dark:text-white text-xs md:text-sm tracking-tight leading-none">
              YHealth AI
            </span>
          </div>
          <span className="text-[9px] md:text-[10px] font-semibold text-[#666666] dark:text-[#8a8a8a] mt-0.5">
            Your AI Health Assistant
          </span>
        </div>
      </div>

      {/* UTILITIES & PROFILE DROPDOWN (RIGHT SECTION) */}
      <div className="flex items-center gap-2.5 md:gap-4">



        {/* THEME TOGGLER */}
        <ThemeToggle />

        {/* PROFILE AVATAR DROPDOWN */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-9 h-9 flex-shrink-0 rounded-full bg-black/[0.04] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 flex items-center justify-center text-[11px] font-extrabold text-[#111111] dark:text-white shadow-sm active:scale-95 cursor-pointer"
            title="User actions"
          >
            {initials}
          </button>
 
          {showProfileDropdown && (
            <div className="absolute top-11 right-0 w-[280px] max-w-[calc(100vw-32px)] bg-white dark:bg-[#0e0e0e] border border-black/10 dark:border-white/10 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1.5 animate-slide-up mt-1">
              
              {/* Premium User details card */}
              <div className="p-2 bg-black/[0.01] dark:bg-white/[0.02] rounded-xl flex items-center gap-2.5 border border-black/5 dark:border-white/5">
                <div className="w-9 h-9 flex-shrink-0 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#111111] dark:text-white font-extrabold text-[11px]">
                  {initials}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[#111111] dark:text-white truncate">
                    {userName || 'Guest'}
                  </span>
                  {isVerified && (
                    <span className="text-[9px] text-[#666666] dark:text-[#8a8a8a] font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5">
                      <Sparkles className="w-2.5 h-2.5 text-[#111111] dark:text-[#c0c0c0]" /> Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {!isVerified && onboardingStep !== 'completed' && (
                <div className="flex flex-col gap-0.5 py-1">
                  <button
                    onClick={() => {
                      startOnboardingConversation();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold transition-colors text-left"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      Complete Profile
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {/* Keep Screen Awake Toggle Option */}
              <div className="flex flex-col gap-1.5 border-t border-black/5 dark:border-white/5 pt-2.5 mt-1">
                <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider pl-2.5">
                  Device Controls
                </span>
                <div className="w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900/40 text-xs transition-colors">
                  <span className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                    <ShieldCheck className={`w-4 h-4 transition-colors ${isWakeLockActive ? 'text-emerald-500' : 'text-neutral-400'}`} />
                    Keep Screen Awake
                  </span>
                  
                  {/* Switch Toggle */}
                  <button
                    onClick={toggleKeepAwake}
                    disabled={!isWakeLockSupported}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 cursor-pointer ${
                      isWakeLockEnabled ? 'bg-emerald-500' : 'bg-neutral-200 dark:bg-neutral-800'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={isWakeLockSupported ? "Toggle keeping screen active" : "Wake Lock not supported on this browser"}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 transform ${
                      isWakeLockEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                {!isWakeLockSupported && (
                  <span className="text-[9px] font-medium text-red-500 pl-2.5 -mt-1 leading-normal">
                    Not supported by your browser
                  </span>
                )}
                {isWakeLockSupported && (
                  <div className="flex items-center gap-1.5 pl-2.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isWakeLockActive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`} />
                    <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                      {isWakeLockActive ? 'Active' : 'Inactive / Backgrounded'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
