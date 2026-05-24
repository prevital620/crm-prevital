import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/sendMessage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPRESA = "Prevital";
const CAMPAIGN_CODE = "PV_DETOX";
const SOURCE = "WhatsApp SaleADS";

type WhatsappLeadStatus = "collecting_name" | "collecting_email" | "registered";

type WhatsappLeadRow = {
  id: string;
  phone: string;
  profile_name: string | null;
  full_name: string | null;
  email: string | null;
  status: WhatsappLeadStatus;
};

type InboundTextMessage = {
  phoneNumberId: string | null;
  from: string;
  waId: string;
  messageId: string;
  timestamp: string | null;
  body: string;
  profileName: string | null;
  payload: unknown;
};

const WELCOME_MESSAGE =
  "\u00a1Hola! \ud83d\udc4b Bienvenido/a a Prevital.\n\nGracias por escribirnos. Para completar tu inscripci\u00f3n y participar por una experiencia de Detox I\u00f3nico, por favor d\u00e9janos tu nombre completo.";

const ASK_EMAIL_MESSAGE =
  "Gracias \ud83d\ude0a Ahora d\u00e9janos tu correo electr\u00f3nico para finalizar tu inscripci\u00f3n.";

const INVALID_EMAIL_MESSAGE =
  "Parece que el correo no qued\u00f3 completo. \u00bfNos lo puedes enviar nuevamente, por favor?";

const REGISTERED_MESSAGE =
  "\u00a1Listo! Tu inscripci\u00f3n qued\u00f3 confirmada \ud83d\udc9a\n\nSi sales elegido/a, nuestro equipo de Prevital te contactar\u00e1 para coordinar tu experiencia. Gracias por participar.";

const ALREADY_REGISTERED_MESSAGE =
  "Tu inscripci\u00f3n ya est\u00e1 registrada \ud83d\udc9a Si necesitas actualizar alg\u00fan dato, escr\u00edbenos: actualizar datos.";

const UPDATE_DATA_MESSAGE =
  "Claro \ud83d\ude0a Para actualizar tu inscripci\u00f3n, por favor env\u00edanos nuevamente tu nombre completo.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

function logWebhookDebugSummary(payload: unknown) {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root.entry : [];

  console.info("[whatsapp] webhook POST received", {
    object: asString(root?.object) || null,
    entryCount: entries.length,
  });

  entries.forEach((entry, entryIndex) => {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes) ? entryRecord.changes : [];

    console.info("[whatsapp] webhook entry summary", {
      entryIndex,
      hasChanges: changes.length > 0,
      changeCount: changes.length,
    });

    changes.forEach((change, changeIndex) => {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      const metadata = asRecord(value?.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id) || null;
      const valueMessages = Array.isArray(value?.messages) ? value.messages : [];

      console.info("[whatsapp] webhook change summary", {
        entryIndex,
        changeIndex,
        field: asString(changeRecord?.field) || null,
        hasMessages: valueMessages.length > 0,
        messageCount: valueMessages.length,
        phoneNumberId,
      });

      valueMessages.forEach((item, messageIndex) => {
        const message = asRecord(item);

        console.info("[whatsapp] webhook message summary", {
          entryIndex,
          changeIndex,
          messageIndex,
          messageType: asString(message?.type) || null,
          from: maskPhone(asString(message?.from)),
          messageId: asString(message?.id) || null,
          phoneNumberId,
        });
      });
    });
  });
}

function extractInboundTextMessages(payload: unknown): InboundTextMessage[] {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const messages: InboundTextMessage[] = [];

  entries.forEach((entry) => {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes) ? entryRecord.changes : [];

    changes.forEach((change) => {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      if (!value) return;

      const metadata = asRecord(value.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id) || null;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const contactByWaId = new Map<string, string | null>();

      contacts.forEach((contact) => {
        const contactRecord = asRecord(contact);
        const waId = asString(contactRecord?.wa_id);
        const profile = asRecord(contactRecord?.profile);
        if (waId) {
          contactByWaId.set(waId, asString(profile?.name) || null);
        }
      });

      const valueMessages = Array.isArray(value.messages) ? value.messages : [];

      valueMessages.forEach((item) => {
        const message = asRecord(item);
        if (!message || message.type !== "text") return;

        const text = asRecord(message.text);
        const body = asString(text?.body).trim();
        const from = asString(message.from);
        const messageId = asString(message.id);
        if (!body || !from || !messageId) return;

        messages.push({
          phoneNumberId,
          from,
          waId: from,
          messageId,
          timestamp: asString(message.timestamp) || null,
          body,
          profileName: contactByWaId.get(from) || null,
          payload: item,
        });
      });
    });
  });

  return messages;
}

