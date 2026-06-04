import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseWeight(data: any): ParsedSection {
  const profile = safeGet(data?.weight_and_composition_profile, {});
  const trendInfo = safeGet(profile?.trend_available, {});
  const latest = safeGet(profile?.latest_measurement, {});

  const currentWeight = safeGet(latest?.weight_kg, null);
  const bmi = safeGet(latest?.bmi, null);
  const bmiCat = safeGet(latest?.bmi_category, "Normal");

  const trend = safeGet(trendInfo?.trend, "stable");
  const change = safeGet(trendInfo?.weight_change_kg, 0);

  const summary = `Weight & Body Composition Profile:
- **Latest Measurement:** Weight: ${currentWeight ? `${currentWeight} kg` : "Not Available"}, BMI: ${bmi || "N/A"} (${bmiCat})
- **Weight Progress Trend:** Trend direction: ${trend} (${change > 0 ? `+${change}` : change} kg change)`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (bmiCat && (bmiCat.toLowerCase().includes("overweight") || bmiCat.toLowerCase().includes("obese"))) {
    risks.push(`Weight profile categorized as ${bmiCat} (BMI: ${bmi}).`);
  }
  if (trend === "decreasing" && change < 0) {
    recommendations.push(`Keep going! You have safely lost ${Math.abs(change)} kg. Maintain consistent caloric deficit.`);
  }

  return {
    summary,
    risks,
    recommendations
  };
}
