import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function parseCareTeam(data: any): ParsedSection {
  const team = safeGet(data?.care_team, {});
  const doctor = safeGet(team?.assigned_doctor, {});
  const program = safeGet(team?.current_program, {});
  const notes = safeGet(team?.doctor_notes_latest, {});
  const prescription = safeGet(team?.prescription_on_file, {});
  const history = safeGet(team?.consultation_history, {});

  let docName = safeGet(doctor?.name, "None Assigned");
  let docSpec = safeGet(doctor?.specialization, "General Physician");
  const programName = safeGet(program?.program_name, "None active");


  const latestNote = safeGet(notes?.note, "No clinical note uploaded");
  const rxName = safeGet(prescription?.file_name, "No prescription uploaded");

  const totalConsultations = safeGet(history?.total_count, 0);
  const pendingCount = safeGet(history?.pending_count, 0);

  const summary = `Care Team & Health Program Profile:
- **Assigned Clinical Lead:** Dr. ${docName} (${docSpec})
- **Active Program Tier:** ${programName}
- **Latest Doctor Note:** "${latestNote}"
- **Prescription Upload:** Rx File: "${rxName}"
- **Consultation Sessions:** Total: ${totalConsultations}, Pending Consultations: ${pendingCount}`;

  const risks: string[] = [];
  const recommendations: string[] = [];

  if (pendingCount > 0) {
    recommendations.push(`Reach out to Dr. ${docName}'s office to schedule your pending consultation.`);
  }

  return {
    summary,
    risks,
    recommendations
  };
}
