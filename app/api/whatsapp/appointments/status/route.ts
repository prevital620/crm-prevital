import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import { getErrorMessage } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["asistio", "no_asistio"]);

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
    const appointmentId = normalizeText(body?.appointment_id);
    const status = normalizeText(body?.status);

    if (!appointmentId || !status) {
      return NextResponse.json(
        { error: "Debes indicar appointment_id y status." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json(
        { error: "Estado de cita no permitido para esta accion." },
        { status: 400 }
      );
    }

    const payload: Record<string, string | null> = {
      status,
      updated_by_user_id: authCheck.user.id,
    };

    if (status === "asistio") {
      payload.attended_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(payload)
      .eq("id", appointmentId)
      .select("id, status, appointment_date, appointment_time")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo actualizar la cita." },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "No se encontro la cita." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, appointment: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
