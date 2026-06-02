'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

const THINKING_MESSAGES = [
  'Analyzing your query…',
  'Checking clinical references…',
  'Preparing health insights…',
  'Reviewing medical context…',
];

export default function TypingLoader() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex w-full gap-3 p-4 md:p-6 border-b border-black/[0.03] dark:border-white/[0.03] transition-colors duration-200 justify-start animate-fade-in">
      <div className="flex w-full max-w-4xl mx-auto gap-3 md:gap-5 flex-row">
        
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center text-[#111111] dark:text-white shadow relative overflow-hidden">
            <div className="absolute inset-0 bg-black/5 dark:bg-white/5 animate-ping rounded-full opacity-30" />
            <Activity className="w-4 h-4 relative z-10 text-[#111111] dark:text-white" />
          </div>
        </div>

        {/* Bubble container */}
        <div className="flex flex-col max-w-[85%] md:max-w-[80%] items-start">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-bold text-[#111111] dark:text-white">
              YHealth AI
            </span>
            <span
              key={msgIdx}
              className="text-[9px] text-[#666666] dark:text-[#8a8a8a] transition-all duration-500 animate-fade-in"
            >
              {THINKING_MESSAGES[msgIdx]}
            </span>
          </div>

          {/* Bouncing dots container */}
          <div className="flex items-center gap-1 px-1 h-5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/45 dark:bg-white/45 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/45 dark:bg-white/45 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/45 dark:bg-white/45 animate-bounce" />
          </div>
        </div>

      </div>
    </div>
  );
}
