import { safeGet } from '../safeGet';
import { ParsedSection } from '../PersonaManager';

export function formatEpochToDateString(epoch: any): string {
  if (!epoch) return "N/A";
  const numEpoch = Number(epoch);
  if (isNaN(numEpoch)) return "N/A";
  try {
    const d = new Date(numEpoch * 1000);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch (e) {
    return "N/A";
  }
}

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
  const enrollmentDate = formatEpochToDateString(program?.enrollment_date);
  const expiryDate = formatEpochToDateString(program?.expiry_date);

  const latestNote = safeGet(notes?.note, "No clinical note uploaded");
  const lastCompleted = safeGet(history?.last_completed_consultation, {});
  const lastConsultationNote = safeGet(lastCompleted?.text_note, "No note from last completed consultation");
  const rxName = safeGet(prescription?.file_name, "No prescription uploaded");

  const totalConsultations = safeGet(history?.total_count, 0);
  const pendingCount = safeGet(history?.pending_count, 0);
  const completedCount = safeGet(history?.completed_count, 0);

  const summary = `Care Team & Health Program Profile:
- **Assigned Clinical Lead:** Dr. ${docName} (${docSpec})
- **Active Program Tier:** ${programName}
- **Program Enrollment Date:** ${enrollmentDate}
- **Program Expiry Date:** ${expiryDate}
- **Latest Doctor Note (General):** "${latestNote}"
- **Last Completed Consultation Note:** "${lastConsultationNote}"
- **Prescription Upload:** Rx File: "${rxName}"
- **Consultation Sessions:** Total: ${totalConsultations}, Completed: ${completedCount}, Pending: ${pendingCount}`;

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
