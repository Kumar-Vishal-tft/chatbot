import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseActivity(data: any): ParsedSection {
  const profile = safeGet(data?.activity_profile, {});
  const weekly = safeGet(profile?.weekly_summary, safeGet(data?.weekly_summary, {}));
  const latest = safeGet(profile?.healthkit_latest, safeGet(data?.healthkit_latest, {}));
  const hk30 = safeGet(profile?.healthkit_30_day, safeGet(data?.healthkit_30_day, {}));
  const engagement = safeGet(data?.engagement, {});

  const sessionCount = safeGet(weekly?.session_count, 0);
  const weeklyMinutes = safeGet(weekly?.total_minutes, 0);

  const steps = safeGet(latest?.steps, null);
  const sleep = safeGet(latest?.sleep_minutes, null);
  
  // Extract active calories vs total calories
  const activeCals = safeGet(latest?.active_calories_kcal, safeGet(latest?.active_calories, null));
  const totalCals = safeGet(latest?.total_calories, safeGet(latest?.calories, null));
  const source = safeGet(latest?.source, "Unknown Source");
  
  const daysSinceLastActive = safeGet(engagement?.days_since_last_active, null);

  // Extract 30 day averages
  const avgSteps = safeGet(hk30?.avg_daily_steps, null);
  const avgSleep = safeGet(hk30?.avg_daily_sleep_minutes, null);
  const avgActiveCals = safeGet(hk30?.avg_daily_active_calories_kcal, null);

  const summary = `Physical Activity & Sleep Profile:
- **Weekly Workout Summary:** Active Sessions: ${sessionCount}, Active Minutes: ${weeklyMinutes} mins/week (Target: >150 mins)
- **Latest Daily Metrics (${source}):** Steps: ${steps !== null ? `${steps} steps` : "Not Tracked"}, Active Calories Burned: ${activeCals !== null ? `${activeCals} kcal` : (totalCals !== null ? `${totalCals} kcal` : "Not Tracked")}, Sleep Duration: ${sleep !== null ? `${Math.round(sleep / 60)} hrs` : "Not Tracked"}${totalCals !== null && activeCals !== null ? `, Total Calories: ${totalCals} kcal` : ""}
- **30-Day Averages:** Avg Daily Steps: ${avgSteps !== null ? `${avgSteps} steps` : "Not enough data"}, Avg Daily Active Calories: ${avgActiveCals !== null ? `${avgActiveCals} kcal` : "Not enough data"}, Avg Daily Sleep: ${avgSleep !== null ? `${Math.round(avgSleep / 60)} hrs` : "Not enough data"}
- **User Activity & Engagement:** Days since last active: ${daysSinceLastActive !== null ? `${daysSinceLastActive} days` : "Unknown"}`;

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
