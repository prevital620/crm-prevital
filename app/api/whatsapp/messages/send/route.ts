import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/sendMessage";

export const dynamic = "force-dynamic";

function normalizePhone(value: unknown) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

function normalizeMessage(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
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

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Debes indicar telefono y mensaje para responder por WhatsApp." },
        { status: 400 }
      );
    }

    const sendResult = await sendWhatsAppTextMessage(phone, message);

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            sendResult.error ||
            "No se pudo enviar el mensaje por WhatsApp. Revisa la ventana de 24 horas o las credenciales.",
        },
        { status: sendResult.status || 400 }
      );
    }

    const outboundPayload = {
      provider: "meta_whatsapp_cloud_api",
      manual: true,
      sent_by_user_id: authCheck.user.id,
      meta_message_id: sendResult.messageId || null,
      response: sendResult.raw || null,
    };

    const { error: insertError } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        phone,
        direction: "outbound",
        message_id: sendResult.messageId || null,
        body: message,
        payload: outboundPayload,
      });

    if (insertError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "El mensaje fue enviado, pero no se pudo guardar en el historial. Reporta este caso a sistemas.",
        },
        { status: 500 }
      );
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
