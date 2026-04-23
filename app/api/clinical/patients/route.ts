import { NextResponse } from "next/server";

import { canReadClinicalContent, getClinicalSessionContext, hasFullClinicalAccess } from "@/lib/clinical/access";
import type { ClinicalPatient } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
