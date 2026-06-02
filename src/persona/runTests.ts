import { activePersonaManager, PersonaSectionName } from './PersonaManager';
import { PATIENT_PERSONA_MOCK } from './patientMock';
import { safeGet } from './safeGet';

// Color logging helpers
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m"
};

function logHeader(text: string) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${text} ===${colors.reset}`);
}

function logSuccess(text: string) {
  console.log(`${colors.green}✓ PASS: ${text}${colors.reset}`);
}

function logError(text: string, err?: any) {
  console.log(`${colors.red}✗ FAIL: ${text}${colors.reset}`);
  if (err) console.error(err);
}

// Global pass flag
let allPassed = true;

function assert(condition: boolean, message: string) {
  if (condition) {
    logSuccess(message);
  } else {
    logError(message);
    allPassed = false;
  }
}

async function runAllTests() {
  logHeader("YHEALTH CLINICAL PERSONA ARCHITECTURE TEST SUITE");

  // 1. Test safeGet Utility
  logHeader("TESTING: safeGet Utility");
  try {
    assert(safeGet(null, "Fallback") === "Fallback", "safeGet returns fallback for null");
    assert(safeGet(undefined, "Fallback") === "Fallback", "safeGet returns fallback for undefined");
    assert(safeGet("", "Fallback") === "Fallback", "safeGet returns fallback for empty string");
    assert(safeGet([], "Fallback") === "Fallback", "safeGet returns fallback for empty array");
    assert(safeGet({}, "Fallback") === "Fallback", "safeGet returns fallback for empty object");
    assert(safeGet("Valid Content", "Fallback") === "Valid Content", "safeGet preserves valid strings");
    assert(safeGet(42, "Fallback") === 42, "safeGet preserves valid numbers");
  } catch (err) {
    logError("safeGet suite threw unexpected exception", err);
    allPassed = false;
  }

  // Load patient mock data into activePersonaManager
  activePersonaManager.loadPersona(PATIENT_PERSONA_MOCK);

  // 2. Test Parsers individually
  const sectionsToTest: { section: PersonaSectionName; expectedKeywords: string[]; expectedRisks?: string[] }[] = [
    {
      section: 'identity',
      expectedKeywords: ["Neha Aggarwal", "BMI: 24.9", "Height: 167.64 cm", "Weight: 70 kg"],
      expectedRisks: []
    },
    {
      section: 'clinical_context',
      expectedKeywords: ["Gestational Diabetes", "Primary Health Goal", "Drug Allergy"],
      expectedRisks: ["gestational diabetes"]
    },
    {
      section: 'lab_results_profile',
      expectedKeywords: ["Total Cholesterol: 338.86", "LDL: 225.55", "TSH: 371.2", "HbA1c: 5.7%"],
      expectedRisks: ["TSH is critically elevated", "LDL (\"bad\") Cholesterol is significantly high", "HbA1c is 5.7%", "Vitamin D"]
    },
    {
      section: 'medications_profile',
      expectedKeywords: ["Gluxit Trio 500/5mg", "Adherence Rate"],
      expectedRisks: ["Medication adherence is extremely low"]
    },
    {
      section: 'cgm_profile',
      expectedKeywords: ["Time in Range (TIR): 81%"],
      expectedRisks: []
    },
    {
      section: 'glucometer_profile',
      expectedKeywords: ["High Readings: 5", "Average: 148 mg/dL"],
      expectedRisks: ["high glucometer readings flagged"]
    },
    {
      section: 'nutrition_profile',
      expectedKeywords: ["Besan Chilla", "Protein: 19.8g", "Carbs: 44.2g", "Glycemic Load: 22.1"],
      expectedRisks: ["high Glycemic Load"]
    },
    {
      section: 'symptoms_profile',
      expectedKeywords: ["Last 30 Days: 6", "pain", "nausea", "dizziness", "rash"],
      expectedRisks: ["active symptoms"]
    },
    {
      section: 'face_scan_profile',
      expectedKeywords: ["Pulse Rate: 95 bpm", "Stress Index: 294"],
      expectedRisks: ["stress index is high", "resting pulse rate"]
    },
    {
      section: 'activity_profile',
      expectedKeywords: ["Active Minutes: 15 mins/week", "Steps: 830 steps"],
      expectedRisks: ["below the recommended clinical target", "step count is low"]
    },
    {
      section: 'blood_pressure_profile',
      expectedKeywords: ["Latest Reading"],
      expectedRisks: []
    },
    {
      section: 'weight_and_composition_profile',
      expectedKeywords: ["Weight: 70 kg", "BMI: 24.9"],
      expectedRisks: []
    },
    {
      section: 'care_team',
      expectedKeywords: ["Samarth Gupta", "Endocrinologist"],
      expectedRisks: []
    }
  ];

  for (const t of sectionsToTest) {
    logHeader(`TESTING: ${t.section.toUpperCase()} parser`);
    try {
      const parsed = activePersonaManager.getSection(t.section);
      
      // Check summary keywords
      t.expectedKeywords.forEach(kw => {
        assert(
          parsed.summary.toLowerCase().includes(kw.toLowerCase()),
          `Summary contains keyword "${kw}"`
        );
      });

      // Check risk triggers
      if (t.expectedRisks && t.expectedRisks.length > 0) {
        t.expectedRisks.forEach(riskKw => {
          const match = parsed.risks.some(r => r.toLowerCase().includes(riskKw.toLowerCase()));
          assert(match, `Risks correctly identify flag containing "${riskKw}"`);
        });
      }

      // Check format structures
      assert(parsed.summary !== "", "Summary is not empty");
      assert(Array.isArray(parsed.risks), "Risks is an array");
      assert(Array.isArray(parsed.recommendations), "Recommendations is an array");

    } catch (err) {
      logError(`Section parser "${t.section}" threw unexpected error`, err);
      allPassed = false;
    }
  }

  logHeader("TESTING COMPLETE");
  if (allPassed) {
    console.log(`\n${colors.bold}${colors.green}🎉 ALL 12 CLINICAL PARSERS & UTILITIES SUCCESSFULLY PASSED ALL UNIT TESTS! 🎉${colors.reset}\n`);
  } else {
    console.log(`\n${colors.bold}${colors.red}❌ SOME UNIT TEST CASES FAILED! PLEASE CHECK THE ERRORS ABOVE. ❌${colors.reset}\n`);
    process.exit(1);
  }
}

runAllTests();