async function insertInboundMessage(message: InboundTextMessage) {
  const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
    phone: message.from,
    direction: "inbound",
    message_id: message.messageId,
    body: message.body,
    payload: {
      phone_number_id: message.phoneNumberId,
      wa_id: message.waId,
      timestamp: message.timestamp,
      profile_name: message.profileName,
      message: message.payload,
    },
  });

  if (!error) return { duplicate: false };

  if (error.code === "23505") {
    return { duplicate: true };
  }

  throw error;
}

async function saveOutboundMessage(phone: string, body: string, sendResult: unknown) {
  const resultRecord = asRecord(sendResult);
  const messageId = asString(resultRecord?.messageId) || null;

  const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
    phone,
    direction: "outbound",
    message_id: messageId,
    body,
    payload: sendResult ?? null,
  });

  if (error && error.code !== "23505") {
    console.error("[whatsapp] Could not store outbound message.", {
      phone,
      error: error.message,
    });
  }
}

async function replyToLead(phone: string, body: string) {
  const result = await sendWhatsAppTextMessage(phone, body);
  await saveOutboundMessage(phone, body, result);
}

async function createCrmLeadFromWhatsapp(_lead: WhatsappLeadRow) {
  // TODO: Map this lead into public.leads once the final CRM field mapping is confirmed.
  // The current public.leads schema carries operational ownership, source, status,
  // group routing and campaign assumptions. For this MVP we keep WhatsApp leads
  // safely isolated in whatsapp_leads to avoid creating malformed CRM records.
}

async function getLeadByPhone(phone: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_leads")
    .select("id, phone, profile_name, full_name, email, status")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;
  return data as WhatsappLeadRow | null;
}

async function handleInboundTextMessage(message: InboundTextMessage) {
  const storedMessage = await insertInboundMessage(message);
  if (storedMessage.duplicate) {
    console.info("[whatsapp] Duplicate inbound message ignored.", {
      messageId: message.messageId,
      phone: message.from,
    });
    return;
  }

  const currentLead = await getLeadByPhone(message.from);
  const text = message.body.trim();
  const normalizedText = normalizeText(text);

  if (!currentLead) {
    const { error } = await supabaseAdmin.from("whatsapp_leads").insert({
      phone: message.from,
      profile_name: message.profileName,
      empresa: EMPRESA,
      campaign_code: CAMPAIGN_CODE,
      source: SOURCE,
      status: "collecting_name",
      raw_last_message: {
        phone_number_id: message.phoneNumberId,
        wa_id: message.waId,
        message_id: message.messageId,
        timestamp: message.timestamp,
        text: message.body,
      },
    });

    if (error) throw error;
    await replyToLead(message.from, WELCOME_MESSAGE);
    return;
  }

  if (normalizedText === "actualizar datos") {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        status: "collecting_name",
        raw_last_message: message.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLead(message.from, UPDATE_DATA_MESSAGE);
    return;
  }

  if (currentLead.status === "collecting_name") {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        full_name: text,
        profile_name: currentLead.profile_name || message.profileName,
        status: "collecting_email",
        raw_last_message: message.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLead(message.from, ASK_EMAIL_MESSAGE);
    return;
  }

  if (currentLead.status === "collecting_email") {
    if (!looksLikeEmail(text)) {
      await replyToLead(message.from, INVALID_EMAIL_MESSAGE);
      return;
    }

    const { data: updatedLead, error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        email: text.toLowerCase(),
        profile_name: currentLead.profile_name || message.profileName,
        status: "registered",
        raw_last_message: message.payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentLead.id)
      .select("id, phone, profile_name, full_name, email, status")
      .single();

    if (error) throw error;
    await createCrmLeadFromWhatsapp(updatedLead as WhatsappLeadRow);
    await replyToLead(message.from, REGISTERED_MESSAGE);
    return;
  }

  await replyToLead(message.from, ALREADY_REGISTERED_MESSAGE);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || "", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    logWebhookDebugSummary(payload);

    after(async () => {
      const messages = extractInboundTextMessages(payload);

      for (const message of messages) {
        try {
          await handleInboundTextMessage(message);
        } catch (error) {
          console.error("[whatsapp] Could not process inbound message.", {
            messageId: message.messageId,
            phone: message.from,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  } catch (error) {
    console.error("[whatsapp] Webhook payload could not be processed.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ ok: true });
}
