import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseNutrition(data: any): ParsedSection {
  const profile = safeGet(data?.nutrition_profile, {});
  const lastMeal = safeGet(profile?.last_logged_meal, {});
  const macros = safeGet(lastMeal?.macronutrients, {});
  const glycemic = safeGet(lastMeal?.glycemic_metrics, {});

  const mealName = safeGet(lastMeal?.meal_name, "None recorded");
  const mealType = safeGet(lastMeal?.meal_type, "N/A");
  const qualityScore = safeGet(lastMeal?.quality_score, null);

  const formatMacro = (val: any) => {
    if (val === null || val === undefined || typeof val !== 'number') return "N/A";
    return val % 1 === 0 ? val.toString() : val.toFixed(1);
  };

  const cal = safeGet(macros?.calories, null);
  const fiberVal = safeGet(macros?.fiber_g, null);

  const protein = macros?.protein_g !== undefined ? formatMacro(macros.protein_g) : "N/A";
  const carbs = macros?.carbs_g !== undefined ? formatMacro(macros.carbs_g) : "N/A";
  const fat = macros?.fat_g !== undefined ? formatMacro(macros.fat_g) : "N/A";
  const fiber = fiberVal !== null ? formatMacro(fiberVal) : "N/A";

  const gl = safeGet(glycemic?.glycemic_load, null);
  const glCategory = safeGet(glycemic?.glycemic_category, "Unknown");

  const summary = `Nutrition & Dietary Profile:
- **Last Logged Meal:** "${mealName}" (${mealType})
- **Meal Quality Score:** ${qualityScore ? `${qualityScore}/10` : "N/A"}
- **Macros Distribution:** Calories: ${cal ? `${Math.round(cal)} kcal` : "N/A"}, Protein: ${protein}g, Carbs: ${carbs}g, Fat: ${fat}g, Fiber: ${fiber}g
- **Glycemic Impact:** Glycemic Load: ${gl || "N/A"} (${glCategory})`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (glCategory && glCategory.toLowerCase() === "high") {
    risks.push(`Last meal generated a high Glycemic Load of ${gl}, risking acute blood sugar spike.`);
    recommendations.push("Substitute high glycemic meal elements with low-glycemic, complex carbohydrates (e.g. brown rice, oats) and healthy fats.");
  }
  if (fiberVal !== null && fiberVal < 8) {
    risks.push(`Last logged meal fiber content (${fiber}g) is suboptimal.`);
    recommendations.push("Incorporate fiber-rich seeds, leafy greens, or psyllium husk to boost digestive and metabolic response.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
