'use client';

import React from 'react';
import { X, ShieldAlert, Sparkles, PhoneCall } from 'lucide-react';
import { captureAnalyticsEvent } from '@/utils/analytics';
import { useChatStore } from '@/store/chatStore';

interface LimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'report' | 'prescription';
  onScheduleCall: () => void;
}

export default function LimitModal({ isOpen, onClose, type, onScheduleCall }: LimitModalProps) {
  const { activateProgram } = useChatStore();

  if (!isOpen) return null;

  const handleExplorePrograms = () => {
    captureAnalyticsEvent('program_cta_clicked', { source: 'limit_modal', type });
    if (activateProgram) {
      activateProgram();
    }
    onClose();
  };

  const handleScheduleCallClick = () => {
    captureAnalyticsEvent('schedule_call_clicked', { source: 'limit_modal', type });
    onScheduleCall();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#0e0e0e] border-t sm:border border-neutral-100 dark:border-white/10 rounded-t-[32px] sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-scale-up"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mt-3 block sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#111111] dark:text-white leading-tight">Limit Reached</h3>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Freemium Tier Limits</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
          <div className="text-left space-y-3">
            <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 leading-snug">
              {type === 'prescription' 
                ? 'You have already used your free prescription analysis.' 
                : 'You have already used your free report analysis.'}
            </h4>
            
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              The free version of YHealth allows analysis of:
            </p>

            <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-neutral-600 dark:text-neutral-400">1 Medical Report</span>
                <span className="text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full text-[10px]">1 / 1 Used</span>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-neutral-600 dark:text-neutral-400">1 Medical Prescription</span>
                <span className="text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-[#1f2937]/35 px-2 py-0.5 rounded-full text-[10px]">1 / 1 Used</span>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              To analyze additional reports and prescriptions, subscribe to a YHealth Program and get access to unlimited report reviews, prescription analysis, and continuous health monitoring.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-neutral-100 dark:border-white/[0.06] bg-white dark:bg-[#0e0e0e] shrink-0 space-y-3">
          <button
            onClick={handleExplorePrograms}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-2xl transition shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Explore YHealth Programs</span>
          </button>
          
          <button
            onClick={handleScheduleCallClick}
            className="w-full py-3 border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-black uppercase rounded-2xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4 text-emerald-500" />
            <span>Schedule a Health Expert Call</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-neutral-400 hover:text-neutral-650 dark:hover:text-neutral-200 text-xs font-bold uppercase transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
