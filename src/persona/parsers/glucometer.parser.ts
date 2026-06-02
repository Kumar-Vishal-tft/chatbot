import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseGlucometer(data: any): ParsedSection {
  const profile = safeGet(data?.glucometer_profile, {});
  const lastReading = safeGet(profile?.last_reading, {});
  const averages = safeGet(profile?.averages_mgdl, {});
  const flagged = safeGet(profile?.flagged_readings, []) as any[];

  const isConnected = safeGet(profile?.is_connected, false);
  const totalReadings = safeGet(profile?.readings_total, 0);
  
  const lastVal = safeGet(lastReading?.value_mgdl, null);
  const lastSlot = safeGet(lastReading?.slot, "Unknown Time");

  const avgAllTime = safeGet(averages?.all_available, null);
  const formattedAvg = avgAllTime !== null ? `${Math.round(avgAllTime)} mg/dL` : "Not Available";

  const highReadings = flagged.filter((r: any) => r.flag === "HIGH");
  const lowReadings = flagged.filter((r: any) => r.flag === "LOW");

  const summary = `Manual Glucometer Profile:
- **Device Connectivity:** Connected: ${isConnected ? "Yes" : "No"}, Total Readings Logged: ${totalReadings}
- **Last Reading:** ${lastVal ? `${lastVal} mg/dL` : "N/A"} (${lastSlot})
- **Glucometer Averages:** All-Time Average: ${formattedAvg}
- **Flagged Deviations:** High Readings: ${highReadings.length}, Low Readings: ${lowReadings.length}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (highReadings.length > 0) {
    const highest = Math.max(...highReadings.map((r: any) => r.value_mgdl));
    risks.push(`Multiple high glucometer readings flagged. Highest noted peak: ${highest} mg/dL.`);
    recommendations.push("Ensure post-meal activity (e.g. 10 minutes walking) is incorporated to flatten postprandial glucose spikes.");
  }
  if (lowReadings.length > 0) {
    risks.push(`Low blood sugar events (${lowReadings.length}) flagged in glucometer history.`);
  }

  return {
    summary,
    risks,
    recommendations
  };
}
