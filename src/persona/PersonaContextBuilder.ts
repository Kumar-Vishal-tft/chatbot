import { PersonaManager, PersonaSectionName, ParsedSection } from './PersonaManager';

export class PersonaContextBuilder {
  /**
   * Evaluates the incoming user query and resolves which on-demand persona sections should be loaded
   */
  private static determineSectionsForQuery(query: string): PersonaSectionName[] {
    const q = query.toLowerCase();
    const sections = new Set<PersonaSectionName>();

    // 1. Diabetes & Glycemic Routing
    if (
      /\b(diabetic|diabetes|glucose|blood sugar|sugar|insulin|cgm|libre|glucometer|fasting|post-meal|gluxit)\b/i.test(q)
    ) {
      sections.add('cgm_profile');
      sections.add('glucometer_profile');
      sections.add('medications_profile');
      sections.add('clinical_context');
    }

    // 2. Cardiovascular & Blood Pressure Routing
    if (
      /\b(blood pressure|bp|hypertension|hypertensive|systolic|diastolic|heart|pulse|cardio)\b/i.test(q)
    ) {
      sections.add('blood_pressure_profile');
      sections.add('face_scan_profile');
      sections.add('clinical_context');
    }

    // 3. Labs, Lipids, Thyroid & Cholesterol Routing
    if (
      /\b(cholesterol|lipid|ldl|hdl|triglycerides|tsh|thyroid|t3|t4|hypothyroidism|biomarker|lab|report|blood report|hemoglobin|anemia|vitamin|b12|kidney|urea|creatinine)\b/i.test(q)
    ) {
      sections.add('lab_results_profile');
      sections.add('clinical_context');
    }

    // 4. Medication & Adherence Routing
    if (
      /\b(medication|medicine|pill|tablet|prescribe|prescription|dose|adherence|take|took|missed)\b/i.test(q)
    ) {
      sections.add('medications_profile');
      sections.add('care_team');
    }

    // 5. Nutrition & Weight Routing
    if (
      /\b(nutrition|diet|meal|food|eat|calories|kcal|macros|protein|carbs|fat|fiber|breakfast|lunch|dinner|weight|bmi|bmr|lose|gain|obese|obesity|body fat|muscle)\b/i.test(q)
    ) {
      sections.add('nutrition_profile');
      sections.add('weight_and_composition_profile');
      sections.add('identity');
    }

    // 6. Symptoms & History Routing
    if (
      /\b(symptom|pain|headache|migraine|dehydration|dizziness|nausea|fatigue|cough|rash|feel|ill|sick|hurt)\b/i.test(q)
    ) {
      sections.add('symptoms_profile');
      sections.add('clinical_context');
      sections.add('care_team');
    }

    // 7. Activity & Steps Routing
    if (
      /\b(exercise|workout|activity|steps|walk|run|gym|training|active|sleep|rest|hours)\b/i.test(q)
    ) {
      sections.add('activity_profile');
    }

    // 8. Care Team & Doctors Routing
    if (
      /\b(doctor|physician|endocrinologist|samarth|gupta|consult|consultation|program|renew|clinic)\b/i.test(q)
    ) {
      sections.add('care_team');
    }

    return Array.from(sections);
  }

  /**
   * Main builder method generating a structured, token-reduced, query-centric prompt context block
   */
  public static buildContext(query: string, manager: PersonaManager): string {
    if (!manager.getRawPersona()) {
      return "No clinical profile is currently loaded.";
    }

    // 1. Gather baseline Level 1 Context (always active)
    const shortSummary = manager.getShortSummary();
    const detailedSummary = manager.getDetailedSummary();
    const executiveSummary = manager.getExecutiveSummary();

    // 2. Identify and lazy load Level 2 On-Demand Sections
    const requiredSections = this.determineSectionsForQuery(query);
    
    let loadedSectionsBlock = "";
    const activeRisks: string[] = [];
    const activeRecs: string[] = [];

    if (requiredSections.length > 0) {
      loadedSectionsBlock = "\n\n### ROUTED CLINICAL PROFILE SECTIONS (ON-DEMAND):\n";
      
      requiredSections.forEach((secName) => {
        const parsed: ParsedSection = manager.getSection(secName);
        loadedSectionsBlock += `\n#### ${secName.toUpperCase()} SUMMARY:\n${parsed.summary}\n`;
        
        if (parsed.risks.length > 0) {
          activeRisks.push(...parsed.risks);
        }
        if (parsed.recommendations.length > 0) {
          activeRecs.push(...parsed.recommendations);
        }
      });
    }

    // 3. Compile final context block
    let context = `PATIENT METADATA (PRIMARY SUMMARY):
- **Short Summary:** ${shortSummary}
- **Detailed Profile:** ${detailedSummary}
- **Executive Clinical Summary:** ${executiveSummary}`;

    if (loadedSectionsBlock) {
      context += loadedSectionsBlock;
    }

    if (activeRisks.length > 0) {
      context += `\n\n### CRITICAL PATIENT HEALTH RISKS:\n${activeRisks.map(r => `- ${r}`).join('\n')}`;
    }

    if (activeRecs.length > 0) {
      context += `\n\n### RECOMMENDED LIFESTYLE ADJUSTMENTS:\n${activeRecs.map(r => `- ${r}`).join('\n')}`;
    }

    return context;
  }
}
