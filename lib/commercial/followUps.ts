export type CommercialFollowUpDraft = {
  service_type: string;
  appointment_date: string;
  appointment_time: string;
  specialist_user_id: string;
  notes: string;
};

type AppointmentLike = {
  service_type?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  specialist_user_id?: string | null;
  notes?: string | null;
  instructions_text?: string | null;
};

const CASE_TAG_PREFIX = "[commercial_case_id:";

export function createEmptyCommercialFollowUp(
  defaultDate: string,
  defaultTime: string
): CommercialFollowUpDraft {
  return {
    service_type: "",
    appointment_date: defaultDate,
    appointment_time: defaultTime,
    specialist_user_id: "",
    notes: "",
  };
}

export function stripCommercialFollowUpMetadata(text: string | null | undefined) {
  return String(text || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith(CASE_TAG_PREFIX))
    .join("\n")
    .trim();
}

export function buildCommercialFollowUpMetadata(caseId: string, index: number) {
  const metaLine = `${CASE_TAG_PREFIX}${caseId}]`;
  const orderLine = `[commercial_follow_up:${index + 1}]`;
  return [metaLine, orderLine].join("\n").trim();
}

export function hasCommercialFollowUpCase(
  metadata: string | null | undefined,
  caseId: string
) {
  return String(metadata || "").includes(`${CASE_TAG_PREFIX}${caseId}]`);
}

export function parseCommercialFollowUpFromAppointment(
  row: AppointmentLike
): CommercialFollowUpDraft | null {
  if (!row.service_type || !row.appointment_date || !row.appointment_time) {
    return null;
  }

  return {
    service_type: row.service_type,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time.slice(0, 5),
    specialist_user_id: row.specialist_user_id || "",
    notes: row.notes || "",
  };
}
