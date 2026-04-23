import { NextResponse } from "next/server";

import { canAccessEncounter, canReadClinicalContent, getClinicalSessionContext } from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
import type { ClinicalBackground, ClinicalHistory } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeNullableText(value: unknown) {
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
      { error: "No tienes permiso para consultar la historia clínica." },
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

    const [{ data: history }, { data: background }] = await Promise.all([
      supabaseAdmin
        .schema("clinical")
        .from("histories")
        .select("*")
        .eq("encounter_id", id)
        .maybeSingle(),
      supabaseAdmin
        .schema("clinical")
        .from("backgrounds")
        .select("*")
        .eq("encounter_id", id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      history: (history || null) as ClinicalHistory | null,
      background: (background || null) as ClinicalBackground | null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar la historia clínica.") },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para actualizar la historia clínica." },
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
    const now = new Date().toISOString();

    const historyPayload = {
      encounter_id: id,
      chief_complaint: normalizeNullableText(payload?.history?.chief_complaint),
      current_illness: normalizeNullableText(payload?.history?.current_illness),
      review_of_systems: normalizeNullableText(payload?.history?.review_of_systems),
      physical_exam: normalizeNullableText(payload?.history?.physical_exam),
      assessment: normalizeNullableText(payload?.history?.assessment),
      plan: normalizeNullableText(payload?.history?.plan),
      created_by: currentSession.user.id,
      updated_by: currentSession.user.id,
      updated_at: now,
    };

    const backgroundPayload = {
      encounter_id: id,
      pathological: normalizeNullableText(payload?.background?.pathological),
      surgical: normalizeNullableText(payload?.background?.surgical),
      toxic: normalizeNullableText(payload?.background?.toxic),
      allergies: normalizeNullableText(payload?.background?.allergies),
      medications: normalizeNullableText(payload?.background?.medications),
      family_history: normalizeNullableText(payload?.background?.family_history),
      notes: normalizeNullableText(payload?.background?.notes),
      updated_at: now,
    };

    const [{ data: history, error: historyError }, { data: background, error: backgroundError }] =
      await Promise.all([
        supabaseAdmin
          .schema("clinical")
          .from("histories")
          .upsert(historyPayload, { onConflict: "encounter_id" })
          .select("*")
          .single(),
        supabaseAdmin
          .schema("clinical")
          .from("backgrounds")
          .upsert(backgroundPayload, { onConflict: "encounter_id" })
          .select("*")
          .single(),
      ]);

    if (historyError || backgroundError) {
      return NextResponse.json(
        {
          error: getErrorMessage(
            historyError || backgroundError,
            "No fue posible guardar la historia clínica."
          ),
        },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "history_updated",
      encounterId: id,
      metadata: {
        history_fields: Object.keys(payload?.history || {}),
        background_fields: Object.keys(payload?.background || {}),
      },
      patientId: encounter.patient_id as string,
      targetId: id,
      targetTable: "clinical.histories",
    });

    return NextResponse.json({
      history: history as ClinicalHistory,
      background: background as ClinicalBackground,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para guardar la historia clínica no es válida.") },
      { status: 400 }
    );
  }
}
