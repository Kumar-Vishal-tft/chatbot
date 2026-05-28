'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ChevronRight } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourTooltipProps {
  steps: TourStep[];
  onFinish: () => void;
}

const TOOLTIP_W = 360;
const GAP = 16;
const ARROW_SIZE = 10;
const SPOTLIGHT_PAD = 16;

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

function getRect(id: string) {
  return document.getElementById(id)?.getBoundingClientRect() ?? null;
}

export default function TourTooltip({ steps, onFinish }: TourTooltipProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [arrowDir, setArrowDir] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const isMobile = useIsMobile();
  const current = steps[step];
  
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Prevent background scroll when open, restore on close
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  /* ── position computation (desktop only) ── */
  const compute = useCallback(() => {
    const r = getRect(current.targetId);
    setRect(r);
    if (!r || isMobile) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = r.left + r.width / 2;

    const padding = 12;
    const highlightTop = r.top - padding;
    const highlightBottom = r.bottom + padding;

    const estimatedH = tooltipRef.current?.getBoundingClientRect().height || 180;

    const pref = current.position ?? 'bottom';
    let top = 0, left = 0, dir: typeof arrowDir = 'top';

    if (pref === 'bottom') {
      if (highlightBottom + GAP + estimatedH <= vh - 16) {
        top = highlightBottom + GAP;
        dir = 'top';
      } else if (highlightTop - GAP - estimatedH >= 16) {
        top = highlightTop - estimatedH - GAP;
        dir = 'bottom';
      } else {
        top = Math.max(16, (vh - estimatedH) / 2);
        dir = 'top';
      }
    } else { // top
      if (highlightTop - GAP - estimatedH >= 16) {
        top = highlightTop - estimatedH - GAP;
        dir = 'bottom';
      } else if (highlightBottom + GAP + estimatedH <= vh - 16) {
        top = highlightBottom + GAP;
        dir = 'top';
      } else {
        top = Math.max(16, (vh - estimatedH) / 2);
        dir = 'top';
      }
    }

    // Keep left within viewport boundaries with 16px safe margin from edges
    left = Math.min(Math.max(cx - TOOLTIP_W / 2, 16), vw - TOOLTIP_W - 16);

    setTooltipPos({ top, left });
    setArrowDir(dir);
  }, [step, isMobile, current]);

  useEffect(() => {
    // Dynamic scroll highlighted elements into center on mobile/desktop
    const t = setTimeout(() => {
      compute();
      const el = document.getElementById(current.targetId);
      if (el) {
        // Offset scroll for navbar (which is fixed at the top)
        if (current.targetId !== 'tour-navbar') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 120);
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [compute, current]);

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else onFinish();
  };

  /* ── arrow CSS ── */
  const arrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute', width: 0, height: 0, borderStyle: 'solid' };
    const s = ARROW_SIZE;

    // Calculate precise arrow placement based on where the target center actually is relative to the tooltip left
    const targetCx = rect ? rect.left + rect.width / 2 : 0;
    const relativeLeft = rect ? Math.min(Math.max(targetCx - tooltipPos.left, 28), TOOLTIP_W - 28) : TOOLTIP_W / 2;

    if (arrowDir === 'top')
      return { ...base, top: -s, left: relativeLeft, transform: 'translateX(-50%)', borderWidth: `0 ${s}px ${s}px`, borderColor: `transparent transparent #ffffff transparent` };
    if (arrowDir === 'bottom')
      return { ...base, bottom: -s, left: relativeLeft, transform: 'translateX(-50%)', borderWidth: `${s}px ${s}px 0`, borderColor: `#ffffff transparent transparent transparent` };
    if (arrowDir === 'left')
      return { ...base, left: -s, top: '50%', transform: 'translateY(-50%)', borderWidth: `${s}px ${s}px ${s}px 0`, borderColor: `transparent #ffffff transparent transparent` };
    return { ...base, right: -s, top: '50%', transform: 'translateY(-50%)', borderWidth: `${s}px 0 ${s}px ${s}px`, borderColor: `transparent transparent transparent #ffffff` };
  };

  /* ── Progress dots ── */
  const Dots = () => (
    <div className="flex items-center gap-1.5">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? 'w-4 bg-black' : 'w-1.5 bg-neutral-200'
          }`}
        />
      ))}
    </div>
  );

  /* ── Next / Done button ── */
  const NextBtn = () => (
    <button
      onClick={next}
      className="flex items-center justify-center gap-1 h-9 px-4 rounded-xl bg-black text-white text-xs font-bold transition hover:bg-neutral-800 active:scale-[0.98] duration-200 cursor-pointer"
    >
      {step < steps.length - 1 ? (
        <>
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </>
      ) : (
        <span>Done ✓</span>
      )}
    </button>
  );

  /* ── Skip button ── */
  const SkipBtn = () => (
    <button
      onClick={onFinish}
      className="text-xs font-semibold text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
    >
      Skip
    </button>
  );

  /* ── Step label ── */
  const StepLabel = () => (
    <p className="text-xs font-semibold text-neutral-400">
      Step {step + 1} of {steps.length}
    </p>
  );

  /* ────────────────────────────────────────────────
     SHARED: dim overlay + highlight ring
  ──────────────────────────────────────────────── */
  const Backdrop = () => (
    <>
      {/* Dimmed overlay — NO blur so spotlight stays 100% sharp */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'rgba(10,10,10,0.52)', zIndex: 9997 }}
      />
      {/* Spotlight cutout — uses box-shadow to dim everything OUTSIDE, keeps inside crystal clear */}
      {rect && (
        <motion.div
          key={`ring-${step}`}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="fixed pointer-events-none"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
            borderRadius: 18,
            /* Outer shadow dims the rest; inner rings create crisp glowing border */
            boxShadow: [
              '0 0 0 9999px rgba(10,10,10,0.52)',          /* cutout overlay */
              '0 0 0 2px rgba(255,255,255,0.88)',           /* crisp white ring */
              '0 0 0 5px rgba(255,255,255,0.10)',           /* soft outer halo */
              '0 8px 32px rgba(0,0,0,0.35)',                /* depth shadow */
            ].join(', '),
            zIndex: 9998,
          }}
        />
      )}
    </>
  );

  /* ────────────────────────────────────────────────
     MOBILE: hide tour completely on mobile screen
  ──────────────────────────────────────────────── */
  if (isMobile) {
    return null;
  }

  /* ────────────────────────────────────────────────
     DESKTOP: floating tooltip with arrow
  ──────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      <Backdrop />
      <motion.div
        ref={tooltipRef}
        key={`tip-${step}`}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="fixed pointer-events-auto"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_W,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 10000,
        }}
      >
        <div
          className="relative rounded-[24px] p-6 select-none border border-neutral-100/50"
          style={{
            background: '#ffffff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            colorScheme: 'light',
          }}
        >
          {/* Arrow */}
          <div style={arrowStyle()} />

          {/* Header row */}
          <div className="flex items-center justify-between mb-3.5">
            <StepLabel />
            <SkipBtn />
          </div>

          {/* Title */}
          <h3 className="text-base font-extrabold mb-2 leading-tight" style={{ color: '#111111' }}>
            {current.title}
          </h3>

          {/* Description */}
          <p className="text-[13px] leading-relaxed mb-6 font-medium" style={{ color: '#555555' }}>
            {current.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4">
            <Dots />
            <NextBtn />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
