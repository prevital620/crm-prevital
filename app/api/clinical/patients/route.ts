import { NextResponse } from "next/server";

import { canReadClinicalContent, getClinicalSessionContext, hasFullClinicalAccess } from "@/lib/clinical/access";
import type { ClinicalPatient } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

type LegacyUserRow = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad: string | null;
  ocupacion: string | null;
};

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeClinicalSpecialty(value: string | null | undefined) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (!normalized) return null;
  if (normalized === "nutricion") return "nutricion";
  if (normalized === "fisioterapia") return "fisioterapia";
  if (normalized === "medicina_general") return "medicina_general";
  return null;
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
    const { data } = await clinical
      .from("patients")
      .select("*")
      .eq("source_lead_id", sourceLeadId)
      .maybeSingle();
    if (data) return (await syncExistingClinicalPatient(data.id as string, normalizedPayload)) || data;
  }

  if (sourceUserId) {
    const { data } = await clinical
      .from("patients")
      .select("*")
      .eq("source_user_id", sourceUserId)
      .maybeSingle();
    if (data) return (await syncExistingClinicalPatient(data.id as string, normalizedPayload)) || data;
  }

  if (documentNumber) {
    const { data } = await clinical
      .from("patients")
      .select("*")
      .eq("document_number", documentNumber)
      .maybeSingle();
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

async function bootstrapMissingEncountersForSpecialist(
  currentUserId: string,
  searchTerm: string
) {
  let appointmentsQuery = supabaseAdmin
    .from("appointments")
    .select(
      `
      id,
      lead_id,
      patient_name,
      phone,
      city,
      appointment_date,
      appointment_time,
      status,
      service_type
    `
    )
    .eq("specialist_user_id", currentUserId)
    .order("appointment_date", { ascending: false })
    .limit(searchTerm ? 120 : 80);

  if (searchTerm) {
    const normalizedDigits = normalizeDigits(searchTerm);
    const terms = [
      `patient_name.ilike.%${searchTerm}%`,
      `city.ilike.%${searchTerm}%`,
    ];

    if (normalizedDigits) {
      terms.push(`phone.ilike.%${normalizedDigits}%`);
    }

    appointmentsQuery = appointmentsQuery.or(terms.join(","));
  }

  const { data: appointments, error: appointmentsError } = await appointmentsQuery;
  if (appointmentsError) throw appointmentsError;

  const relevantAppointments = (appointments || []).filter((item) =>
    normalizeClinicalSpecialty(item.service_type)
  );

  if (relevantAppointments.length === 0) return;

  const appointmentIds = relevantAppointments.map((item) => item.id);
  const { data: existingEncounters, error: existingEncountersError } = await supabaseAdmin
    .schema("clinical")
    .from("encounters")
    .select("appointment_id, specialty")
    .in("appointment_id", appointmentIds)
    .eq("specialist_user_id", currentUserId);

  if (existingEncountersError) throw existingEncountersError;

  const encounterKeySet = new Set(
    (existingEncounters || []).map(
      (item) => `${String(item.appointment_id || "")}::${String(item.specialty || "")}`
    )
  );

  for (const appointment of relevantAppointments) {
    const specialty = normalizeClinicalSpecialty(appointment.service_type);
    if (!specialty) continue;

    const encounterKey = `${appointment.id}::${specialty}`;
    if (encounterKeySet.has(encounterKey)) continue;

    let linkedUser: LegacyUserRow | null = null;

    if (appointment.phone) {
      const { data: usersByPhone } = await supabaseAdmin
        .from("users")
        .select("id, nombre, documento, telefono, ciudad, ocupacion")
        .eq("telefono", appointment.phone)
        .limit(1);

      if (usersByPhone && usersByPhone.length > 0) {
        linkedUser = usersByPhone[0] as LegacyUserRow;
      }
    }

    if (!linkedUser && appointment.patient_name) {
      const { data: usersByName } = await supabaseAdmin
        .from("users")
        .select("id, nombre, documento, telefono, ciudad, ocupacion")
        .eq("nombre", appointment.patient_name)
        .limit(1);

      if (usersByName && usersByName.length > 0) {
        linkedUser = usersByName[0] as LegacyUserRow;
      }
    }

    const patient = await findOrCreateClinicalPatient({
      source_user_id: linkedUser?.id || null,
      source_lead_id: appointment.lead_id || null,
      full_name: appointment.patient_name || "Paciente clinico",
      document_number: linkedUser?.documento || null,
      phone: appointment.phone || linkedUser?.telefono || null,
      city: appointment.city || linkedUser?.ciudad || null,
      occupation: linkedUser?.ocupacion || specialty,
    });

    const startedAt =
      appointment.appointment_date && appointment.appointment_time
        ? `${appointment.appointment_date}T${appointment.appointment_time}:00`
        : new Date().toISOString();
    const isClosed = ["finalizada", "asistio"].includes(
      String(appointment.status || "").trim().toLowerCase()
    );

    const { error: insertEncounterError } = await supabaseAdmin
      .schema("clinical")
      .from("encounters")
      .insert({
        patient_id: patient.id,
        appointment_id: appointment.id,
        specialist_user_id: currentUserId,
        specialty,
        status: isClosed ? "closed" : "open",
        started_at: startedAt,
        closed_at: isClosed ? startedAt : null,
      });

    if (!insertEncounterError) {
      encounterKeySet.add(encounterKey);
    }
  }
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar pacientes clínicos." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  const searchTerm = new URL(request.url).searchParams.get("q")?.trim() || "";
  const patientIds = new Set<string>();

  if (!hasFullClinicalAccess(currentSession)) {
    await bootstrapMissingEncountersForSpecialist(currentSession.user.id, searchTerm);

    const { data: encounterRows, error: encounterError } = await supabaseAdmin
      .schema("clinical")
      .from("encounters")
      .select("patient_id")
      .eq("specialist_user_id", currentSession.user.id);

    if (encounterError) {
      return NextResponse.json(
        { error: getErrorMessage(encounterError, "No fue posible cargar los encuentros clínicos.") },
        { status: 500 }
      );
    }

    (encounterRows || []).forEach((row) => {
      if (row.patient_id) patientIds.add(row.patient_id as string);
    });

    if (patientIds.size === 0) {
      return NextResponse.json({ items: [] satisfies ClinicalPatient[] });
    }
  }

  let query = supabaseAdmin
    .schema("clinical")
    .from("patients")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!hasFullClinicalAccess(currentSession)) {
    query = query.in("id", Array.from(patientIds));
  }

  if (searchTerm) {
    const normalizedDigits = searchTerm.replace(/\D/g, "");
    const terms = [
      `full_name.ilike.%${searchTerm}%`,
      `document_number.ilike.%${searchTerm}%`,
      `city.ilike.%${searchTerm}%`,
    ];

    if (normalizedDigits) {
      terms.push(`phone.ilike.%${normalizedDigits}%`);
    }

    query = query.or(terms.join(","));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar los pacientes clínicos.") },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: (data || []) as ClinicalPatient[] });
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para crear pacientes clínicos." },
      { status: 403 }
    );
  }

  try {
    const payload = await request.json();
    const fullName = normalizeNullableText(payload?.full_name);

    if (!fullName) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio para crear el paciente clínico." },
        { status: 400 }
      );
    }

    const insertPayload = {
      source_user_id: payload?.source_user_id ?? null,
      source_lead_id: payload?.source_lead_id ?? null,
      full_name: fullName,
      document_number: normalizeNullableText(payload?.document_number),
      phone: normalizeNullableText(payload?.phone),
      city: normalizeNullableText(payload?.city),
      eps: normalizeNullableText(payload?.eps),
      occupation: normalizeNullableText(payload?.occupation),
      birth_date: payload?.birth_date ?? null,
      age: typeof payload?.age === "number" ? payload.age : null,
      sex: normalizeNullableText(payload?.sex),
    };

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("patients")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible crear el paciente clínico.") },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data as ClinicalPatient }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para crear el paciente clínico no es válida.") },
      { status: 400 }
    );
  }
}
