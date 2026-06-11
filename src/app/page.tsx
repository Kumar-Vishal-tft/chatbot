'use client';

import Navbar from '@/components/Navbar';
import ChatInput from '@/components/ChatInput';
import ChatMessage from '@/components/ChatMessage';
import PromptCards from '@/components/PromptCards';
import TypingLoader from '@/components/TypingLoader';
import TourTooltip from '@/components/TourTooltip';
import LeadCaptureCard, { LeadData } from '@/components/LeadCaptureCard';
import VerificationPanel, { VerifiedUser } from '@/components/VerificationPanel';
import UploadModal from '@/components/UploadModal';
import { useChatStore } from '@/store/chatStore';
import { syncConversationWithBackend } from '@/store/utils';
import { useRef, useEffect, useState } from 'react';
import { Stethoscope, FileText, Apple, ArrowRight, UserPlus, HeartPulse, ShieldCheck, Activity, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CAMPAIGN_CONFIG } from '@/store/campaign-config';
import { captureAnalyticsEvent } from '@/utils/analytics';
import { activePersonaManager } from '@/persona/PersonaManager';

/* ─── Stage machine ─────────────────────────────────────── */
type Stage = 'welcome' | 'chat';

/* ─── Animation presets ─────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.02 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 18 } },
};
const pageIn = {
  initial: { opacity: 0, y: 22, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit:    { opacity: 0, y: -16, filter: 'blur(2px)' },
  transition: { duration: 0.35, ease: 'easeInOut' as const },
};

/* ─── Shared light-mode page wrapper styles ─────────────── */
const lightPageStyle: React.CSSProperties = {
  colorScheme: 'light',
  background: 'linear-gradient(180deg, #fafafa 0%, #f1f1f1 100%)',
  color: '#111111',
};
const lightSpotlight: React.CSSProperties = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  background: 'radial-gradient(circle at 50% 38%, rgba(0,0,0,0.025), transparent 58%)',
};

function getTimeOfDayGreeting(name?: string): string {
  const hour = new Date().getHours();
  let timeGreeting = "Hello";
  if (hour >= 5 && hour < 12) {
    timeGreeting = "Good morning";
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = "Good afternoon";
  } else if (hour >= 17 && hour < 22) {
    timeGreeting = "Good evening";
  } else {
    timeGreeting = "Hello";
  }
  
  if (name) {
    const firstName = name.trim().split(' ')[0];
    return `${timeGreeting}, ${firstName}`;
  }
  return "How can I help you today?";
}

