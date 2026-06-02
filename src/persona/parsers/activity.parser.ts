import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseActivity(data: any): ParsedSection {
  const profile = safeGet(data?.activity_profile, {});
  const weekly = safeGet(profile?.weekly_summary, {});
  const latest = safeGet(profile?.healthkit_latest, {});

  const sessionCount = safeGet(weekly?.session_count, 0);
  const weeklyMinutes = safeGet(weekly?.total_minutes, 0);

  const steps = safeGet(latest?.steps, null);
  const sleep = safeGet(latest?.sleep_minutes, null);
  const cals = safeGet(latest?.total_calories, null);
  const source = safeGet(latest?.source, "Unknown Source");

  const summary = `Physical Activity & Sleep Profile:
- **Weekly Workout Summary:** Active Sessions: ${sessionCount}, Active Minutes: ${weeklyMinutes} mins/week (Target: >150 mins)
- **Latest Daily Metrics (${source}):** Steps: ${steps !== null ? `${steps} steps` : "Not Tracked"}, Active Calories: ${cals !== null ? `${cals} kcal` : "Not Tracked"}, Sleep Duration: ${sleep !== null ? `${Math.round(sleep / 60)} hrs` : "Not Tracked"}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (weeklyMinutes && weeklyMinutes < 150) {
    risks.push(`Weekly physical activity is only ${weeklyMinutes} minutes, below the recommended clinical target of 150 minutes.`);
    recommendations.push("Schedule at least 30 minutes of moderate activity (brisk walking, cycling) 5 days a week.");
  }
  if (steps !== null && steps < 5000) {
    risks.push(`Daily step count is low at ${steps} steps.`);
    recommendations.push("Aim to gradually increase your daily step target toward 8,000–10,000 steps.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
