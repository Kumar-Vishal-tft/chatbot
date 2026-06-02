import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseClinical(data: any): ParsedSection {
  const context = safeGet(data?.clinical_context, {});

  const diagnosesList = safeGet(context?.diagnoses, []) as any[];
  const formattedDiagnoses = diagnosesList.length > 0
    ? diagnosesList.map((d: any) => `${d.diagnosis || "Unknown Diagnosis"} (${safeGet(d.status, "unknown")})`).join(', ')
    : "None recorded";

  const isDiabetic = safeGet(context?.is_diabetic, false);
  const isHypertensive = safeGet(context?.is_hypertensive, false);
  const ethnicity = safeGet(context?.ethnicity, "Not specified");

  const primaryGoal = safeGet(context?.primary_goal, "Not specified");
  const allGoals = safeGet(context?.health_goals, []) as string[];
  const formattedGoals = allGoals.length > 0 ? allGoals.join(', ') : "None listed";

  const comorbidities = safeGet(context?.comorbidities, []) as string[];
  const formattedComorbidities = comorbidities.length > 0 ? comorbidities.join(', ') : "None listed";

  const exercise = safeGet(context?.exercise_detail, "Not specified");
  const exerciseFreq = safeGet(context?.exercise_frequency, "Not specified");

  const allergiesList = safeGet(context?.allergies_and_restrictions, []) as any[];
  const formattedAllergies = allergiesList.length > 0
    ? allergiesList.map((a: any) => `${a.allergen || "Allergen"} (severity: ${safeGet(a.reaction_severity, "unspecified")})`).join(', ')
    : "No known allergies";

  const summary = `Clinical Context:
- **Diagnoses:** ${formattedDiagnoses}
- **Primary Health Goal:** ${primaryGoal}
- **All Health Goals:** ${formattedGoals}
- **Comorbidities:** ${formattedComorbidities}
- **Allergies & Restrictions:** ${formattedAllergies}
- **Exercise Details:** ${exercise} (${exerciseFreq})
- **Demographics & Profile:** Ethnicity: ${ethnicity}, Diabetic: ${isDiabetic ? "Yes" : "No"}, Hypertensive: ${isHypertensive ? "Yes" : "No"}`;

  const risks: string[] = [];
  if (isDiabetic) {
    risks.push("Patient has active diabetes diagnosis requiring strict glycemic controls.");
  }
  if (diagnosesList.some(d => String(d.diagnosis).toLowerCase().includes("gestational diabetes"))) {
    risks.push("History of gestational diabetes increases risk of developing persistent Type 2 diabetes.");
  }
  if (isHypertensive) {
    risks.push("Hypertension indicated. Blood pressure must be monitored closely.");
  }
  if (comorbidities.length > 3) {
    risks.push(`Multiple active comorbidities present: ${formattedComorbidities}.`);
  }

  const recommendations: string[] = [];
  if (isDiabetic) {
    recommendations.push("Recommend tracking meals and monitoring post-meal glucose spikes closely.");
  }
  if (exerciseFreq && exerciseFreq.toLowerCase().includes("none")) {
    recommendations.push("Encourage introducing low-intensity active minutes (e.g. 15-minute daily walks) to support glucose sensitivity.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