export default function Home() {
  const { 
    activeChatId, 
    messages, 
    isTyping, 
    streamingMessageId, 
    sendMessage,
    isVerified,
    isExistingPatient,
    userName,
    onboardingStep,
    onboardingProfile,
    restoreExistingUser,
    persona,
    isProgramActivated,
    activateProgram,
    isRestoring
  } = useChatStore();

  const utmCampaign = (typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null) || 'default';
  const campaignConfig = CAMPAIGN_CONFIG[utmCampaign] || CAMPAIGN_CONFIG.default;
  const heroTagline = campaignConfig.heroTagline;

  /* ── Stage ── */
  const [stage, setStage] = useState<Stage>('welcome');
  const [isMounted, setIsMounted] = useState(false);

  /* ── Welcome typing ── */
  const [displayText, setDisplayText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);

  /* ── User identity ── */
  const [showTour, setShowTour] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [showExistingPatientCard, setShowExistingPatientCard] = useState(() => {
    if (typeof window !== 'undefined') {
      // Don't show if already dismissed this session
      if (sessionStorage.getItem('hideExistingPatientCard') === 'true') return false;
      // Don't show if already a verified user
      if (localStorage.getItem('yhealth_existing_v1')) return false;
      return true;
    }
    return true;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeSessionMessages = activeChatId ? messages[activeChatId] || [] : [];
  const hasMessages = activeSessionMessages.length > 0;

  // Dynamic selectors for verified patients
  const clinicalDescription = persona?.narrative_summary?.short_summary
    ? `We have securely synchronized your health data: ${persona.narrative_summary.short_summary}`
    : "We have securely synchronized your clinical records, lab summaries, and care targets.";

  const totalSessionsCount = persona?.care_team?.consultation_history?.total_count || 3;
  
  // Fasting / Latest Glucose
  const glucoseVal = persona?.glucometer_profile?.last_reading?.value_mgdl;
  const glucoseSlot = persona?.glucometer_profile?.last_reading?.slot || "Pre Breakfast";
  const glucoseLabel = glucoseVal ? `${glucoseVal} mg/dL` : "92 mg/dL";
  const glucoseStatus = glucoseVal ? (glucoseVal > 180 ? "Warning (High)" : glucoseVal < 70 ? "Low" : "Optimal") : "Optimal";

  // Estimated HbA1c
  const hba1cVal = persona?.face_scan_profile?.latest_scan?.lab_estimates?.hba1c_percent;
  const hba1cLabel = hba1cVal ? `${hba1cVal}%` : "5.3%";
  const hba1cStatus = hba1cVal ? (hba1cVal > 6.5 ? "High Risk" : hba1cVal > 5.7 ? "Pre-diabetic" : "Optimal") : "Optimal";

  // Cholesterol
  const chRisk = persona?.face_scan_profile?.latest_scan?.risk_scores?.high_total_cholesterol_risk;
  const chLabel = chRisk ? `${chRisk.charAt(0).toUpperCase() + chRisk.slice(1)} Risk` : "Warning (High)";

  // Hemoglobin
  const hbVal = persona?.face_scan_profile?.latest_scan?.lab_estimates?.hemoglobin_gdl;
  const hbLabel = hbVal ? `${hbVal} g/dL` : "14.2 g/dL";

  // Weight Loss Calories Deficit
  const weightLossKcal = persona?.identity?.anthropometry?.weight_loss_calories_kcal || 1500;

  /* ── Mount: restore state from localStorage ── */
  useEffect(() => {
    setIsMounted(true);
    if (typeof window === 'undefined') return;

    // Parse and persist UTM parameters dynamically
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const utmContent = params.get('utm_content');
    const utmTerm = params.get('utm_term');

    if (utmCampaign) sessionStorage.setItem('utm_campaign', utmCampaign);
    if (utmSource) sessionStorage.setItem('utm_source', utmSource);
    if (utmMedium) sessionStorage.setItem('utm_medium', utmMedium);
    if (utmContent) sessionStorage.setItem('utm_content', utmContent);
    if (utmTerm) sessionStorage.setItem('utm_term', utmTerm);

    const resolvedCampaign = sessionStorage.getItem('utm_campaign') || 'default';
    const config = CAMPAIGN_CONFIG[resolvedCampaign] || CAMPAIGN_CONFIG.default;

    // Synchronize campaign states inside our chatStore
    useChatStore.setState({
      utm_campaign: resolvedCampaign,
      utm_source: sessionStorage.getItem('utm_source') || utmSource,
      utm_medium: sessionStorage.getItem('utm_medium') || utmMedium,
      utm_content: sessionStorage.getItem('utm_content') || utmContent,
      utm_term: sessionStorage.getItem('utm_term') || utmTerm,
    });

    // Capture analytical landing view event
    captureAnalyticsEvent('landing_view', {
      utm_source: sessionStorage.getItem('utm_source') || utmSource,
      utm_medium: sessionStorage.getItem('utm_medium') || utmMedium,
      utm_campaign: resolvedCampaign,
      utm_content: sessionStorage.getItem('utm_content') || utmContent,
      utm_term: sessionStorage.getItem('utm_term') || utmTerm,
      program: config.programId,
      persona: config.persona,
    });

    // Capture dynamic persona loaded event for UTM-based flow
    captureAnalyticsEvent('persona_loaded', {
      persona: config.persona || 'general_agent',
      campaign: resolvedCampaign,
    });



    // Load persisted chat history
    const { loadPersistedChats } = useChatStore.getState();
    loadPersistedChats();

    // Existing verified patient returning
    const existing = localStorage.getItem('yhealth_existing_v1');
    if (existing) {
      try {
        const p = JSON.parse(existing) as VerifiedUser;
        restoreExistingUser(p.name, p.phone, p.persona, p.session_id);
        setStage('chat');
        setIsTypingDone(true);
        return;
      } catch {}
    }

    // New patient returning
    const lead = localStorage.getItem('yhealth_lead_v1');
    if (lead) {
      try {
        const p = JSON.parse(lead);
        useChatStore.setState({
          userName: p.name,
          onboardingStep: 'completed',
          isVerified: true
        });
        setStage('chat');
        setIsTypingDone(true);
        return;
      } catch {}
    }

    // Returning guest who already passed splash screen
    const visitedSplash = localStorage.getItem('yhealth_visited_splash_v1');
    if (visitedSplash === 'true') {
      setStage('chat');
      setIsTypingDone(true);
      return;
    }

    // Fresh user → welcome with typing animation
    let idx = 0;
    const fullText = "Welcome to YHealth AI";
    const id = setInterval(() => {
      if (idx < fullText.length) {
        const ch = fullText[idx];   // capture BEFORE any increment
        idx++;
        setDisplayText(p => p + ch);
      }
      if (idx >= fullText.length) {
        clearInterval(id);
        setIsTypingDone(true);
      }
    }, 90);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSessionMessages.length, isTyping, streamingMessageId]);


  // Delay banner appearance by 2 seconds — notification-style
  useEffect(() => {
    if (!showExistingPatientCard) return;
    const t = setTimeout(() => setBannerVisible(true), 3000);
    return () => clearTimeout(t);
  }, [showExistingPatientCard]);

  // Track home dashboard loaded
  useEffect(() => {
    if (stage === 'chat') {
      captureAnalyticsEvent('home_loaded');
    }
  }, [stage]);

  // Track existing patient restore banner shown
  useEffect(() => {
    if (!isVerified && !hasMessages && showExistingPatientCard && bannerVisible) {
      captureAnalyticsEvent('patient_restore_banner_shown');
    }
  }, [isVerified, hasMessages, showExistingPatientCard, bannerVisible]);

  /* ── Navigation handlers ── */
  const skipWelcome = () => {
    localStorage.setItem('yhealth_visited_splash_v1', 'true');

    // Retrieve UTM parameters for Get Started tracking
    const dynamicUtmSource = typeof window !== 'undefined' ? sessionStorage.getItem('utm_source') : null;
    const dynamicUtmMedium = typeof window !== 'undefined' ? sessionStorage.getItem('utm_medium') : null;
    const dynamicUtmCampaign = typeof window !== 'undefined' ? sessionStorage.getItem('utm_campaign') : null;
    const dynamicUtmContent = typeof window !== 'undefined' ? sessionStorage.getItem('utm_content') : null;
    const dynamicUtmTerm = typeof window !== 'undefined' ? sessionStorage.getItem('utm_term') : null;

    captureAnalyticsEvent('get_started_clicked', {
      tenant: 'yhealth',
      session_type: 'anonymous',
      utm_campaign: dynamicUtmCampaign,
      utm_source: dynamicUtmSource,
      utm_medium: dynamicUtmMedium,
      utm_content: dynamicUtmContent,
      utm_term: dynamicUtmTerm,
    });

    setStage('chat');
    setShowTour(true);
  };

  const handleVerified = (user: VerifiedUser) => {
    localStorage.setItem('yhealth_existing_v1', JSON.stringify(user));
    restoreExistingUser(user.name, user.phone, user.persona, user.session_id);
    setShowVerification(false);
  };

  /* ── Skeleton ── */
  if (!isMounted) return <div className="min-h-[100dvh] w-screen gradient-bg" />;

  if (isRestoring) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[100dvh] w-screen bg-[#fafafa] dark:bg-[#050505] relative select-none">
        <div className="relative flex items-center justify-center">
          {/* Pulsing ring */}
          <div className="absolute w-20 h-20 rounded-full border border-indigo-500/30 dark:border-indigo-400/30 animate-ping" />
          <div className="absolute w-16 h-16 rounded-full border-2 border-indigo-500/10 dark:border-indigo-400/10 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
          {/* Logo center */}
          <div className="relative w-10 h-10 rounded-[12px] bg-white dark:bg-black border border-black/5 dark:border-white/10 flex items-center justify-center p-1.5 shadow-md animate-pulse">
            <img src="/Y-Health.png" alt="YHealth" className="w-full h-full object-contain brightness-0 dark:brightness-100" />
          </div>
        </div>
        <p className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-8 animate-pulse">
          Restoring Clinical File...
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     STAGE 1 — WELCOME (typing + Get Started)
  ═══════════════════════════════════════════ */
  if (stage === 'welcome') {
    return (
      <motion.div key="welcome" {...pageIn}
        className="flex flex-col items-center justify-center min-h-[100dvh] w-screen overflow-hidden relative px-4 select-none"
        style={lightPageStyle}
      >
        <div style={lightSpotlight} />
        <div className="flex flex-col items-center text-center gap-6 md:gap-7 z-10 max-w-xl mx-auto -mt-12 md:-mt-16">
          {/* Logo */}
          <div className="w-[82px] h-[82px] md:w-[120px] md:h-[120px] rounded-[24px] md:rounded-[28px] flex items-center justify-center p-5 md:p-7 overflow-hidden"
            style={{ background: '#111111', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
            <img src="/Y-Health.png" alt="YHealth" className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          {/* Typing headline */}
          <div className="min-h-[36px] md:min-h-[60px] flex items-center justify-center">
            <h1 style={{ color: '#111' }} className="text-[26px] md:text-[46px] font-extrabold tracking-[-1px] md:tracking-[-2px] leading-tight flex items-center">
              <span>{displayText}</span>
              {!isTypingDone && (
                <span className="inline-block w-[2.5px] h-[26px] md:h-[46px] ml-1.5 animate-pulse" style={{ background: '#111' }} />
              )}
            </h1>
          </div>
          {/* CTA — appears only after typing completes */}
          <div className="min-h-[52px] flex items-center">
            <AnimatePresence>
              {isTypingDone && (
                <motion.button
                  key="cta"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  onClick={skipWelcome}
                  className="h-[52px] px-8 rounded-full font-bold text-sm flex items-center gap-2 group cursor-pointer hover:scale-[1.05] active:scale-95 transition-all duration-300"
                  style={{ background: '#111111', color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ═══════════════════════════════════════════
     STAGE 2 — CHAT HOME & DASHBOARD
  ═══════════════════════════════════════════ */
  return (
    <motion.div key="chat" {...pageIn}
      className="flex flex-col h-[100dvh] w-screen overflow-hidden text-[#111111] dark:text-[#c0c0c0] transition-colors duration-300 gradient-bg"
    >
      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10 min-h-0 pt-[64px] md:pt-[56px]">
        <main className={`flex-1 flex flex-col relative w-full min-h-0 ${hasMessages ? 'overflow-y-auto pt-2' : 'overflow-y-auto no-scrollbar md:overflow-hidden pt-2'}`}>
          {!hasMessages ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="landing-viewport-container px-4 py-3 md:py-5 pb-[148px] md:pb-2 w-full max-w-[1100px] mx-auto">
              <div className="glow-aura opacity-100" />
              <div className="ai-pulse-orb-1" />
              <div className="ai-pulse-orb-2" />

              {/* Conditionally Render: RESTORED CLINICAL DASHBOARD (Existing Patients) vs STANDARD LANDING PAGE (New Patients) */}
              {isVerified && isExistingPatient ? (
                /* ─── EXISTING PATIENT DASHBOARD VIEW ─── */
                <motion.div 
                  variants={containerVariants}
                  className="w-full flex flex-col gap-6"
                >
                  {/* Greeting banner */}
                  <div className="p-6 rounded-[24px] bg-white/70 dark:bg-white/[0.03] border border-black/10 dark:border-white/10 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/20">
                        <ShieldCheck className="w-3.5 h-3.5" /> HIPAA Clinical File Restored
                      </span>
                      <h2 className="text-2xl font-extrabold text-[#111111] dark:text-white mt-2.5">
                        Welcome back, {userName}
                      </h2>
                      <p className="text-xs text-[#666666] dark:text-[#8a8a8a] mt-1 leading-relaxed">
                        {clinicalDescription}
                      </p>
                      {/* Dynamic Primary Campaign CTA Button */}
                      <div className="mt-4 flex flex-col gap-2">
                        {isProgramActivated ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 w-fit animate-[pulse_2s_infinite]">
                            <ShieldCheck className="w-4 h-4" /> {campaignConfig.ctaText.replace('Book', 'Activated').replace('Talk to', 'Connected with').replace('Schedule', 'Scheduled')} Successfully! 🎉
                          </span>
                        ) : (
                          <button
                            onClick={activateProgram}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-md shadow-indigo-500/25 hover:shadow-lg hover:scale-102 transition-all cursor-pointer w-fit"
                          >
                            <Activity className="w-4 h-4" /> {campaignConfig.ctaText}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2.5 flex-shrink-0">
                      <div className="px-3.5 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] text-center border border-black/5 dark:border-white/5">
                        <span className="block text-[9px] text-[#888] font-bold uppercase tracking-wider">Restored Chats</span>
                        <span className="text-sm font-extrabold text-black dark:text-white mt-0.5 block">{totalSessionsCount} Sessions</span>
                      </div>
                      <div className="px-3.5 py-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] text-center border border-black/5 dark:border-white/5">
                        <span className="block text-[9px] text-[#888] font-bold uppercase tracking-wider">Lab Reports</span>
                        <span className="text-sm font-extrabold text-black dark:text-white mt-0.5 block">{persona?.lab_results_profile?.total_uploaded || 2} Uploads</span>
                      </div>
                    </div>
                  </div>

                  {/* Info stats split grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {/* Diagnostic report card metrics */}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#888] px-1">Restored Lab Biomarkers</h3>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        {/* Fasting Glucose */}
                        <div className="p-4 rounded-[20px] bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm">
                          <span className="text-[10px] font-bold text-[#888] uppercase block">
                            {glucoseVal ? `Glucose (${glucoseSlot})` : "Glucose Average"}
                          </span>
                          <span className="text-lg font-black text-black dark:text-white mt-1 block">{glucoseLabel}</span>
                          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            glucoseStatus.includes("Warning")
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                              : "bg-black/5 dark:bg-white/10 text-black dark:text-white border-black/5 dark:border-white/10"
                          }`}>
                            {glucoseStatus}
                          </span>
                        </div>
                        {/* HbA1c */}
                        <div className="p-4 rounded-[20px] bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm">
                          <span className="text-[10px] font-bold text-[#888] uppercase block">HbA1c (Estimated)</span>
                          <span className="text-lg font-black text-black dark:text-white mt-1 block">{hba1cLabel}</span>
                          <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            hba1cStatus.includes("High") || hba1cStatus.includes("Pre-diabetic")
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                              : "bg-black/5 dark:bg-white/10 text-black dark:text-white border-black/5 dark:border-white/10"
                          }`}>
                            {hba1cStatus}
                          </span>
                        </div>
                        {/* Cholesterol */}
                        <div className="p-4 rounded-[20px] bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm">
                          <span className="text-[10px] font-bold text-[#888] uppercase block">Cholesterol Risk</span>
                          <span className="text-lg font-black text-black dark:text-white mt-1 block">{chLabel}</span>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/5 dark:border-white/10">
                            Face Scan Est.
                          </span>
                        </div>
                        {/* Hemoglobin */}
                        <div className="p-4 rounded-[20px] bg-white/70 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm">
                          <span className="text-[10px] font-bold text-[#888] uppercase block">Hemoglobin</span>
                          <span className="text-lg font-black text-black dark:text-white mt-1 block">{hbLabel}</span>
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-black/5 dark:bg-white/10 text-black dark:text-white border border-black/5 dark:border-white/10">
                            Optimal
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nutrition target metrics */}
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#888] px-1">Restored Metabolic Targets</h3>
                      
                      <div className="p-5 rounded-[24px] bg-white/70 dark:bg-white/[0.03] border border-black/10 dark:border-white/10 backdrop-blur-md flex flex-col gap-4 shadow-sm h-full justify-center">
                        {/* Calories */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                            <span className="text-[#666] dark:text-[#aaa]">Weight-Loss Deficit Budget</span>
                            <span className="text-black dark:text-white">{weightLossKcal.toLocaleString()} kcal</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                            <div className="w-[78%] h-full bg-black dark:bg-white" />
                          </div>
                        </div>

                        {/* Protein */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                            <span className="text-[#666] dark:text-[#aaa]">Protein Target (95g met!)</span>
                            <span className="text-black dark:text-white font-extrabold">95 / 95 g</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                            <div className="w-full h-full bg-black dark:bg-white" />
                          </div>
                        </div>

                        {/* Carbohydrates */}
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                            <span className="text-[#666] dark:text-[#aaa]">Carbohydrates Threshold Limit</span>
                            <span className="text-black dark:text-white">110 / 130 g</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                            <div className="w-[84%] h-full bg-black dark:bg-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Restored Sessions timeline suggestions */}
                  <div className="flex flex-col gap-3 mt-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#888] px-1">Restored Consultations History</h3>
                    <PromptCards isVerified={true} verifiedName={userName} />
                  </div>
                </motion.div>
              ) : (
                /* ─── STANDARD LANDING VIEW (New Users / Onboarding Users) ─── */
                <div className="flex flex-col items-center gap-4 md:gap-5 w-full">
                  {/* Greeting — compact */}
                  <motion.div variants={itemVariants} className="flex flex-col items-center gap-1.5 md:gap-2 flex-shrink-0">
                    <div className="relative flex items-center justify-center z-10 flex-shrink-0">
                      <div className="absolute w-20 h-20 md:w-24 md:h-24 bg-black/[0.01] dark:bg-white/5 rounded-full logo-glow-silver" />
                      <div className="relative w-16 h-16 md:w-20 md:h-20 mb-1 rounded-[20px] md:rounded-[24px] bg-white dark:bg-black/60 border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-center p-3 md:p-4 shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:scale-105 transition-all duration-300">
                        <img src="/Y-Health.png" alt="YHealth" className="w-full h-full object-contain brightness-0 dark:brightness-100 transition-all duration-300" />
                      </div>
                    </div>
                    <div className="text-center max-w-2xl px-2">
                      <p className="text-[9px] md:text-[10px] text-[#888] dark:text-[#909090] font-semibold mb-1.5 md:mb-2 tracking-widest uppercase">
                        {heroTagline}
                      </p>
                      <h1 className="text-3xl md:text-4xl lg:text-[40px] font-medium tracking-tight bg-gradient-to-b from-[#111111] to-[#444444] dark:from-white dark:via-[#e0e0e0] dark:to-[#c0c0c0] bg-clip-text text-transparent leading-tight" style={{ paddingBottom: '5px' }}>
                        {getTimeOfDayGreeting(userName)}
                      </h1>
                    </div>
                  </motion.div>

                  {/* Prompt cards */}
                  <motion.div id="tour-cards" variants={itemVariants} className="w-full z-10 flex-shrink min-h-0 mt-2">
                    <PromptCards
                      onVerify={() => setShowVerification(true)}
                      isVerified={isVerified}
                      verifiedName={userName}
                      hideExistingCard={true}
                    />
                  </motion.div>

                  {/* Existing patient card moved to fixed floating banner — see bottom of this component */}
                </div>
              )}
            </motion.div>
          ) : (
            /* ─── CHAT CONVERSATION VIEW ─── */
            <div className="flex-1 w-full flex flex-col pb-32 md:pb-10">
              {activeSessionMessages.map((msg) => (
                <ChatMessage key={msg.id} id={msg.id} sender={msg.sender} content={msg.content} timestamp={msg.timestamp} isStreaming={msg.id === streamingMessageId} />
              ))}
              {isTyping && <TypingLoader />}
              <div ref={messagesEndRef} className="h-10 flex-shrink-0" />
            </div>
          )}
        </main>

        {/* Permanently Fixed Bottom Chat Input Bar & Verification Panel */}
        <div id="tour-input" className="relative w-full z-20 bg-gradient-to-t from-[#FAFAFA] dark:from-[#050505] via-[#FAFAFA]/95 dark:via-[#050505]/95 to-transparent pt-4 pb-2 transition-colors duration-300 flex-shrink-0">
          {/* Fixed floating Existing Patient banner — always visible above the input */}
          <AnimatePresence>
            {!isVerified && !hasMessages && showExistingPatientCard && bannerVisible && (
              <motion.div
                key="existing-patient-banner"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12, transition: { duration: 0.2 } }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="fixed bottom-[84px] left-0 right-0 z-30 px-3 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:px-0 md:mb-3 max-w-[860px] md:mx-auto"
              >
                <div className="rounded-2xl px-4 md:px-6 py-3 md:py-5 pr-10 md:pr-12 flex flex-row items-center justify-between gap-3 md:gap-5 border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#111]/95 backdrop-blur-xl shadow-xl relative">
                  <button
                    onClick={() => {
                      setShowExistingPatientCard(false);
                      sessionStorage.setItem('hideExistingPatientCard', 'true');
                    }}
                    aria-label="Close"
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[#888] hover:text-[#111] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="min-w-0">
                    <p className="font-extrabold text-xs md:text-sm text-[#111111] dark:text-white leading-tight">Existing Patient?</p>
                    <p className="text-[10px] md:text-xs text-[#666] dark:text-[#8a8a8a] mt-0.5 leading-tight">Verify your number to restore reports & AI memory.</p>
                  </div>
                  <button
                    onClick={() => {
                      captureAnalyticsEvent('verify_mobile_clicked');
                      setShowVerification(true);
                    }}
                    className="flex-shrink-0 h-8 md:h-10 px-4 md:px-6 rounded-full font-bold text-[11px] md:text-xs bg-[#111111] dark:bg-white text-white dark:text-black shadow-sm hover:scale-[1.03] active:scale-[0.97] transition cursor-pointer"
                  >
                    Verify Mobile Number
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showVerification && (
              <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <VerificationPanel
                  onVerified={handleVerified}
                  onClose={() => setShowVerification(false)}
                />
              </div>
            )}
          </AnimatePresence>
          <ChatInput 
            onAttachClick={() => {
              captureAnalyticsEvent('upload_clicked');
              setShowUpload(true);
            }} 
            onVerify={() => {
              captureAnalyticsEvent('verify_mobile_clicked');
              setShowVerification(true);
            }} 
          />
        </div>
      </div>

      {/* Tour */}
      {showTour && (
        <TourTooltip
          steps={[
            { targetId: 'tour-navbar',  title: 'Navigation & Controls',  description: 'Access chat history, AI status, theme controls, and profile settings from the top navigation bar.', position: 'bottom' },
            { targetId: 'tour-cards',   title: 'Suggested Prompts',       description: 'Select a quick action card to instantly query YHealth about common symptoms, lab analyses, or customized diets.', position: 'top' },
            { targetId: 'tour-input',   title: 'Ask YHealth AI',          description: 'Type your health questions or chat naturally for rapid, clinical-grade assistant feedback.', position: 'top' },
            { targetId: 'tour-plus',    title: 'Upload & Actions',       description: 'Click the plus icon to upload lab reports, scan prescriptions, or share medical images for specialized AI diagnostics.', position: 'top' },
          ]}
          onFinish={() => setShowTour(false)}
        />
      )}

      {/* Root-Level Upload Lab Report Modal */}
      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUploadSuccess={(fileName) => {
          sendMessage(`Analyze my uploaded lab report: "${fileName}"`);
        }}
      />
    </motion.div>
  );
}
