import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseFaceScan(data: any): ParsedSection {
  const profile = safeGet(data?.face_scan_profile, {});
  const latest = safeGet(profile?.latest_scan, {});
  const hrv = safeGet(latest?.hrv_metrics, {});
  const risk = safeGet(latest?.risk_scores, {});
  const stress = safeGet(latest?.stress_metrics, {});
  const wellness = safeGet(latest?.wellness_metrics, {});
  const autonomic = safeGet(latest?.autonomic_balance, {});
  const vitals = safeGet(latest?.vital_signs_extracted, {});
  const trends = safeGet(profile?.trend, {});

  const pulse = safeGet(vitals?.pulse_rate_bpm, null);
  const resp = safeGet(vitals?.respiration_rate_rpm, null);
  const spo2 = safeGet(vitals?.oxygen_saturation_percent, null);

  const stressIndex = safeGet(stress?.stress_index, null);
  const stressLevel = safeGet(stress?.stress_level, "Unknown");
  const wellnessIndex = safeGet(wellness?.wellness_index, null);
  const wellnessLevel = safeGet(wellness?.wellness_level, "Unknown");

  const sdnn = safeGet(hrv?.sdnn, null);
  const rmssd = safeGet(hrv?.rmssd, null);

  const sns = safeGet(autonomic?.sns_index, null);
  const pns = safeGet(autonomic?.pns_index, null);

  const stressDirection = safeGet(trends?.stress_direction, "stable");
  const wellnessDirection = safeGet(trends?.wellness_direction, "stable");

  const summary = `Face Scan Physiological Vitals Profile:
- **Vital Signs Extracted:** Pulse Rate: ${pulse ? `${pulse} bpm` : "N/A"}, Respiration Rate: ${resp ? `${resp} rpm` : "N/A"}, SpO2: ${spo2 ? `${spo2}%` : "N/A"}
- **Wellness & Stress Metrics:** Wellness Score: ${wellnessIndex || "N/A"} (${wellnessLevel}, trend: ${wellnessDirection}), Stress Index: ${stressIndex || "N/A"} (${stressLevel}, trend: ${stressDirection})
- **Autonomic Nervous System & HRV:** SDNN: ${sdnn ? `${sdnn}ms` : "N/A"}, RMSSD: ${rmssd ? `${rmssd}ms` : "N/A"}, SNS Index: ${sns || "N/A"}, PNS Index: ${pns || "N/A"}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (stressIndex && stressIndex > 250) {
    risks.push(`Physiological stress index is high at ${stressIndex} (${stressLevel} level), and the stress trend is ${stressDirection}.`);
  }
  if (pulse && pulse > 90) {
    risks.push(`Resting pulse rate extracted from scan is high at ${pulse} bpm.`);
  }
  if (sns && sns > 2.0) {
    risks.push(`Autonomic nervous balance indicates Sympathetic Nervous System hyper-activation (SNS Index: ${sns}).`);
    recommendations.push("Practice 5-5 paced box breathing (5s inhale, 5s exhale) for 5 minutes to restore Parasympathetic Nervous System tone.");
  }
  if (spo2 && spo2 < 95) {
    risks.push(`Extracted SpO2 blood oxygen saturation is low at ${spo2}%.`);
  }

  return {
    summary,
    risks,
    recommendations
  };
}
