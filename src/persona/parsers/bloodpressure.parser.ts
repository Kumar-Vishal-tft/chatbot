import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseBloodPressure(data: any): ParsedSection {
  const profile = safeGet(data?.blood_pressure_profile, {});
  const lastReading = safeGet(profile?.last_valid_reading, {});
  const target = safeGet(profile?.target_range, "< 130/80 mmHg");

  const sys = safeGet(lastReading?.systolic, null);
  const dia = safeGet(lastReading?.diastolic, null);
  const status = safeGet(lastReading?.status, "Normal");
  const totalReadings = safeGet(profile?.total_valid_readings, 0);

  const summary = `Cardiovascular & Blood Pressure Profile:
- **Latest Reading:** ${sys !== null && dia !== null ? `${sys}/${dia} mmHg` : "Not Available"} (Status: ${status})
- **Target Threshold:** ${target}
- **Log Metrics:** Total Valid BP Logs: ${totalReadings}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (sys !== null && dia !== null) {
    if (sys >= 130 || dia >= 80) {
      risks.push(`Blood Pressure is elevated at ${sys}/${dia} mmHg (Status: ${status}).`);
      recommendations.push("Reduce sodium intake, prioritize magnesium-rich foods (seeds, leafy greens), and maintain low-intensity exercise habits.");
    }
  }

  return {
    summary,
    risks,
    recommendations
  };
}
