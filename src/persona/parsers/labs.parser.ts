import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseLabs(data: any): ParsedSection {
  const profile = safeGet(data?.lab_results_profile, {});
  const report = safeGet(profile?.latest_report, {});
  const reportDate = safeGet(report?.report_date, "Not Available");
  const reportName = safeGet(report?.report_name, "Not Available");

  const lipids = safeGet(report?.lipids, {});
  const hematology = safeGet(report?.hematology, {});
  const kidney = safeGet(report?.kidney, {});

  // Extract key markers
  const tc = lipids?.cholesterol_total?.value;
  const ldl = lipids?.ldl_cholesterol?.value;
  const tg = lipids?.triglycerides?.value;
  const hdl = lipids?.hdl_cholesterol?.value;

  const hba1c = hematology?.hba1c?.value;
  let eagVal = null;
  if (hba1c) {
    const numHba1c = Number(hba1c);
    if (!isNaN(numHba1c)) {
      eagVal = Math.round(28.7 * numHba1c - 46.7);
    }
  }
  const fastingGlucose = hematology?.glucose_fasting?.value;
  const hb = hematology?.["hemoglobin_(hb)"]?.value || hematology?.hemoglobin?.value;
  const vitD = hematology?.["vitamin_d,_25_hydroxy"]?.value || hematology?.vitamin_d?.value;
  const tsh = hematology?.tsh?.value;
  const t3 = hematology?.["t3,_total"]?.value;
  const t4 = hematology?.["t4,_total"]?.value;

  const summary = `Lab Results Profile (Latest Report: "${reportName}" dated ${reportDate}):
- **Lipid Panel:** Total Cholesterol: ${tc ? `${tc} mg/dL (ref: <200)` : "N/A"}, LDL: ${ldl ? `${ldl} mg/dL (ref: <100)` : "N/A"}, Triglycerides: ${tg ? `${tg} mg/dL (ref: <150)` : "N/A"}, HDL: ${hdl ? `${hdl} mg/dL (ref: >50)` : "N/A"}
- **Glycemic Markers:** HbA1c: ${hba1c ? `${hba1c}% (ref: 4.0 - 5.6)` : "N/A"}, Fasting Glucose: ${fastingGlucose ? `${fastingGlucose} mg/dL (ref: 70 - 100)` : "N/A"}${eagVal !== null ? `, Estimated Average Glucose (eAG): ${eagVal} mg/dL` : ""}
- **Hormones & Vitals:** TSH: ${tsh ? `${tsh} µIU/mL (ref: 0.27 - 4.2)` : "N/A"}, T3: ${t3 ? `${t3} ng/mL (ref: 0.8 - 2.0)` : "N/A"}, T4: ${t4 ? `${t4} µg/dL (ref: 5.1 - 14.1)` : "N/A"}
- **Nutritional Biomarkers:** Hemoglobin (Hb): ${hb ? `${hb} g/dL (ref: 12.0 - 15.0)` : "N/A"}, Vitamin D3: ${vitD ? `${vitD} nmol/L (ref: 75.0 - 250.0)` : "N/A"}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  // Lipids check
  if (tc && tc > 200) {
    risks.push(`Total Cholesterol is elevated at ${tc} mg/dL (Reference: <200 mg/dL).`);
  }
  if (ldl && ldl > 100) {
    risks.push(`LDL ("bad") Cholesterol is significantly high at ${ldl} mg/dL (Reference: <100 mg/dL), which increases cardiovascular risk.`);
    recommendations.push("Adopt a low-saturated fat diet and introduce soluble fibers (e.g. oats, beans) to help lower LDL.");
  }
  if (tg && tg > 150) {
    risks.push(`Triglycerides are elevated at ${tg} mg/dL (Reference: <150 mg/dL).`);
  }

  // Diabetes risk check
  if (hba1c && hba1c >= 5.7) {
    const diabeticNote = hba1c >= 6.5 ? "Diabetes range" : "Prediabetes range";
    risks.push(`HbA1c is ${hba1c}%, which indicates glycemic concern (${diabeticNote}, Reference: 4.00 - 5.60%).`);
    recommendations.push("Consult your care team regarding insulin sensitivity and blood glucose tracking.");
  }

  // Thyroid check
  if (tsh && tsh > 4.2) {
    risks.push(`TSH is critically elevated at ${tsh} µIU/mL (Reference: 0.27 - 4.20 µIU/mL), accompanied by low T3/T4 (${t3}/${t4}), strongly indicating primary hypothyroidism.`);
    recommendations.push("Urgent endocrinology evaluation is recommended to manage primary thyroid dysfunction.");
  }

  // Anemia check
  if (hb && hb < 12) {
    risks.push(`Hemoglobin is low at ${hb} g/dL (Reference: 12.0 - 15.0 g/dL), indicating potential anemia.`);
    recommendations.push("Consider discussing iron-rich foods or iron levels with your doctor.");
  }

  // Vitamin D check
  if (vitD && vitD < 75) {
    risks.push(`Vitamin D (25-Hydroxy) is severely deficient at ${vitD} nmol/L (Reference: 75.0 - 250.0 nmol/L).`);
    recommendations.push("Discuss high-potency Vitamin D3 supplementation with your physician.");
  }

  return {
    summary,
    risks,
    recommendations
  };
}
