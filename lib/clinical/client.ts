"use client";

import type {
  ClinicalAttachment,
  ClinicalBackground,
  ClinicalConsent,
  ClinicalEncounter,
  ClinicalEncounterBundle,
  ClinicalEvolution,
  ClinicalHistory,
  ClinicalPatient,
} from "@/lib/clinical/types";

export type ClinicalPatientInput = {
  source_user_id?: string | null;
  source_lead_id?: string | null;
  full_name: string;
  document_number?: string | null;
  phone?: string | null;
  city?: string | null;
  eps?: string | null;
  occupation?: string | null;
  birth_date?: string | null;
  age?: number | null;
  sex?: string | null;
};

export type ClinicalHistoryInput = {
  chief_complaint?: string | null;
  current_illness?: string | null;
  review_of_systems?: string | null;
  physical_exam?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

export type ClinicalBackgroundInput = {
  pathological?: string | null;
  surgical?: string | null;
  toxic?: string | null;
  allergies?: string | null;
  medications?: string | null;
  family_history?: string | null;
  notes?: string | null;
};

type ClinicalPatientListResponse = {
  items: ClinicalPatient[];
};

type ClinicalPatientResponse = {
  item: ClinicalPatient;
};

type ClinicalEncounterResponse = {
  item: ClinicalEncounter;
};

type ClinicalEncounterListResponse = {
  items: ClinicalEncounter[];
};

type ClinicalEncounterBundleResponse = {
  item: ClinicalEncounterBundle;
};

type ClinicalHistoryResponse = {
  history: ClinicalHistory | null;
  background: ClinicalBackground | null;
};

type ClinicalEvolutionsResponse = {
  items: ClinicalEvolution[];
};

type ClinicalEvolutionResponse = {
  item: ClinicalEvolution;
};

type ClinicalConsentsResponse = {
  items: ClinicalConsent[];
};

type ClinicalConsentResponse = {
  item: ClinicalConsent;
};

type ClinicalAttachmentsResponse = {
  items: ClinicalAttachment[];
};

type ClinicalAttachmentResponse = {
  item: ClinicalAttachment;
};

type RequestOptions = RequestInit & {
  errorMessage: string;
};

async function fetchJson<T>(input: RequestInfo | URL, init: RequestOptions): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || init.errorMessage);
  }

  return payload as T;
}

export async function searchClinicalPatients(query: string): Promise<ClinicalPatient[]> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetchJson<ClinicalPatientListResponse>(
    `/api/clinical/patients?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudieron consultar los pacientes clínicos.",
    }
  );

  return response.items || [];
}

export async function createClinicalPatient(
  input: ClinicalPatientInput
): Promise<ClinicalPatient> {
  const response = await fetchJson<ClinicalPatientResponse>("/api/clinical/patients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    errorMessage: "No se pudo crear el paciente clínico.",
  });

  return response.item;
}

export async function getClinicalEncounters(input: {
  patientId?: string | null;
  specialty?: string | null;
  status?: string | null;
  appointmentId?: string | null;
}): Promise<ClinicalEncounter[]> {
  const params = new URLSearchParams();

  if (input.patientId) params.set("patientId", input.patientId);
  if (input.specialty) params.set("specialty", input.specialty);
  if (input.status) params.set("status", input.status);
  if (input.appointmentId) params.set("appointmentId", input.appointmentId);

  const response = await fetchJson<ClinicalEncounterListResponse>(
    `/api/clinical/encounters?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudieron consultar los encuentros clínicos.",
    }
  );

  return response.items || [];
}

export async function getClinicalEncounterBundleById(
  encounterId: string
): Promise<ClinicalEncounterBundle> {
  const response = await fetchJson<ClinicalEncounterBundleResponse>(
    `/api/clinical/encounters/${encounterId}`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudo cargar el detalle del encuentro clínico.",
    }
  );

  return response.item;
}

export async function getClinicalEncounterByAppointment(
  appointmentId: string,
  specialty: string
): Promise<ClinicalEncounterBundle | null> {
  const encounters = await getClinicalEncounters({
    appointmentId,
    specialty,
  });

  const encounter = encounters[0];
  if (!encounter) return null;

  return getClinicalEncounterBundleById(encounter.id);
}

export async function ensureClinicalEncounter(input: {
  appointmentId: string;
  specialty: string;
  patient: ClinicalPatientInput;
  specialistUserId?: string | null;
}): Promise<ClinicalEncounterBundle> {
  const existing = await getClinicalEncounterByAppointment(input.appointmentId, input.specialty);
  if (existing) return existing;

  const created = await fetchJson<ClinicalEncounterResponse>("/api/clinical/encounters", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appointment_id: input.appointmentId,
      specialty: input.specialty,
      specialist_user_id: input.specialistUserId ?? null,
      patient: input.patient,
    }),
    errorMessage: "No se pudo crear el encuentro clínico.",
  });

  return getClinicalEncounterBundleById(created.item.id);
}

