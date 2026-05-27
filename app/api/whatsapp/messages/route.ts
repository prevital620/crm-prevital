import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";

export const dynamic = "force-dynamic";

function normalizePhoneParam(value: string | null) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

export async function GET(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const phone = normalizePhoneParam(searchParams.get("phone"));

    if (!phone) {
      return NextResponse.json(
        { error: "Debes indicar un telefono para consultar la conversacion." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("whatsapp_messages")
      .select(
        "id, phone, direction, message_id, body, created_at, message_type, media_url, media_caption, meta_message_id, status, status_updated_at, error"
      )
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(300);

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo cargar la conversacion." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      messages: data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
