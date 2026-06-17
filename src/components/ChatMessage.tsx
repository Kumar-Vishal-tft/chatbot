'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Activity, Copy, Check, ShieldAlert, Heart, Activity as StepIcon, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatStore } from '@/store/chatStore';

export interface MessageProps {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

// Helper to determine status styling for diagnostic cards in dual-theme system
const getStatusClasses = (status: string) => {
  switch (status.toLowerCase()) {
    case 'healthy':
      return {
        badge: 'text-neutral-700 bg-neutral-100 dark:text-white dark:bg-white/10 border-neutral-200 dark:border-white/20',
        card: 'border-black/[0.05] dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-white/80 dark:bg-white/[0.02] hover:shadow-[0_10px_25px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]',
        color: 'text-neutral-700 dark:text-white',
        icon: Heart,
      };
    case 'warning':
      return {
        badge: 'text-neutral-700 bg-neutral-100 dark:text-[#c0c0c0] dark:bg-white/5 border-neutral-200 dark:border-white/10',
        card: 'border-black/[0.05] dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 bg-white/80 dark:bg-white/[0.01] hover:shadow-[0_10px_25px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.02)]',
        color: 'text-neutral-600 dark:text-[#c0c0c0]',
        icon: Activity,
      };
    case 'deficient':
    case 'danger':
      return {
        badge: 'text-neutral-700 bg-neutral-100 dark:text-white dark:bg-white/25 border-neutral-200 dark:border-white/35',
        card: 'border-black/[0.05] dark:border-white/15 hover:border-black/30 dark:hover:border-white/30 bg-white/80 dark:bg-white/[0.03] hover:shadow-[0_10px_25px_rgba(0,0,0,0.03)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.08)]',
        color: 'text-neutral-900 dark:text-white font-bold',
        icon: ShieldAlert,
      };
    default:
      return {
        badge: 'text-neutral-500 bg-neutral-50 dark:text-[#8a8a8a] dark:bg-white/[0.02] border-neutral-100 dark:border-white/5',
        card: 'border-black/[0.05] dark:border-white/5 bg-white/80 dark:bg-white/[0.01]',
        color: 'text-neutral-500 dark:text-[#8a8a8a]',
        icon: StepIcon,
      };
  }
};

// Custom Blockquote for Alerts ([!WARNING] / [!NOTE]) in Dual-Theme styling
const Blockquote = ({ children }: any) => {
  const getRawText = (nodes: any): string => {
    if (!nodes) return '';
    if (typeof nodes === 'string') return nodes;
    if (Array.isArray(nodes)) return nodes.map(getRawText).join('');
    if (nodes.props && nodes.props.children) return getRawText(nodes.props.children);
    return '';
  };

  const rawText = getRawText(children);
  
  if (rawText.includes('[!WARNING]')) {
    const cleanContent = rawText.replace('[!WARNING]', '').trim();
    return (
      <div className="my-4 p-4 border-l-4 border-black/40 dark:border-l-2 dark:border-white bg-black/[0.02] dark:bg-white/[0.03] rounded-r-xl text-[#333333] dark:text-[#c0c0c0] shadow-sm border border-black/5 dark:border-white/5">
        <div className="font-bold text-black dark:text-white flex items-center gap-1.5 text-xs mb-1 uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" /> Medical Disclaimer
        </div>
        <p className="text-[11px] md:text-xs m-0 leading-relaxed font-semibold">{cleanContent}</p>
      </div>
    );
  }

  if (rawText.includes('[!NOTE]')) {
    const cleanContent = rawText.replace('[!NOTE]', '').trim();
    return (
      <div className="my-4 p-4 border-l-4 border-neutral-400 dark:border-l-2 dark:border-white/30 bg-neutral-50 dark:bg-white/[0.01] rounded-r-xl text-neutral-850 dark:text-[#8a8a8a] shadow-sm border border-black/5 dark:border-white/5">
        <div className="font-bold text-neutral-600 dark:text-[#c0c0c0] flex items-center gap-1.5 text-xs mb-1 uppercase tracking-wider">
          ℹ️ Info Note
        </div>
        <p className="text-[11px] md:text-xs m-0 leading-relaxed font-semibold">{cleanContent}</p>
      </div>
    );
  }

  return (
    <blockquote className="border-l-4 border-black/10 dark:border-l-2 dark:border-white/15 pl-4 my-2 italic text-[#666666] dark:text-[#8a8a8a]">
      {children}
    </blockquote>
  );
};

export default function ChatMessage({ sender, content, timestamp, isStreaming }: MessageProps) {
  const isUser = sender === 'user';
  const [copied, setCopied] = useState(false);
  const { sendMessage, onboardingStep, userName } = useChatStore();

  // Extract custom markup tags before rendering markdown
  const healthCardsRegex = /\[HealthCardsGrid:\s*([^\]]+)\]/;
  const followUpsRegex = /\[FollowUps:\s*([^\]]+)\]/;

  const healthGridMatch = content.match(healthCardsRegex);
  const followUpsMatch = content.match(followUpsRegex);

  // Clean Markdown string
  const cleanContent = content
    .replace(/\[HealthCardsGrid:\s*[^\]]+\]/g, '')
    .replace(/\[FollowUps:\s*[^\]]+\]/g, '')
    .trim();

  // Parse diagnostic health cards
  const cards: Array<{ label: string; value: string; status: string }> = [];
  if (healthGridMatch && healthGridMatch[1]) {
    const parts = healthGridMatch[1].split('|');
    parts.forEach((part) => {
      const segs = part.split('=').map((s) => s.trim());
      if (segs.length === 3) {
        cards.push({ label: segs[0], value: segs[1], status: segs[2] });
      }
    });
  }

  // Parse follow-up question pills
  const followUps: string[] = [];
  if (followUpsMatch && followUpsMatch[1]) {
    const parts = followUpsMatch[1].split('|');
    parts.forEach((part) => {
      const q = part.trim();
      if (q) followUps.push(q);
    });
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const avatarLetter = userName && userName.trim() ? userName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex w-full gap-3 p-4 md:p-6 border-b border-black/[0.03] dark:border-white/[0.03] transition-colors duration-200 justify-start"
    >
      <div className={`flex w-full max-w-4xl mx-auto gap-3 md:gap-5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatars */}
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 flex items-center justify-center text-[#111111] dark:text-white font-bold text-xs shadow-sm">
              {avatarLetter}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-black/[0.02] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 flex items-center justify-center text-[#111111] dark:text-white shadow relative overflow-hidden group">
              <div className="absolute inset-0 bg-black/5 dark:bg-white/5 animate-ping rounded-full opacity-30" />
              <Activity className="w-4 h-4 relative z-10 text-[#111111] dark:text-white" />
            </div>
          )}
        </div>

        {/* Message bubble content */}
        <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-bold text-[#111111] dark:text-white">
              {isUser ? 'You' : 'YHealth AI'}
            </span>
            <span className="text-[9px] text-[#666666] dark:text-[#8a8a8a]">
              {timestamp}
            </span>
          </div>

          <div
            className={`text-[#111111] dark:text-[#c0c0c0] ${
              isUser
                ? 'bg-white/95 dark:bg-white/[0.04] text-[#111111] dark:text-white px-4 py-2.5 shadow-md dark:shadow-xl border border-black/[0.05] dark:border-white/5 rounded-2xl rounded-tr-none text-xs md:text-sm leading-relaxed whitespace-pre-wrap select-text'
                : 'w-full prose text-left'
            }`}
          >
            {isUser ? (
              content
            ) : (
              <>
                {/* Markdown text */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    blockquote: Blockquote,
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      const isInline = !className && !codeString.includes('\n') && codeString.length < 40;

                      if (isInline) {
                        return (
                          <code className="bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-[#111111] dark:text-white px-1 py-0.5 rounded text-xs font-mono font-semibold" {...props}>
                            {children}
                          </code>
                        );
                      }

                      return (
                        <div className="relative my-3 rounded-lg overflow-hidden bg-white/70 dark:bg-black/60 border border-black/10 dark:border-white/10 shadow-sm dark:shadow-xl text-[#111111] dark:text-white">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-black/[0.02] dark:bg-black border-b border-black/5 dark:border-white/5 text-[9px] uppercase font-semibold font-mono tracking-wider text-[#666666] dark:text-[#8a8a8a]">
                            <span>{match ? match[1] : 'code'}</span>
                            <button
                              onClick={() => handleCopyCode(codeString)}
                              className="p-1 px-2 rounded bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] hover:text-black dark:hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copied ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-[#111111] dark:text-white" />
                                  <span className="text-[9px]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span className="text-[9px]">Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed m-0 bg-transparent select-text">
                            <code className="block bg-transparent p-0 m-0 border-0">{children}</code>
                          </pre>
                        </div>
                      );
                    },
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>

                {/* Diagnostic Health Cards Grid Component */}
                {cards.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 my-4 w-full">
                    {cards.map((card, idx) => {
                      const style = getStatusClasses(card.status);
                      const Icon = style.icon;
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border backdrop-blur-md transition-all duration-300 flex flex-col justify-between min-h-[92px] sm:min-h-[104px] hover:scale-[1.02] shadow-sm dark:shadow-md ${style.card}`}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between w-full overflow-hidden">
                            <span 
                              className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate w-full animate-in fade-in"
                              title={card.label}
                            >
                              {card.label}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-widest w-fit shrink-0 ${style.badge}`}>
                              {card.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs sm:text-sm md:text-base font-bold text-[#111111] dark:text-white select-all truncate">
                              {card.value}
                            </span>
                            <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ml-1 ${style.color}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Follow-up question pills */}
                {followUps.length > 0 && (onboardingStep === 'completed' || onboardingStep === 'not_started') && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                    {followUps.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(q)}
                        className="text-left px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/70 dark:bg-white/[0.01] hover:bg-white dark:hover:bg-white/[0.04] text-[#555555] dark:text-[#8a8a8a] hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 transition-all duration-200 flex items-center gap-1 group/pill active:scale-95 cursor-pointer"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/pill:opacity-100 group-hover/pill:translate-x-0 transition-all duration-200 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {/* Blinking cursor for streaming replies */}
            {!isUser && isStreaming && (
              <span className="typing-cursor inline-block animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
