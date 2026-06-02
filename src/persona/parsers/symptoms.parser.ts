import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseSymptoms(data: any): ParsedSection {
  const profile = safeGet(data?.symptoms_profile, {});
  const latestLog = safeGet(profile?.latest_symptom_log, {});
  const common = safeGet(profile?.most_common_symptoms, []) as any[];

  const logs30Day = safeGet(profile?.logs_30_day, 0);
  const avgSeverity = safeGet(profile?.avg_severity_30_day, null);
  const maxSeverity = safeGet(profile?.max_severity_30_day, null);
  const hasActive = safeGet(profile?.has_active_symptoms, false);

  const latestList = safeGet(latestLog?.symptoms, []) as string[];
  const formattedLatest = latestList.length > 0 ? latestList.join(', ') : "None logged";
  const latestSeverity = safeGet(latestLog?.severity, null);

  const formattedCommon = common.length > 0
    ? common.map((s: any) => `${s.symptom} (Logged ${safeGet(s.occurrences, 0)} times, Avg Severity: ${safeGet(s.avg_severity, "N/A")})`).join('; ')
    : "No repeated symptoms recorded";

  const summary = `Symptoms Log Profile (Last 30 Days: ${logs30Day} logs):
- **Active Symptom State:** Active Complaints: ${hasActive ? "Yes" : "No"}, Avg Severity: ${avgSeverity || "N/A"}/10, Peak Severity: ${maxSeverity || "N/A"}/10
- **Latest Symptom Occurrence:** Logged: [${formattedLatest}] (Severity: ${latestSeverity !== null ? `${latestSeverity}/10` : "N/A"})
- **Most Common Historical Symptoms:** ${formattedCommon}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (hasActive) {
    risks.push(`Patient is currently experiencing active symptoms: ${formattedLatest}.`);
  }
  if (maxSeverity && maxSeverity >= 7) {
    risks.push(`High symptom severity noted in last 30 days (Peak: ${maxSeverity}/10).`);
  }
  if (latestList.includes("pain") || latestList.includes("dizziness")) {
    recommendations.push("Ensure rest, avoid physical overexertion, and monitor blood pressure/hydration parameters closely during symptom flare-ups.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
