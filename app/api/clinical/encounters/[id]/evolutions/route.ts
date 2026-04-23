import { NextResponse } from "next/server";

import { canAccessEncounter, canReadClinicalContent, getClinicalSessionContext } from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
import type { ClinicalEvolution } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeRequiredText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getEncounter(encounterId: string) {
  const { data, error } = await supabaseAdmin
    .schema("clinical")
    .from("encounters")
    .select("*")
    .eq("id", encounterId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar evoluciones clínicas." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const encounter = await getEncounter(id);

    if (!encounter) {
      return NextResponse.json(
        { error: "No se encontró el encuentro clínico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para consultar este encuentro clínico." },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("evolutions")
      .select("*")
      .eq("encounter_id", id)
      .order("evolution_date", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible consultar las evoluciones clínicas.") },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: (data || []) as ClinicalEvolution[] });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar las evoluciones clínicas.") },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para registrar evoluciones clínicas." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const encounter = await getEncounter(id);

    if (!encounter) {
      return NextResponse.json(
        { error: "No se encontró el encuentro clínico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para actualizar este encuentro clínico." },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const note = normalizeRequiredText(payload?.note);

    if (!note) {
      return NextResponse.json(
        { error: "La nota de evolución es obligatoria." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("evolutions")
      .insert({
        encounter_id: id,
        evolution_date: payload?.evolution_date ?? new Date().toISOString(),
        note,
        created_by: currentSession.user.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible guardar la evolución clínica.") },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "evolution_created",
      encounterId: id,
      metadata: {
        evolution_date: data.evolution_date,
      },
      patientId: encounter.patient_id as string,
      targetId: data.id as string,
      targetTable: "clinical.evolutions",
    });

    return NextResponse.json({ item: data as ClinicalEvolution }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para guardar la evolución clínica no es válida.") },
      { status: 400 }
    );
  }
}
