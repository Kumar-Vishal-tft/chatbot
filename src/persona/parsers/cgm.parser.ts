import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseCGM(data: any): ParsedSection {
  const profile = safeGet(data?.cgm_profile, {});
  const activeSensor = safeGet(profile?.active_sensor, {});
  const rolling7 = safeGet(profile?.rolling_7_day, {});

  const sensorName = safeGet(activeSensor?.device_name, "Unknown");
  const sensorStatus = safeGet(activeSensor?.connection_status, "Disconnected");
  
  const averageGlucose = safeGet(rolling7?.average_glucose_mgdl, null);
  const tir = safeGet(rolling7?.tir_percent, null);
  const tar = safeGet(rolling7?.tar_level1_percent, null); // time above range
  const tbr = safeGet(rolling7?.tbr_level1_percent, null); // time below range
  const nocturnalHypos = safeGet(rolling7?.nocturnal_hypo_event_count, 0);

  const summary = `Continuous Glucose Monitor (CGM) Profile:
- **Active Sensor:** ${sensorName} (Status: ${sensorStatus})
- **Rolling 7-Day Statistics:** Avg Glucose: ${averageGlucose ? `${averageGlucose} mg/dL` : "Not Available"}, Time in Range (TIR): ${tir ? `${tir}%` : "Not Available"} (Target: >70%)
- **Glycemic Excursions:** Time Above Range (TAR): ${tar ? `${tar}%` : "N/A"}, Time Below Range (TBR): ${tbr ? `${tbr}%` : "N/A"}, Nocturnal Hypoglycemia Events: ${nocturnalHypos}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (tir && tir < 70) {
    risks.push(`CGM Time In Range (TIR) is low at ${tir}% (Clinical target is >70% in-range).`);
  }
  if (averageGlucose && averageGlucose > 140) {
    risks.push(`Mean 7-day glucose is elevated at ${averageGlucose} mg/dL.`);
  }
  if (nocturnalHypos && nocturnalHypos > 0) {
    risks.push(`Detected ${nocturnalHypos} nocturnal hypoglycemia event(s), posing overnight hazard.`);
    recommendations.push("Consider a small protein-rich snack before bedtime to stabilize overnight blood sugar.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
