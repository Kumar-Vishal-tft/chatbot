export interface ProgramCard {
  title: string;
  subtitle: string;
  prompt: string;
}

export interface CampaignDetail {
  programId: string;
  persona: string;
  heroTagline: string;
  ctaText: string;
  welcomeTemplate: (name: string) => string;
  suggestedPrompts: string[];
  cards: ProgramCard[];
}

export const CAMPAIGN_CONFIG: Record<string, CampaignDetail> = {
  diabetes_reversal: {
    programId: "diabetes",
    persona: "diabetes_agent",
    heroTagline: "YOUR AI DIABETES COACH",
    ctaText: "Book Diabetes Consultation",
    welcomeTemplate: (name) => `Hi ${name}.\n\nI can see you're managing Type 1 Diabetes.\n\nI can help you understand glucose trends, nutrition choices, HbA1c patterns, and diabetes management strategies.`,
    suggestedPrompts: [
      "Why is my glucose high?",
      "Analyze my HbA1c",
      "Create diabetic meal plan",
      "Review CGM trends"
    ],
    cards: [
      { title: "Check HbA1c Risk", subtitle: "Understand diabetes control", prompt: "Explain my HbA1c risk and control measures" },
      { title: "CGM Insights", subtitle: "Analyze glucose patterns", prompt: "How do I analyze my CGM glucose patterns?" },
      { title: "Diabetes Nutrition", subtitle: "Personalized meal guidance", prompt: "Suggest a healthy low-carb diabetic meal plan" },
      { title: "Blood Sugar Questions", subtitle: "Ask diabetes specialist AI", prompt: "What causes sudden blood sugar spikes?" }
    ]
  },
  bp_control: {
    programId: "hypertension",
    persona: "bp_agent",
    heroTagline: "YOUR AI HEART HEALTH COACH",
    ctaText: "Talk to Heart Specialist",
    welcomeTemplate: (name) => `Hi ${name}.\n\nI can help you understand blood pressure trends, lifestyle factors, and heart health recommendations.`,
    suggestedPrompts: [
      "How can I lower BP?",
      "Heart healthy diet",
      "Stress management tips",
      "Review BP readings"
    ],
    cards: [
      { title: "Check BP Risk", subtitle: "Understand hypertension risk", prompt: "Help me understand my blood pressure risk factors" },
      { title: "Low Salt Diet", subtitle: "Heart healthy eating", prompt: "Suggest a low-sodium, heart-healthy meal plan" },
      { title: "Stress Management", subtitle: "Reduce BP naturally", prompt: "How can I reduce blood pressure using stress management?" },
      { title: "Heart Health AI", subtitle: "Talk with BP specialist", prompt: "Give me recommendations for cardiovascular heart health" }
    ]
  },
  weight_loss: {
    programId: "obesity",
    persona: "weight_agent",
    heroTagline: "YOUR AI WEIGHT LOSS COACH",
    ctaText: "Schedule Weight Coach Call",
    welcomeTemplate: (name) => `Hi ${name}.\n\nLet's create a sustainable weight loss plan based on your goals, nutrition habits, and activity levels.`,
    suggestedPrompts: [
      "Calculate calorie deficit",
      "Create weight loss plan",
      "Suggest high protein foods",
      "Track fat loss progress"
    ],
    cards: [
      { title: "Calculate BMI", subtitle: "Know your current status", prompt: "Help me calculate my BMI and healthy target" },
      { title: "Weight Loss Plan", subtitle: "Personalized calorie targets", prompt: "Create a sustainable weight loss plan for me" },
      { title: "Fat Loss Nutrition", subtitle: "High protein recommendations", prompt: "Suggest high protein foods for fat loss" },
      { title: "Exercise Planner", subtitle: "Daily activity guidance", prompt: "Create a daily home exercise and activity planner" }
    ]
  },
  metabolic_health: {
    programId: "metabolic",
    persona: "metabolic_agent",
    heroTagline: "YOUR AI METABOLIC HEALTH COACH",
    ctaText: "Schedule Health Coach Call",
    welcomeTemplate: (name) => `Hi ${name}.\n\nLet's discuss your metabolic health goals, lifestyle optimization, and preventive wellness strategies.`,
    suggestedPrompts: [
      "Improve metabolic rate",
      "Balance energy levels",
      "Metabolic recovery plan",
      "Optimize sleep hygiene"
    ],
    cards: [
      { title: "Metabolic Score", subtitle: "Overall metabolic wellness", prompt: "How is a metabolic wellness score calculated?" },
      { title: "Lifestyle Assessment", subtitle: "Identify risk factors", prompt: "Help me assess my health lifestyle risk factors" },
      { title: "Nutrition Optimization", subtitle: "Improve energy and recovery", prompt: "Suggest nutrition hacks to improve energy and recovery" },
      { title: "Health Coach", subtitle: "Long-term wellness support", prompt: "Connect me with a health coach for long-term support" }
    ]
  }
};
