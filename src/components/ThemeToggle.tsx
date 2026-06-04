'use client';

import { useChatStore } from '@/store/chatStore';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme, setTheme } = useChatStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    setTheme(savedTheme);
  }, [setTheme]);

  if (!mounted) {
    return (
      <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-black/[0.04] dark:bg-white/[0.04] text-[#666666] dark:text-[#8a8a8a] hover:text-[#111111] dark:hover:text-white border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 focus:outline-none flex items-center justify-center cursor-pointer"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45 text-white" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 hover:-rotate-12 text-[#111111] dark:text-white" />
      )}
    </button>
  );
}
