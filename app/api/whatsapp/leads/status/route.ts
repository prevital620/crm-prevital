import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import { getErrorMessage } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["cerrado", "sin_respuesta"]);

function normalizeText(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export async function PATCH(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await request.json().catch(() => null);
    const leadId = normalizeText(body?.lead_id);
    const status = normalizeText(body?.status);

    if (!leadId || !status) {
      return NextResponse.json(
        { error: "Debes indicar lead_id y status." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Estado no permitido para esta accion." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId)
      .select("id, status, updated_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo actualizar el lead." },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No se encontro el lead." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, lead: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
