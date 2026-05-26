import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  sendWhatsAppImageMessage,
  sendWhatsAppTextMessage,
} from "@/lib/whatsapp/sendMessage";

type OutboundType = "text" | "image";

type SaveOutboundInput = {
  phone: string;
  body?: string | null;
  messageType?: OutboundType;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  status?: "sent" | "failed" | "warning";
  error?: string | null;
  payload?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function metaMessageIdFromResult(value: unknown) {
  const result = asRecord(value);
  return asString(result?.messageId) || null;
}

export async function saveWhatsappOutboundMessage(input: SaveOutboundInput) {
  const metaMessageId = metaMessageIdFromResult(input.payload);

  const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
    phone: input.phone,
    direction: "outbound",
    message_id: metaMessageId,
    meta_message_id: metaMessageId,
    body: input.body || input.mediaCaption || null,
    message_type: input.messageType || "text",
    media_url: input.mediaUrl || null,
    media_caption: input.mediaCaption || null,
    status: input.status || "sent",
    error: input.error || null,
    payload: input.payload ?? null,
  });

  if (error && error.code !== "23505") {
    console.error("[whatsapp] Could not store outbound message.", {
      phone: input.phone,
      messageType: input.messageType || "text",
      error: error.message,
    });
  }

  await supabaseAdmin
    .from("whatsapp_leads")
    .update({ last_outbound_at: new Date().toISOString() })
    .eq("phone", input.phone);
}

export async function sendAndStoreTextMessage(phone: string, body: string) {
  const result = await sendWhatsAppTextMessage(phone, body);
  await saveWhatsappOutboundMessage({
    phone,
    body,
    messageType: "text",
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error || "No se pudo enviar texto por WhatsApp.",
    payload: result,
  });

  return result;
}

async function isPublicImageUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    const contentType = response.headers.get("content-type") || "";
    return response.ok && contentType.toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

export async function sendAndStoreImageMessage(
  phone: string,
  imageUrl: string | undefined,
  caption: string
) {
  if (!imageUrl) {
    const error = "No hay URL de imagen configurada para WhatsApp.";
    await saveWhatsappOutboundMessage({
      phone,
      body: caption,
      messageType: "image",
      mediaCaption: caption,
      status: "warning",
      error,
      payload: { warning: error },
    });
    return { ok: false, error };
  }

  const publicImage = await isPublicImageUrl(imageUrl);
  if (!publicImage) {
    const error = "La URL de imagen no es publica o no responde como imagen.";
    await saveWhatsappOutboundMessage({
      phone,
      body: caption,
      messageType: "image",
      mediaUrl: imageUrl,
      mediaCaption: caption,
      status: "warning",
      error,
      payload: { warning: error },
    });
    return { ok: false, error };
  }

  const result = await sendWhatsAppImageMessage(phone, imageUrl, caption);
  await saveWhatsappOutboundMessage({
    phone,
    body: caption,
    messageType: "image",
    mediaUrl: imageUrl,
    mediaCaption: caption,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error || "No se pudo enviar imagen por WhatsApp.",
    payload: result,
  });

  return result;
}
