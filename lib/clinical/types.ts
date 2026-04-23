export type ClinicalRoleCode =
  | "nutricionista"
  | "fisioterapeuta"
  | "medico_general"
  | "coordinador_clinico"
  | "auditor_clinico";

export type ClinicalPatient = {
  id: string;
  source_user_id: string | null;
  source_lead_id: string | null;
  full_name: string;
  document_number: string | null;
  phone: string | null;
  city: string | null;
  eps: string | null;
  occupation: string | null;
  birth_date: string | null;
  age: number | null;
  sex: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalEncounter = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  specialist_user_id: string;
  specialty: string;
  status: string;
  started_at: string;
  closed_at: string | null;
  created_at: string;
};

export type ClinicalHistory = {
  id: string;
  encounter_id: string;
  chief_complaint: string | null;
  current_illness: string | null;
  review_of_systems: string | null;
  physical_exam: string | null;
  assessment: string | null;
  plan: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export type ClinicalBackground = {
  id: string;
  encounter_id: string;
  pathological: string | null;
  surgical: string | null;
  toxic: string | null;
  allergies: string | null;
  medications: string | null;
  family_history: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicalEvolution = {
  id: string;
  encounter_id: string;
  evolution_date: string;
  note: string;
  created_by: string;
  created_at: string;
};

export type ClinicalConsent = {
  id: string;
  encounter_id: string;
  consent_type: string;
  accepted: boolean;
  accepted_at: string | null;
  accepted_by: string | null;
  document_url: string | null;
  created_at: string;
};

export type ClinicalAttachment = {
  id: string;
  encounter_id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
};

export type ClinicalEncounterBundle = {
  encounter: ClinicalEncounter;
  patient: ClinicalPatient;
  history: ClinicalHistory | null;
  background: ClinicalBackground | null;
  evolutions: ClinicalEvolution[];
  consents: ClinicalConsent[];
  attachments: ClinicalAttachment[];
};
