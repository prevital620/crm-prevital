import { NextResponse } from "next/server";

import { canAccessEncounter, canReadClinicalContent, getClinicalSessionContext, hasFullClinicalAccess } from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
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
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

async function loadEncounterBundle(encounterId: string) {
  const clinical = supabaseAdmin.schema("clinical");

  const { data: encounter, error: encounterError } = await clinical
    .from("encounters")
    .select("*")
    .eq("id", encounterId)
    .maybeSingle();

  if (encounterError) {
    throw encounterError;
  }

  if (!encounter) {
    return null;
  }

  const [{ data: patient }, { data: history }, { data: background }, { data: evolutions }, { data: consents }, { data: attachments }] =
    await Promise.all([
      clinical.from("patients").select("*").eq("id", encounter.patient_id).maybeSingle(),
      clinical.from("histories").select("*").eq("encounter_id", encounterId).maybeSingle(),
      clinical.from("backgrounds").select("*").eq("encounter_id", encounterId).maybeSingle(),
      clinical
        .from("evolutions")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("evolution_date", { ascending: false }),
      clinical
        .from("consents")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false }),
      clinical
        .from("attachments")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false }),
    ]);

  return {
    encounter: encounter as ClinicalEncounter,
    patient: (patient || null) as ClinicalPatient | null,
    history: (history || null) as ClinicalHistory | null,
    background: (background || null) as ClinicalBackground | null,
    evolutions: (evolutions || []) as ClinicalEvolution[],
    consents: (consents || []) as ClinicalConsent[],
    attachments: (attachments || []) as ClinicalAttachment[],
  } as ClinicalEncounterBundle;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar el encuentro clínico." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const bundle = await loadEncounterBundle(id);

    if (!bundle) {
      return NextResponse.json(
        { error: "No se encontró el encuentro clínico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, bundle.encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para consultar este encuentro clínico." },
        { status: 403 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "encounter_viewed",
      encounterId: bundle.encounter.id,
      metadata: {
        specialty: bundle.encounter.specialty,
        status: bundle.encounter.status,
      },
      patientId: bundle.patient?.id || bundle.encounter.patient_id,
      targetId: bundle.encounter.id,
      targetTable: "clinical.encounters",
    });

    return NextResponse.json({ item: bundle });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible cargar el encuentro clínico.") },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getClinicalSessionContext(supabase);

  if (!canReadClinicalContent(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para actualizar el encuentro clínico." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const bundle = await loadEncounterBundle(id);

    if (!bundle) {
      return NextResponse.json(
        { error: "No se encontró el encuentro clínico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, bundle.encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para actualizar este encuentro clínico." },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof payload?.status === "string" && payload.status.trim()) {
      updatePayload.status = payload.status.trim();
      updatePayload.closed_at =
        payload.status.trim().toLowerCase() === "closed" ? payload.closed_at ?? new Date().toISOString() : null;
    }

    if (
      hasFullClinicalAccess(currentSession) &&
      typeof payload?.specialist_user_id === "string" &&
      payload.specialist_user_id.trim()
    ) {
      updatePayload.specialist_user_id = payload.specialist_user_id.trim();
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ item: bundle.encounter });
    }

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("encounters")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible actualizar el encuentro clínico.") },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "encounter_updated",
      encounterId: id,
      metadata: updatePayload,
      patientId: bundle.patient?.id || bundle.encounter.patient_id,
      targetId: id,
      targetTable: "clinical.encounters",
    });

    return NextResponse.json({ item: data as ClinicalEncounter });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para actualizar el encuentro clínico no es válida.") },
      { status: 400 }
    );
  }
}