export async function saveClinicalHistory(
  encounterId: string,
  input: {
    history: ClinicalHistoryInput;
    background: ClinicalBackgroundInput;
  }
): Promise<ClinicalHistoryResponse> {
  return fetchJson<ClinicalHistoryResponse>(`/api/clinical/encounters/${encounterId}/history`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    errorMessage: "No se pudo guardar la historia clínica segura.",
  });
}

export async function updateClinicalEncounterStatus(
  encounterId: string,
  status: string
): Promise<ClinicalEncounterResponse> {
  return fetchJson<ClinicalEncounterResponse>(`/api/clinical/encounters/${encounterId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
    errorMessage: "No se pudo actualizar el estado del encuentro clínico.",
  });
}

export async function getClinicalEvolutions(
  encounterId: string
): Promise<ClinicalEvolution[]> {
  const response = await fetchJson<ClinicalEvolutionsResponse>(
    `/api/clinical/encounters/${encounterId}/evolutions`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudieron consultar las evoluciones clínicas.",
    }
  );

  return response.items || [];
}

export async function createClinicalEvolution(
  encounterId: string,
  input: {
    note: string;
    evolutionDate?: string | null;
  }
): Promise<ClinicalEvolution> {
  const response = await fetchJson<ClinicalEvolutionResponse>(
    `/api/clinical/encounters/${encounterId}/evolutions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: input.note,
        evolution_date: input.evolutionDate ?? null,
      }),
      errorMessage: "No se pudo guardar la evolución clínica.",
    }
  );

  return response.item;
}

export async function getClinicalConsents(
  encounterId: string
): Promise<ClinicalConsent[]> {
  const response = await fetchJson<ClinicalConsentsResponse>(
    `/api/clinical/encounters/${encounterId}/consents`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudieron consultar los consentimientos clínicos.",
    }
  );

  return response.items || [];
}

export async function saveClinicalConsent(
  encounterId: string,
  input: {
    consentType: string;
    accepted: boolean;
    acceptedAt?: string | null;
    documentUrl?: string | null;
  }
): Promise<ClinicalConsent> {
  const response = await fetchJson<ClinicalConsentResponse>(
    `/api/clinical/encounters/${encounterId}/consents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        consent_type: input.consentType,
        accepted: input.accepted,
        accepted_at: input.acceptedAt ?? null,
        document_url: input.documentUrl ?? null,
      }),
      errorMessage: "No se pudo guardar el consentimiento clínico.",
    }
  );

  return response.item;
}

export async function getClinicalAttachments(
  encounterId: string
): Promise<ClinicalAttachment[]> {
  const response = await fetchJson<ClinicalAttachmentsResponse>(
    `/api/clinical/encounters/${encounterId}/attachments`,
    {
      method: "GET",
      cache: "no-store",
      errorMessage: "No se pudieron consultar los anexos clínicos.",
    }
  );

  return response.items || [];
}

export async function createClinicalAttachment(
  encounterId: string,
  input: {
    fileName: string;
    fileUrl: string;
    mimeType?: string | null;
  }
): Promise<ClinicalAttachment> {
  const response = await fetchJson<ClinicalAttachmentResponse>(
    `/api/clinical/encounters/${encounterId}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_name: input.fileName,
        file_url: input.fileUrl,
        mime_type: input.mimeType ?? null,
      }),
      errorMessage: "No se pudo guardar el anexo clínico.",
    }
  );

  return response.item;
}

export function buildClinicalPatientFallbacks(
  patient: ClinicalPatient | null | undefined,
  fallback: Partial<ClinicalPatientInput>
): ClinicalPatientInput {
  return {
    source_user_id: fallback.source_user_id ?? patient?.source_user_id ?? null,
    source_lead_id: fallback.source_lead_id ?? patient?.source_lead_id ?? null,
    full_name: fallback.full_name || patient?.full_name || "Paciente clinico",
    document_number: fallback.document_number ?? patient?.document_number ?? null,
    phone: fallback.phone ?? patient?.phone ?? null,
    city: fallback.city ?? patient?.city ?? null,
    eps: fallback.eps ?? patient?.eps ?? null,
    occupation: fallback.occupation ?? patient?.occupation ?? null,
    birth_date: fallback.birth_date ?? patient?.birth_date ?? null,
    age: fallback.age ?? patient?.age ?? null,
    sex: fallback.sex ?? patient?.sex ?? null,
  };
}
