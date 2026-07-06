import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseIdentity(data: any): ParsedSection {
  const identity = safeGet(data?.identity, {});
  const anthropometry = safeGet(identity?.anthropometry, {});

  const firstName = safeGet(identity?.first_name, "");
  const lastName = safeGet(identity?.last_name, "");
  const fullName = firstName && lastName ? `${firstName} ${lastName}`.trim() : (firstName || lastName || "Patient");

  const age = safeGet(identity?.age_years, "Not shared");
  const gender = safeGet(identity?.gender, "Not shared");
  const dob = safeGet(identity?.date_of_birth, "Not shared");
  const countryCode = safeGet(identity?.country_code, "");
  const phone = identity?.phone ? safeGet(identity.phone) : "Not Shared";
  const timezone = safeGet(identity?.timezone, "Asia/Kolkata");

  const weight = safeGet(anthropometry?.weight_kg, safeGet(identity?.weight_kg, null));
  const height = safeGet(anthropometry?.height_cm, safeGet(identity?.height_cm, null));
  const bmi = safeGet(anthropometry?.bmi, null);
  const bmiCat = safeGet(anthropometry?.bmi_category, "Unknown");
  const bmr = safeGet(anthropometry?.bmr_kcal, null);
  const maintenance = safeGet(anthropometry?.maintenance_calories_kcal, null);
  const weightLoss = safeGet(anthropometry?.weight_loss_calories_kcal, null);

  const summary = `Patient Profile:
- **Name:** ${fullName}
- **Age / Gender:** ${age} years / ${gender}
- **DOB:** ${dob}
- **Location Context:** Timezone: ${timezone}, Phone prefix: ${countryCode}
- **Physical Metrics:** Height: ${height ? `${height} cm` : "Not Available"}, Weight: ${weight ? `${weight} kg` : "Not Available"}
- **Metabolic Profile:** BMI: ${bmi || "Not Available"} (${bmiCat}), BMR: ${bmr ? `${bmr} kcal` : "Not Available"}, Maintenance: ${maintenance ? `${maintenance} kcal` : "Not Available"}, Weight Loss Budget: ${weightLoss ? `${weightLoss} kcal` : "Not Available"}`;

  const risks: string[] = [];
  if (bmiCat && bmiCat.toLowerCase().includes("overweight")) {
    risks.push(`BMI is ${bmi} (${bmiCat}), suggesting borderline high weight.`);
  } else if (bmiCat && bmiCat.toLowerCase().includes("obese")) {
    risks.push(`BMI is ${bmi} (${bmiCat}), signaling obesity and increased metabolic risk.`);
  }

  const recommendations: string[] = [];
  if (weightLoss) {
    recommendations.push(`Support weight goals by aligning diet to the ${weightLoss} kcal weight loss calorie budget.`);
  }

  return {
    summary,
    risks,
    recommendations
  };
}
