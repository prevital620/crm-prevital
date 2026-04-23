import { NextResponse } from "next/server";

import {
  canReadClinicalContent,
  getClinicalSessionContext,
  hasFullClinicalAccess,
} from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
import type { ClinicalEncounter } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function buildClinicalPatientPayload(payload: Record<string, unknown>) {
  const ageValue =
    typeof payload?.age === "number"
      ? payload.age
      : typeof payload?.age === "string" && payload.age.trim()
        ? Number(payload.age)
        : null;

  return {
    source_user_id: normalizeNullableText(payload?.source_user_id),
    source_lead_id: normalizeNullableText(payload?.source_lead_id),
    full_name: normalizeNullableText(payload?.full_name) || "Paciente clinico",
    document_number: normalizeNullableText(payload?.document_number),
    phone: normalizeNullableText(payload?.phone),
    city: normalizeNullableText(payload?.city),
    eps: normalizeNullableText(payload?.eps),
    occupation: normalizeNullableText(payload?.occupation),
    birth_date: payload?.birth_date ?? null,
    age: Number.isFinite(ageValue) ? ageValue : null,
    sex: normalizeNullableText(payload?.sex),
    updated_at: new Date().toISOString(),
  };
}

async function syncExistingClinicalPatient(
  patientId: string,
  payload: ReturnType<typeof buildClinicalPatientPayload>
) {
  const clinical = supabaseAdmin.schema("clinical");
  const { updated_at, ...incoming } = payload;

  const { data: existing, error: existingError } = await clinical
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) return null;

  const updates: Record<string, unknown> = {};

  Object.entries(incoming).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    if ((existing as Record<string, unknown>)[key] !== value) {
      updates[key] = value;
    }
  });

  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const { data, error } = await clinical
    .from("patients")
    .update({
      ...updates,
      updated_at,
    })
    .eq("id", patientId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function findOrCreateClinicalPatient(payload: Record<string, unknown>) {
  const clinical = supabaseAdmin.schema("clinical");
  const normalizedPayload = buildClinicalPatientPayload(payload);
  const sourceLeadId = normalizedPayload.source_lead_id;
  const sourceUserId = normalizedPayload.source_user_id;
  const documentNumber = normalizedPayload.document_number;
  const rawPhone = normalizedPayload.phone;
  const normalizedPhone = normalizeDigits(rawPhone);

  if (sourceLeadId) {
    const { data } = await clinical.from("patients").select("*").eq("source_lead_id", sourceLeadId).maybeSingle();
    if (data) return (await syncExistingClinicalPatient(data.id as string, normalizedPayload)) || data;
  }

  if (sourceUserId) {
    const { data } = await clinical.from("patients").select("*").eq("source_user_id", sourceUserId).maybeSingle();
    if (data) return (await syncExistingClinicalPatient(data.id as string, normalizedPayload)) || data;
  }

  if (documentNumber) {
    const { data } = await clinical.from("patients").select("*").eq("document_number", documentNumber).maybeSingle();
    if (data) return (await syncExistingClinicalPatient(data.id as string, normalizedPayload)) || data;
  }

  if (normalizedPhone) {
    const { data: phoneCandidates } = await clinical
      .from("patients")
      .select("*")
      .ilike("phone", `%${normalizedPhone}%`)
      .limit(10);

    const matchedPhone = (phoneCandidates || []).find(
      (patient) => normalizeDigits(String(patient.phone || "")) === normalizedPhone
    );

    if (matchedPhone) {
      return (await syncExistingClinicalPatient(matchedPhone.id as string, normalizedPayload)) || matchedPhone;
    }
  }

  const { data, error } = await clinical
    .from("patients")
    .insert(normalizedPayload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar encuentros clinicos." },
      { status: 403 }
    );
  }

  const currentSession = session!;
  const params = new URL(request.url).searchParams;
  const patientId = params.get("patientId");
  const specialty = params.get("specialty");
  const status = params.get("status");
  const appointmentId = params.get("appointmentId");

  let query = supabaseAdmin
    .schema("clinical")
    .from("encounters")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);

  if (!hasFullClinicalAccess(currentSession)) {
    query = query.eq("specialist_user_id", currentSession.user.id);
  }

  if (patientId) query = query.eq("patient_id", patientId);
  if (specialty) query = query.eq("specialty", specialty);
  if (status) query = query.eq("status", status);
  if (appointmentId) query = query.eq("appointment_id", appointmentId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar los encuentros clinicos.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: (data || []) as ClinicalEncounter[] });
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para crear encuentros clinicos." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const payload = await request.json();
    const specialty = normalizeNullableText(payload?.specialty);
    const status = normalizeNullableText(payload?.status) || "open";
    const requestedSpecialistId =
      normalizeNullableText(payload?.specialist_user_id) || currentSession.user.id;
    const specialistUserId = hasFullClinicalAccess(currentSession)
      ? requestedSpecialistId
      : currentSession.user.id;
    const appointmentId = normalizeNullableText(payload?.appointment_id);
    let patientId = normalizeNullableText(payload?.patient_id);

    if (!specialty) {
      return NextResponse.json(
        { error: "El paciente y la especialidad son obligatorios." },
        { status: 400 }
      );
    }

    if (!patientId && payload?.patient && typeof payload.patient === "object") {
      const patient = await findOrCreateClinicalPatient(payload.patient as Record<string, unknown>);
      patientId = patient.id as string;
    }

    if (!patientId) {
      return NextResponse.json(
        { error: "El paciente y la especialidad son obligatorios." },
        { status: 400 }
      );
    }

    if (appointmentId) {
      let existingQuery = supabaseAdmin
        .schema("clinical")
        .from("encounters")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("specialty", specialty)
        .limit(1);

      if (!hasFullClinicalAccess(currentSession)) {
        existingQuery = existingQuery.eq("specialist_user_id", currentSession.user.id);
      }

      const { data: existingEncounter, error: existingEncounterError } = await existingQuery.maybeSingle();

      if (existingEncounterError) {
        return NextResponse.json(
          {
            error: getErrorMessage(
              existingEncounterError,
              "No fue posible validar el encuentro clinico actual."
            ),
          },
          { status: 500 }
        );
      }

      if (existingEncounter) {
        return NextResponse.json({ item: existingEncounter as ClinicalEncounter });
      }
    }

    const insertPayload = {
      patient_id: patientId,
      appointment_id: appointmentId,
      specialist_user_id: specialistUserId,
      specialty,
      status,
      started_at: payload?.started_at ?? undefined,
      closed_at: payload?.closed_at ?? null,
    };

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("encounters")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible crear el encuentro clinico.") },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "encounter_created",
      encounterId: data.id as string,
      metadata: {
        patient_id: patientId,
        specialty,
        status,
      },
      patientId,
      targetId: data.id as string,
      targetTable: "clinical.encounters",
    });

    return NextResponse.json({ item: data as ClinicalEncounter }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para crear el encuentro clinico no es valida.") },
      { status: 400 }
    );
  }
}
