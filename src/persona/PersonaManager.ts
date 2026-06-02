import { safeGet } from './safeGet';
import { parseIdentity } from './parsers/identity.parser';
import { parseClinical } from './parsers/clinical.parser';
import { parseLabs } from './parsers/labs.parser';
import { parseMedication } from './parsers/medication.parser';
import { parseCGM } from './parsers/cgm.parser';
import { parseGlucometer } from './parsers/glucometer.parser';
import { parseNutrition } from './parsers/nutrition.parser';
import { parseSymptoms } from './parsers/symptoms.parser';
import { parseFaceScan } from './parsers/facescan.parser';
import { parseActivity } from './parsers/activity.parser';
import { parseBloodPressure } from './parsers/bloodpressure.parser';
import { parseWeight } from './parsers/weight.parser';
import { parseCareTeam } from './parsers/careteam.parser';

export interface ParsedSection {
  summary: string;
  risks: string[];
  recommendations: string[];
}

export type PersonaSectionName =
  | 'identity'
  | 'clinical_context'
  | 'lab_results_profile'
  | 'medications_profile'
  | 'cgm_profile'
  | 'glucometer_profile'
  | 'nutrition_profile'
  | 'symptoms_profile'
  | 'face_scan_profile'
  | 'activity_profile'
  | 'blood_pressure_profile'
  | 'weight_and_composition_profile'
  | 'care_team';

export class PersonaManager {
  private rawPersona: any = null;
  private cachedSections: Partial<Record<PersonaSectionName, ParsedSection>> = {};
  private lastFetchedEpoch: number = 0;
  private cacheDurationMs: number = 15 * 60 * 1000; // 15 mins session TTL

  constructor(personaData?: any) {
    if (personaData) {
      this.loadPersona(personaData);
    }
  }

  /**
   * Resets raw data and flushes previously cached section parsers
   */
  public loadPersona(personaData: any): void {
    this.rawPersona = personaData;
    this.cachedSections = {};
    this.lastFetchedEpoch = Date.now();
  }

  public getRawPersona(): any {
    return this.rawPersona;
  }

  public isCacheValid(): boolean {
    if (!this.rawPersona) return false;
    return (Date.now() - this.lastFetchedEpoch) < this.cacheDurationMs;
  }

  public clearCache(): void {
    this.rawPersona = null;
    this.cachedSections = {};
    this.lastFetchedEpoch = 0;
  }

  private sanitizeSelfAssignment(text: string): string {
    if (!text || !this.rawPersona) return text;
    const identity = this.rawPersona.identity || {};
    const first = safeGet(identity.first_name, "").trim();
    const last = safeGet(identity.last_name, "").trim();
    const fullName = `${first} ${last}`.trim();
    if (!fullName) return text;

    // Case-insensitive regex to clean up doctor name references matching patient full name
    const drRegex = new RegExp(`dr\\.?\\s*${fullName}`, 'gi');
    let sanitized = text.replace(drRegex, 'Dr. Samarth Gupta');

    const docRegex = new RegExp(`doctor\\s*${fullName}`, 'gi');
    sanitized = sanitized.replace(docRegex, 'Dr. Samarth Gupta');

    return sanitized;
  }

  /**
   * LEVEL 1 - Always loaded baseline summaries
   */
  public getShortSummary(): string {
    const summary = this.rawPersona?.narrative_summary?.short_summary;
    return this.sanitizeSelfAssignment(safeGet(summary, "No baseline summary available."));
  }

  public getDetailedSummary(): string {
    const summary = this.rawPersona?.narrative_summary?.detailed_summary;
    return this.sanitizeSelfAssignment(safeGet(summary, "No detailed summary available."));
  }

  public getExecutiveSummary(): string {
    const summary = this.rawPersona?.ai_copilot_context?.executive_summary_for_llm;
    return this.sanitizeSelfAssignment(safeGet(summary, "No medical copilot summary available."));
  }

  /**
   * LEVEL 2 & 3 - On-Demand Lazy Loaded Parsers
   */
  public getSection(sectionName: PersonaSectionName): ParsedSection {
    // If already cached, return immediately to prevent re-parsing
    if (this.cachedSections[sectionName]) {
      return this.cachedSections[sectionName]!;
    }

    if (!this.rawPersona) {
      return {
        summary: `${sectionName} is not available (No loaded profile data).`,
        risks: [],
        recommendations: []
      };
    }

    let parsed: ParsedSection;

    switch (sectionName) {
      case 'identity':
        parsed = parseIdentity(this.rawPersona);
        break;
      case 'clinical_context':
        parsed = parseClinical(this.rawPersona);
        break;
      case 'lab_results_profile':
        parsed = parseLabs(this.rawPersona);
        break;
      case 'medications_profile':
        parsed = parseMedication(this.rawPersona);
        break;
      case 'cgm_profile':
        parsed = parseCGM(this.rawPersona);
        break;
      case 'glucometer_profile':
        parsed = parseGlucometer(this.rawPersona);
        break;
      case 'nutrition_profile':
        parsed = parseNutrition(this.rawPersona);
        break;
      case 'symptoms_profile':
        parsed = parseSymptoms(this.rawPersona);
        break;
      case 'face_scan_profile':
        parsed = parseFaceScan(this.rawPersona);
        break;
      case 'activity_profile':
        parsed = parseActivity(this.rawPersona);
        break;
      case 'blood_pressure_profile':
        parsed = parseBloodPressure(this.rawPersona);
        break;
      case 'weight_and_composition_profile':
        parsed = parseWeight(this.rawPersona);
        break;
      case 'care_team':
        parsed = parseCareTeam(this.rawPersona);
        break;
      default:
        parsed = {
          summary: `Section ${sectionName} is not supported.`,
          risks: [],
          recommendations: []
        };
    }

    // Cache the parsed result
    this.cachedSections[sectionName] = parsed;
    return parsed;
  }
}

export const activePersonaManager = new PersonaManager();
