import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseMedication(data: any): ParsedSection {
  const profile = safeGet(data?.medications_profile, {});
  const activeMeds = safeGet(profile?.active_medications, []) as any[];
  const adherenceAllTime = safeGet(profile?.adherence_all_time, {});
  const trend = safeGet(profile?.adherence_trend, "unknown");

  const formattedMeds = activeMeds.length > 0
    ? activeMeds.map((m: any) => {
        const times = safeGet(m.intake_times, []).join(', ');
        return `**${m.name}** (Freq: ${safeGet(m.frequency, "everyday")}, Times: ${times || "None Specified"})`;
      }).join('; ')
    : "No active medications listed";

  const adherenceRate = adherenceAllTime?.adherence_rate_percent !== undefined
    ? adherenceAllTime.adherence_rate_percent
    : null;
  const missed = safeGet(adherenceAllTime?.missed, 0);
  const taken = safeGet(adherenceAllTime?.taken, 0);

  const summary = `Prescription & Medication Profile:
- **Active Medications:** ${formattedMeds}
- **Medication Adherence Rate:** ${adherenceRate !== null ? `${adherenceRate}%` : "Not Tracked"} (Taken: ${taken}, Missed: ${missed})
- **Adherence Trend:** ${trend}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (adherenceRate !== null && adherenceRate < 80) {
    risks.push(`Medication adherence is extremely low at ${adherenceRate}% (Missed ${missed} out of ${taken + missed} doses).`);
    recommendations.push("Create a regular alarm schedule or use a pillbox organizer to establish consistent medication habit.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
