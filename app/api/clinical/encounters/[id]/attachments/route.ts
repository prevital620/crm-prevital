import { NextResponse } from "next/server";

import { canAccessEncounter, canReadClinicalContent, getClinicalSessionContext } from "@/lib/clinical/access";
import { recordClinicalAuditEvent } from "@/lib/clinical/audit";
import type { ClinicalAttachment } from "@/lib/clinical/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

function normalizeRequiredText(value: unknown) {
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
      { error: "No tienes permiso para consultar anexos clÃ­nicos." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const encounter = await getEncounter(id);

    if (!encounter) {
      return NextResponse.json(
        { error: "No se encontrÃ³ el encuentro clÃ­nico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para consultar este encuentro clÃ­nico." },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("attachments")
      .select("*")
      .eq("encounter_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible consultar los anexos clÃ­nicos.") },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: (data || []) as ClinicalAttachment[] });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar los anexos clÃ­nicos.") },
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
      { error: "No tienes permiso para registrar anexos clÃ­nicos." },
      { status: 403 }
    );
  }

  const currentSession = session!;

  try {
    const { id } = await context.params;
    const encounter = await getEncounter(id);

    if (!encounter) {
      return NextResponse.json(
        { error: "No se encontrÃ³ el encuentro clÃ­nico solicitado." },
        { status: 404 }
      );
    }

    if (!canAccessEncounter(currentSession, encounter)) {
      return NextResponse.json(
        { error: "No tienes permiso para actualizar este encuentro clÃ­nico." },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const fileName = normalizeRequiredText(payload?.file_name);
    const fileUrl = normalizeRequiredText(payload?.file_url);
    const mimeType = normalizeOptionalText(payload?.mime_type);

    if (!fileName) {
      return NextResponse.json(
        { error: "El nombre del anexo es obligatorio." },
        { status: 400 }
      );
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: "La URL o ruta del anexo es obligatoria." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("clinical")
      .from("attachments")
      .insert({
        encounter_id: id,
        file_name: fileName,
        file_url: fileUrl,
        mime_type: mimeType,
        uploaded_by: currentSession.user.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, "No fue posible guardar el anexo clÃ­nico.") },
        { status: 500 }
      );
    }

    await recordClinicalAuditEvent({
      actorRole: currentSession.contentRoles[0] || "clinical_user",
      actorUserId: currentSession.user.id,
      action: "attachment_created",
      encounterId: id,
      metadata: {
        file_name: fileName,
        mime_type: mimeType,
      },
      patientId: encounter.patient_id as string,
      targetId: data.id as string,
      targetTable: "clinical.attachments",
    });

    return NextResponse.json({ item: data as ClinicalAttachment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "La solicitud para guardar el anexo clÃ­nico no es vÃ¡lida.") },
      { status: 400 }
    );
  }
}
