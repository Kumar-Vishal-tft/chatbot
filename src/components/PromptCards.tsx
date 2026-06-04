'use client';

import { useChatStore } from '@/store/chatStore';
import { ArrowRight, FileText, Apple, User, Stethoscope, HeartPulse } from 'lucide-react';

interface PromptCardsProps {
  onVerify?: () => void;
  isVerified?: boolean;
  verifiedName?: string;
  hideExistingCard?: boolean;
}

const BASE_SUGGESTIONS = [
  {
    id: 'report',
    title: 'Analyze my blood report',
    description: 'Blood panel, glucose, cholesterol, and vitamin D levels.',
    prompt: 'Analyze my blood report',
    icon: FileText,
    accent: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20',
    iconAccent: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
  },
  {
    id: 'diet',
    title: 'Weight loss guidance',
    description: 'Caloric balance, high-protein recipes & fat-loss guidance.',
    prompt: 'Provide weight loss guidance',
    icon: Apple,
    accent: 'group-hover:bg-green-50 dark:group-hover:bg-green-950/20',
    iconAccent: 'group-hover:text-green-600 dark:group-hover:text-green-400',
  },
  {
    id: 'diabetes',
    title: 'Diabetes nutrition',
    description: 'Blood sugar control, fiber metrics & low-glycemic plans.',
    prompt: 'Give me diabetes nutrition tips',
    icon: HeartPulse,
    accent: 'group-hover:bg-red-50 dark:group-hover:bg-red-950/20',
    iconAccent: 'group-hover:text-red-500 dark:group-hover:text-red-400',
  },
  {
    id: 'symptom_check',
    title: 'Symptom checker',
    description: 'Analyze sudden headaches, muscle fatigue, or fever symptoms.',
    prompt: 'Analyze my muscle fatigue and mild headache symptoms',
    icon: Stethoscope,
    accent: 'group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20',
    iconAccent: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
  },
];

const RETURNING_SUGGESTIONS = [
  { id: 'blood',     title: 'Latest blood report',      description: 'Review your most recent panel results.',    prompt: 'Review my latest blood report',    icon: FileText,   accent: 'group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20',   iconAccent: 'group-hover:text-blue-600 dark:group-hover:text-blue-400' },
  { id: 'symptom',   title: 'Symptom analysis',          description: 'Continue where we left off.',               prompt: 'Continue my symptom analysis',     icon: Stethoscope, accent: 'group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20', iconAccent: 'group-hover:text-purple-600 dark:group-hover:text-purple-400' },
  { id: 'nutrition', title: 'Nutrition progress',         description: 'Track your dietary goals & milestones.',   prompt: 'Track my nutrition progress',      icon: Apple,       accent: 'group-hover:bg-green-50 dark:group-hover:bg-green-950/20',  iconAccent: 'group-hover:text-green-600 dark:group-hover:text-green-400' },
  { id: 'timeline',  title: 'Consultation timeline',     description: 'View your full clinical history.',          prompt: 'Show my consultation timeline',    icon: User,        accent: 'group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20',  iconAccent: 'group-hover:text-amber-600 dark:group-hover:text-amber-400' },
];

import { CAMPAIGN_CONFIG } from '@/store/campaign-config';
import { captureAnalyticsEvent } from '@/utils/analytics';

export default function PromptCards({ onVerify, isVerified = false, verifiedName, hideExistingCard = false }: PromptCardsProps) {
  const { sendMessage } = useChatStore();

  // Resolve suggestions based on campaign configuration
  let suggestions = BASE_SUGGESTIONS;
  let activeCampaign = 'default';
  let activePersona = 'general_agent';
  let activeProgram = 'general';

  if (typeof window !== 'undefined') {
    const utmCampaign = sessionStorage.getItem('utm_campaign') || 'default';
    const config = CAMPAIGN_CONFIG[utmCampaign] || CAMPAIGN_CONFIG.default;
    if (config) {
      activeCampaign = utmCampaign;
      activePersona = config.persona;
      activeProgram = config.programId;
      
      if (!isVerified) {
        const icons = [FileText, Apple, HeartPulse, Stethoscope];
        const accents = [
          'group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20',
          'group-hover:bg-green-50 dark:group-hover:bg-green-950/20',
          'group-hover:bg-red-50 dark:group-hover:bg-red-950/20',
          'group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20'
        ];
        const iconAccents = [
          'group-hover:text-blue-600 dark:group-hover:text-blue-400',
          'group-hover:text-green-600 dark:group-hover:text-green-400',
          'group-hover:text-red-500 dark:group-hover:text-red-400',
          'group-hover:text-purple-600 dark:group-hover:text-purple-400'
        ];

        suggestions = config.cards.map((c, idx) => ({
          id: `card_${idx}`,
          title: c.title,
          description: c.subtitle,
          prompt: c.prompt,
          icon: icons[idx % icons.length],
          accent: accents[idx % accents.length],
          iconAccent: iconAccents[idx % iconAccents.length]
        }));
      }
    }
  }

  if (isVerified) {
    suggestions = RETURNING_SUGGESTIONS;
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-3.5 w-full px-4 md:px-0 max-w-[1100px] mx-auto flex-shrink min-h-0">
      {suggestions.map((card, idx) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id ?? idx}
            onClick={() => {
              // Capture card click event in analytics
              captureAnalyticsEvent('card_click', {
                utm_campaign: activeCampaign,
                persona: activePersona,
                program: activeProgram,
                card_title: card.title,
                card_prompt: 'prompt' in card ? card.prompt : ''
              });

              if ('prompt' in card && card.prompt) sendMessage(card.prompt);
            }}
            className={`group text-left p-3.5 md:p-4 rounded-[18px]
              bg-white/80 dark:bg-white/[0.03]
              border border-black/[0.06] dark:border-white/[0.07]
              action-card-shadow
              hover:-translate-y-[3px]
              hover:shadow-[0_12px_32px_rgba(0,0,0,0.10)]
              dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.55)]
              hover:border-black/10 dark:hover:border-white/15
              ${card.accent}
              transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
              flex flex-col justify-between
              min-h-[110px] sm:min-h-[118px] md:min-h-[122px]
              h-full w-full cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/20
              relative overflow-hidden`}
          >
            {/* Top: icon + text */}
            <div className="flex flex-col gap-2 w-full">
              <div className={`w-8 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] flex items-center justify-center flex-shrink-0 transition-all duration-300 ${card.iconAccent}`}>
                <Icon className="w-3.5 h-3.5 stroke-[2px] transition-colors duration-300" />
              </div>
              <div>
                <h4 className="font-bold text-[#111111] dark:text-white text-[11px] md:text-[13px] tracking-tight leading-snug group-hover:text-black dark:group-hover:text-white transition-colors duration-200">
                  {isVerified && verifiedName && card.id === 'existing'
                    ? `Continue your care, ${verifiedName}`
                    : card.title}
                </h4>
                <p className="text-[9px] md:text-[10px] text-[#888888] dark:text-[#777777] mt-0.5 leading-[1.4] font-medium group-hover:text-[#555] dark:group-hover:text-[#aaa] transition-colors duration-200">
                  {card.description}
                </p>
              </div>
            </div>

            {/* Bottom arrow */}
            <div className="flex justify-end items-center text-[#aaa] dark:text-[#555] group-hover:text-[#111] dark:group-hover:text-white transition-colors duration-200 mt-2">
              <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

