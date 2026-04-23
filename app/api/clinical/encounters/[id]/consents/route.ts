import { NextResponse } from "next/server";

import { canAccessEncounter, canReadClinicalContent, getClinicalSessionContext } from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
import type { ClinicalConsent } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeConsentType(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: unknown) {
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
      { error: "No tienes permiso para consultar consentimientos clínicos." },
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
      .from("consents")
      .select("*")
      .eq("encounter_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible consultar los consentimientos clínicos.") },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: (data || []) as ClinicalConsent[] });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar los consentimientos clínicos.") },
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
      { error: "No tienes permiso para actualizar consentimientos clínicos." },
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
    const consentType = normalizeConsentType(payload?.consent_type);

    if (!consentType) {
      return NextResponse.json(
        { error: "El tipo de consentimiento es obligatorio." },
        { status: 400 }
      );
    }

    const accepted = Boolean(payload?.accepted);
    const documentUrl = normalizeOptionalText(payload?.document_url);
    const acceptedAt =
      accepted
        ? normalizeOptionalText(payload?.accepted_at) || new Date().toISOString()
        : null;

    const { data: existing, error: existingError } = await supabaseAdmin
      .schema("clinical")
      .from("consents")
      .select("*")
      .eq("encounter_id", id)
      .eq("consent_type", consentType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: getErrorMessage(existingError, "No fue posible validar el consentimiento clínico.") },
        { status: 500 }
      );
    }

    const commonPayload = {
      encounter_id: id,
      consent_type: consentType,
      accepted,
      accepted_at: acceptedAt,
      accepted_by: accepted ? currentSession.user.id : null,
      document_url: documentUrl,
    };

    const query = existing
      ? supabaseAdmin
          .schema("clinical")
          .from("consents")
          .update(commonPayload)
          .eq("id", existing.id)
      : supabaseAdmin.schema("clinical").from("consents").insert(commonPayload);

    const { data, error } = await query.select("*").single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible guardar el consentimiento clínico.") },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "consent_updated",
      encounterId: id,
      metadata: {
        consent_type: consentType,
        accepted,
      },
      patientId: encounter.patient_id as string,
      targetId: data.id as string,
      targetTable: "clinical.consents",
    });

    return NextResponse.json({ item: data as ClinicalConsent });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para guardar el consentimiento clínico no es válida.") },
      { status: 400 }
    );
  }
}
