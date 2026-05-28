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
    <div className="flex items-start gap-3 p-4 md:p-5 bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 rounded-2xl w-fit max-w-[85%] mr-auto animate-fade-in shadow-sm dark:shadow-lg">
      {/* Animated AI pulse icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/10 flex items-center justify-center relative">
        <Activity className="w-3.5 h-3.5 text-[#111111] dark:text-white" />
        {/* Outer pulse ring */}
        <span className="absolute inset-0 rounded-full border border-black/10 dark:border-white/10 animate-ping opacity-40" />
      </div>

      <div className="flex flex-col gap-1.5 pt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-[#111111] dark:text-white">YHealth AI</span>
          <span
            key={msgIdx}
            className="text-[10px] text-[#666666] dark:text-[#8a8a8a] transition-all duration-500 animate-fade-in"
          >
            {THINKING_MESSAGES[msgIdx]}
          </span>
        </div>
        {/* Bouncing dots */}
        <div className="flex items-center gap-1 px-1 h-5 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/40 dark:bg-white/40 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/40 dark:bg-white/40 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#111111]/40 dark:bg-white/40 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
