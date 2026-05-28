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

export default function Navbar() {
  const { isVerified, userName, onboardingStep, clearAllChats, startOnboardingConversation } = useChatStore();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
            Clinical Assistant
          </span>
        </div>
      </div>

      {/* UTILITIES & PROFILE DROPDOWN (RIGHT SECTION) */}
      <div className="flex items-center gap-2.5 md:gap-4">


        {/* AI ONLINE STATE INDICATOR */}
        <span className="hidden md:inline-flex items-center gap-1.5 h-9 text-[13px] font-bold text-[#666666] dark:text-[#8a8a8a] px-[14px] rounded-full border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-white animate-pulse" />
          AI Online
        </span>

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
                    {userName || 'Guest Patient'}
                  </span>
                  <span className="text-[9px] text-[#666666] dark:text-[#8a8a8a] font-bold uppercase tracking-wider flex items-center gap-0.5 mt-0.5">
                    {isVerified ? (
                      <><Sparkles className="w-2.5 h-2.5 text-[#111111] dark:text-[#c0c0c0]" /> Verified Patient</>
                    ) : (
                      <>Onboarding Active</>
                    )}
                  </span>
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
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
