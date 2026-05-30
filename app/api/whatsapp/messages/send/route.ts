import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import {
  sendAndStoreImageMessage,
  sendAndStoreTextMessage,
} from "@/lib/whatsapp/outbound";

export const dynamic = "force-dynamic";

function normalizePhone(value: unknown) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

function normalizeMessage(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeImageUrl(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    const message = normalizeMessage(body?.message);
    const imageUrl = normalizeImageUrl(body?.image_url);
    const caption = normalizeMessage(body?.caption) || "";

    if (!phone || (!message && !imageUrl)) {
      return NextResponse.json(
        { error: "Debes indicar telefono y mensaje o imagen para responder por WhatsApp." },
        { status: 400 }
      );
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("whatsapp_leads")
      .select("id, status, reply_window_expires_at")
      .eq("phone", phone)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json(
        { success: false, error: leadError.message || "No se pudo validar el lead." },
        { status: 400 }
      );
    }

    const replyWindowExpiresAt = lead?.reply_window_expires_at
      ? new Date(lead.reply_window_expires_at)
      : null;

    if (!replyWindowExpiresAt || new Date() >= replyWindowExpiresAt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "La ventana de 24 horas para mensajes libres esta vencida. Este caso requiere plantilla aprobada.",
        },
        { status: 400 }
      );
    }

    const sendResult = imageUrl
      ? await sendAndStoreImageMessage(phone, imageUrl, caption)
      : await sendAndStoreTextMessage(phone, message || "");

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            sendResult.error ||
            "No se pudo enviar el mensaje por WhatsApp. Revisa la ventana de 24 horas, la imagen o las credenciales.",
        },
        { status: sendResult.status || 400 }
      );
    }

    if (lead?.id) {
      const nextStatus =
        lead.status === "cerrado" ? "cerrado" : "en_gestion_callcenter";

      await supabaseAdmin
        .from("whatsapp_leads")
        .update({
          status: nextStatus,
          last_outbound_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
