'use client';

import { useChatStore } from '@/store/chatStore';
import { Sparkles } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "Why do I feel tired after sleeping?",
  "How to improve gut health?",
  "Explain cholesterol levels",
  "High protein vegetarian diet"
];

export default function SuggestionPills() {
  const { sendMessage } = useChatStore();

  return (
    <div className="flex flex-col items-center gap-2 mt-0 w-full max-w-4xl mx-auto px-4 animate-slide-up flex-shrink-0">
      <span className="text-[10px] md:text-xs font-bold text-[#666666] dark:text-[#8a8a8a] tracking-wider uppercase flex items-center gap-1.5 opacity-80">
        <Sparkles className="w-3.5 h-3.5 text-[#111111]/30 dark:text-white/40" />
        <span>Try asking something like</span>
      </span>
      
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl">
        {SUGGESTED_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(prompt)}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-white/70 dark:bg-white/[0.01] hover:bg-white dark:hover:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 text-[#555555] dark:text-[#8a8a8a] hover:text-black dark:hover:text-white hover:shadow-sm dark:hover:shadow-[0_0_12px_rgba(255,255,255,0.08)] transition-all duration-300 active:scale-95 text-center cursor-pointer opacity-80"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
