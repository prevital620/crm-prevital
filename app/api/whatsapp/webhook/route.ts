import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  sendAndStoreImageMessage,
  sendAndStoreTextMessage,
} from "@/lib/whatsapp/outbound";
import { calculateFelicitationSchedule } from "@/lib/whatsapp/scheduling";
import {
  analyzeWhatsappAgentIntent,
  buildExactSlotAvailableMessage,
  buildMultipleNearbySlotsMessage,
  buildNoNearbySlotsMessage,
  buildPeriodTimeQuestion,
  buildSingleNearbySlotMessage,
  buildSlotsOfferMessage,
  buildSlotsReminderMessage,
  buildWhatsappAppointmentConfirmation,
  createWhatsappAgentAppointment,
  detectPeriodPreference,
  getNextWhatsappAgendaSlots,
  inferPeriodFromTime,
  isNegativeDateConfirmation,
  isWhatsappAgentBookingEnabled,
  isPositiveConfirmation,
  isSlotRejectionMessage,
  parseSpecificDatePreference,
  parseTimePreference,
  pickOfferedSlot,
  PERIOD_QUESTION,
  readWhatsappAgentContext,
  replyForIntent,
  replyForIntentWithKnownPeriod,
  timeToMinutes,
  writeWhatsappAgentContext,
} from "@/lib/whatsapp/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPRESA = "Prevital";
const CAMPAIGN_CODE = "PV_DETOX";
const SOURCE = "WhatsApp SaleADS";

type WhatsappLeadStatus =
  | "collecting_name"
  | "collecting_email"
  | "pidiendo_nombre"
  | "pidiendo_correo"
  | "registered"
  | "registrado"
  | "felicitacion_programada"
  | "felicitacion_enviada"
  | "respondio_para_agendar"
  | "pendiente_agendar"
  | "esperando_preferencia_jornada"
  | "esperando_dia_preferido"
  | "ofreciendo_horarios"
  | "esperando_confirmacion_horario"
  | "en_gestion_callcenter"
  | "agendado"
  | "sin_respuesta"
  | "requiere_template"
  | "requiere_humano"
  | "cerrado";

type WhatsappLeadRow = {
  id: string;
  phone: string;
  profile_name: string | null;
  full_name: string | null;
  email: string | null;
  status: WhatsappLeadStatus;
  last_inbound_at: string | null;
  reply_window_expires_at: string | null;
  safe_deadline_at: string | null;
  felicitation_scheduled_for: string | null;
  felicitation_sent_at: string | null;
  after_hours_ack_sent_at: string | null;
  notes: string | null;
};

type InboundTextMessage = {
  phoneNumberId: string | null;
  from: string;
  waId: string;
  messageId: string;
  timestamp: string | null;
  body: string;
  profileName: string | null;
  referral: Record<string, unknown> | null;
  payload: unknown;
};

type WhatsAppStatusEvent = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
  timestamp: string | null;
  recipientId: string | null;
  error: string | null;
  payload: unknown;
};

type AppointmentLookupRow = {
  id: string;
  lead_id: string | null;
  patient_name: string | null;
  phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  status: string | null;
  notes: string | null;
};

const WELCOME_MESSAGE =
  "¡Hola! 👋 Bienvenido/a a Prevital 💚\n\nTe contamos un poquito: estamos invitando a algunas personas a vivir una experiencia de Detox Iónico sin costo, como parte de una jornada especial de bienestar.\n\nLa sesión es presencial en Medellín, dura aproximadamente 30 minutos y nuestro equipo te orienta durante la experiencia.\n\nPara iniciar tu inscripción, por favor déjanos tu nombre completo.";

const ASK_EMAIL_MESSAGE =
  "Gracias \ud83d\ude0a Ahora d\u00e9janos tu correo electr\u00f3nico para finalizar tu inscripci\u00f3n.";

const INVALID_EMAIL_MESSAGE =
  "Parece que el correo no qued\u00f3 completo. \u00bfNos lo puedes enviar nuevamente, por favor?";

const EMAIL_COLLECTION_PRICE_MESSAGE =
  "Esta experiencia no tiene costo para las personas cuyo registro resulte favorecido \ud83d\udc9a\n\nPara finalizar tu inscripci\u00f3n, solo nos falta tu correo electr\u00f3nico.";

const EMAIL_COLLECTION_INFO_MESSAGE =
  "Es una experiencia de bienestar en Prevital. La orientaci\u00f3n completa la realiza nuestro equipo durante la cita \ud83c\udf3f\n\nPara finalizar tu inscripci\u00f3n, solo nos falta tu correo electr\u00f3nico.";

const EMAIL_COLLECTION_LOCATION_MESSAGE =
  "Estamos en El Poblado, Medell\u00edn \ud83c\udf3f Si tu inscripci\u00f3n resulta favorecida, te enviaremos la direcci\u00f3n completa para coordinar tu cita.\n\nPara finalizar tu inscripci\u00f3n, solo nos falta tu correo electr\u00f3nico.";

const EMAIL_COLLECTION_DURATION_MESSAGE =
  "La cita inicial tiene una duraci\u00f3n aproximada de 30 minutos \ud83d\ude0a\n\nPara finalizar tu inscripci\u00f3n, solo nos falta tu correo electr\u00f3nico.";

const REGISTERED_MESSAGE =
  "\u00a1Listo! \ud83d\udc9a Recibimos tu inscripci\u00f3n correctamente.";

const ALREADY_REGISTERED_MESSAGE =
  "Tu inscripci\u00f3n ya est\u00e1 registrada \ud83d\udc9a Si necesitas actualizar alg\u00fan dato, escr\u00edbenos: actualizar datos.";

const UPDATE_DATA_MESSAGE =
  "Claro \ud83d\ude0a Para actualizar tu inscripci\u00f3n, por favor env\u00edanos nuevamente tu nombre completo.";

const AFTER_HOURS_ACK_MESSAGE =
  "\u00a1Gracias por responder! \ud83d\udc9a\n\nTu mensaje qued\u00f3 registrado. Nuestro equipo de Prevital te contactar\u00e1 en horario de atenci\u00f3n para ayudarte a coordinar tu cita.\n\nHorario de atenci\u00f3n: lunes a s\u00e1bado de 8:00 a. m. a 6:00 p. m. \ud83c\udf3f";

const APPOINTMENT_ARRIVAL_MESSAGE =
  "\u00a1Perfecto! \ud83d\udc9a Te esperamos en Prevital.\n\nRecuerda traer tu c\u00e9dula original. Si tienes alg\u00fan inconveniente para llegar, escr\u00edbenos por este medio.";

const AGENT_UNKNOWN_MESSAGE =
  "Gracias por escribirnos 😊 Para ayudarte mejor, nuestro equipo revisará tu mensaje. Mientras tanto, puedo ayudarte a coordinar tu cita en Prevital.";

const BOOKING_DISABLED_CONFIRMATION =
  "Perfecto 💚 Ya tengo tu horario preferido. Nuestro equipo confirmará la cita por este mismo chat antes de dejarla agendada.";

const AGENT_UNHANDLED_MESSAGE =
  "Gracias por escribirnos \ud83d\ude0a Nuestro equipo revisar\u00e1 tu mensaje para ayudarte mejor.";

const DIFFERENT_DAY_MESSAGE =
  "Claro, sin problema 😊 ¿Qué día te queda fácil? Puedo revisar disponibilidad entre mañana y los próximos días.";

const DIFFERENT_DAY_WITH_PERIOD_MESSAGE =
  "Claro, sin problema 😊 ¿Qué día te queda fácil? Revisaré opciones en la jornada que me indicaste.";

function formatPendingDateLabel(date: string) {
  return new Date(`${date}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const PRE_FELICITATION_LOCATION_MESSAGE =
  "Estamos en El Poblado, Medell\u00edn \ud83c\udf3f\n\nTu inscripci\u00f3n ya qued\u00f3 registrada. Si sales beneficiado/a, te contactaremos por este mismo medio para coordinar tu cita y enviarte la direcci\u00f3n completa.";

const PRE_FELICITATION_COST_MESSAGE =
  "Esta experiencia no tiene costo para las personas seleccionadas \ud83d\udc9a\n\nTu inscripci\u00f3n ya qued\u00f3 registrada y te contactaremos por este mismo medio cuando el equipo revise los registros.";

const PRE_FELICITATION_WHEN_MESSAGE =
  "Tu inscripci\u00f3n ya qued\u00f3 registrada \ud83d\ude0a Nuestro equipo revisar\u00e1 los registros y te contactaremos por este mismo medio si sales beneficiado/a.";

const PRE_FELICITATION_CLINICAL_MESSAGE =
  "Esa informaci\u00f3n la revisa directamente nuestro equipo profesional durante la cita \ud83d\ude0a Por ahora tu inscripci\u00f3n ya qued\u00f3 registrada y te contactaremos por este mismo medio si sales beneficiado/a.";

const PRE_FELICITATION_UNKNOWN_MESSAGE =
  "Gracias por escribirnos \ud83d\ude0a Tu inscripci\u00f3n ya qued\u00f3 registrada. Nuestro equipo revisar\u00e1 tu mensaje y te contactaremos por este mismo medio si sales beneficiado/a.";

const PRE_FELICITATION_THANKS_MESSAGE =
  "Con mucho gusto \ud83d\ude0a\ud83d\udc9a Esperamos que tu inscripci\u00f3n resulte favorecida. Te contactaremos por este mismo medio cuando el equipo revise los registros \ud83c\udf3f";

const REQUIRES_HUMAN_SHORT_ACK_MESSAGE =
  "Con gusto \ud83d\ude0a Nuestro equipo revisar\u00e1 tu mensaje para ayudarte mejor.";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) return text;
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function normalizeLookupText(value: string | null | undefined) {
  return normalizeText(value || "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReferralFromMessage(message: Record<string, unknown>) {
  const referral = asRecord(message.referral);
  return referral && Object.keys(referral).length > 0 ? referral : null;
}

function referralLeadFields(referral: Record<string, unknown> | null) {
  if (!referral) return {};

  const adsContext = asRecord(referral.ads_context_data);
  const campaign = asRecord(referral.campaign);
  const adset = asRecord(referral.adset);
  const ad = asRecord(referral.ad);

  return {
    meta_campaign_id: firstString(referral.campaign_id, adsContext?.campaign_id, campaign?.id),
    meta_campaign_name: firstString(referral.campaign_name, adsContext?.campaign_name, campaign?.name),
    meta_adset_id: firstString(referral.adset_id, adsContext?.adset_id, adset?.id),
    meta_adset_name: firstString(referral.adset_name, adsContext?.adset_name, adset?.name),
    meta_ad_id: firstString(referral.ad_id, adsContext?.ad_id, ad?.id, referral.source_id),
    meta_ad_name: firstString(
      referral.ad_name,
      adsContext?.ad_name,
      adsContext?.ad_title,
      ad?.name,
      referral.headline
    ),
    meta_source_id: firstString(referral.source_id),
    meta_source_url: firstString(referral.source_url),
    meta_source_type: firstString(referral.source_type),
    meta_ctwa_clid: firstString(referral.ctwa_clid),
    meta_referral: referral,
  };
}

function phoneDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function phoneLookupKeys(value: string | null | undefined) {
  const digits = phoneDigits(value);
  if (!digits) return [];

  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(
    new Set([digits, local, local ? `57${local}` : ""].filter(Boolean))
  );
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function parseInboundTimestamp(timestamp: string | null) {
  if (!timestamp) return new Date();

  const numeric = Number(timestamp);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric * 1000);
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

function isWithinAttentionHours(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = values.weekday || "";
  const hour = Number(values.hour);
  const isSunday = weekday.toLowerCase().startsWith("sun") || weekday.toLowerCase().startsWith("dom");

  return !isSunday && hour >= 8 && hour < 18;
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
          referral: extractReferralFromMessage(message),
          payload: item,
        });
      });
    });
  });

  return messages;
}

function statusErrorText(status: Record<string, unknown>) {
  const errors = Array.isArray(status.errors) ? status.errors : [];
  const parts = errors
    .map((item) => {
      const error = asRecord(item);
      if (!error) return "";

      const errorData = asRecord(error.error_data);
      return [
        asString(error.title),
        asString(error.message),
        asString(errorData?.details),
      ]
        .filter(Boolean)
        .join(" - ");
    })
    .filter(Boolean);

  return parts.join(" | ") || null;
}

function extractStatusEvents(payload: unknown): WhatsAppStatusEvent[] {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const statuses: WhatsAppStatusEvent[] = [];

  entries.forEach((entry) => {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes) ? entryRecord.changes : [];

    changes.forEach((change) => {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord?.value);
      const valueStatuses = Array.isArray(value?.statuses) ? value.statuses : [];

      valueStatuses.forEach((item) => {
        const status = asRecord(item);
        if (!status) return;
        const id = asString(status?.id);
        const statusValue = asString(status?.status);
        if (!id || !statusValue) return;

        statuses.push({
          id,
          status: statusValue,
          timestamp: asString(status?.timestamp) || null,
          recipientId: asString(status?.recipient_id) || null,
          error: statusValue === "failed" ? statusErrorText(status) : null,
          payload: item,
        });
      });
    });
  });

  return statuses;
}

async function updateOutboundMessageStatus(event: WhatsAppStatusEvent) {
  const statusAt = parseInboundTimestamp(event.timestamp).toISOString();
  const payload: Record<string, unknown> = {
    status: event.status,
    status_updated_at: statusAt,
    error: event.error,
  };

  const { error } = await supabaseAdmin
    .from("whatsapp_messages")
    .update(payload)
    .eq("meta_message_id", event.id);

  if (error) throw error;
}

async function markRecentOutboundMessagesDeliveredFromInbound(phone: string, inboundAt: Date) {
  const deliveredAt = inboundAt.toISOString();
  const recentSince = new Date(inboundAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const baseUpdate = {
    status: "delivered",
    status_updated_at: deliveredAt,
    error: null,
  };

  const updates = [
    supabaseAdmin
      .from("whatsapp_messages")
      .update(baseUpdate)
      .eq("phone", phone)
      .eq("direction", "outbound")
      .is("status", null)
      .lte("created_at", deliveredAt)
      .gte("created_at", recentSince),
    supabaseAdmin
      .from("whatsapp_messages")
      .update(baseUpdate)
      .eq("phone", phone)
      .eq("direction", "outbound")
      .eq("status", "sent")
      .lte("created_at", deliveredAt)
      .gte("created_at", recentSince),
    supabaseAdmin
      .from("whatsapp_messages")
      .update(baseUpdate)
      .eq("phone", phone)
      .eq("direction", "outbound")
      .eq("status", "")
      .lte("created_at", deliveredAt)
      .gte("created_at", recentSince),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error("[whatsapp] Could not mark recent outbound messages as delivered.", {
      phone: maskPhone(phone),
      error: failed.error.message,
    });
  }
}

async function insertInboundMessage(message: InboundTextMessage) {
  const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
    phone: message.from,
    direction: "inbound",
    message_id: message.messageId,
    meta_message_id: message.messageId,
    message_type: "text",
    body: message.body,
    status: "received",
    payload: {
      phone_number_id: message.phoneNumberId,
      wa_id: message.waId,
      timestamp: message.timestamp,
      profile_name: message.profileName,
      referral: message.referral,
      message: message.payload,
    },
  });

  if (!error) return { duplicate: false };

  if (error.code === "23505") {
    return { duplicate: true };
  }

  throw error;
}

async function replyToLead(phone: string, body: string) {
  return sendAndStoreTextMessage(phone, body);
}

async function hasRecentOutboundBody(phone: string, body: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id")
    .eq("phone", phone)
    .eq("direction", "outbound")
    .eq("body", body)
    .gte("created_at", since)
    .limit(1);

  if (error) {
    console.error("[whatsapp] Could not check recent outbound duplicate.", {
      phone: maskPhone(phone),
      error: error.message,
    });
    return false;
  }

  return Boolean(data?.length);
}

async function replyToLeadOnceRecently(phone: string, body: string, hours = 24) {
  if (await hasRecentOutboundBody(phone, body, hours)) {
    return { ok: true, skippedDuplicate: true };
  }

  return replyToLead(phone, body);
}

async function createCrmLeadFromWhatsapp(_lead: WhatsappLeadRow) {
  // TODO: Map this lead into public.leads once the final CRM field mapping is confirmed.
  // The current public.leads schema carries operational ownership, source, status,
  // group routing and campaign assumptions. For this MVP we keep WhatsApp leads
  // safely isolated in whatsapp_leads to avoid creating malformed CRM records.
}

const APPOINTMENT_ARRIVAL_LEAD_STATUSES = new Set<WhatsappLeadStatus>([
  "agendado",
]);

const ACTIVE_APPOINTMENT_REPLY_STATUSES = new Set([
  "agendada",
  "confirmada",
  "reagendada",
  "en_espera",
  "en_atencion",
]);

const APPOINTMENT_ARRIVAL_PHRASES = [
  "voy en camino",
  "ya voy",
  "estoy llegando",
  "voy para alla",
  "llego en unos minutos",
  "estoy cerca",
  "voy llegando",
  "ya estoy llegando",
  "estoy en camino",
  "voy para prevital",
];

function isAppointmentArrivalText(text: string) {
  const normalized = normalizeLookupText(text);
  return APPOINTMENT_ARRIVAL_PHRASES.some((phrase) =>
    normalized.includes(phrase)
  );
}

function matchesAppointmentName(lead: WhatsappLeadRow, appointment: AppointmentLookupRow) {
  const leadName = normalizeLookupText(`${lead.full_name || ""} ${lead.profile_name || ""}`);
  const appointmentName = normalizeLookupText(appointment.patient_name);
  if (!leadName || !appointmentName) return false;

  const appointmentTokens = appointmentName
    .split(" ")
    .filter((token) => token.length >= 3);
  if (appointmentTokens.length < 3) return false;

  return appointmentTokens.every((token) => leadName.includes(token));
}

function appointmentTimestamp(item: Pick<AppointmentLookupRow, "appointment_date" | "appointment_time">) {
  return `${item.appointment_date || "9999-12-31"}T${item.appointment_time || "23:59:59"}`;
}

async function findActiveWhatsappAppointment(
  lead: WhatsappLeadRow,
  phone: string
) {
  const phoneKeys = new Set(phoneLookupKeys(phone));

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id, lead_id, patient_name, phone, appointment_date, appointment_time, status, notes")
    .in("status", Array.from(ACTIVE_APPOINTMENT_REPLY_STATUSES))
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(1500);

  if (error) throw error;

  return ((data || []) as AppointmentLookupRow[])
    .filter((appointment) => {
      const appointmentPhoneKeys = phoneLookupKeys(appointment.phone);
      const matchesPhone = appointmentPhoneKeys.some((key) => phoneKeys.has(key));
      const matchesWhatsappLead = Boolean(appointment.notes?.includes(lead.id));
      const matchesName = matchesAppointmentName(lead, appointment);
      return matchesPhone || matchesWhatsappLead || matchesName;
    })
    .sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)))[0] || null;
}

async function shouldReplyAsAppointmentArrival(
  lead: WhatsappLeadRow,
  message: InboundTextMessage
) {
  if (!isAppointmentArrivalText(message.body)) return false;

  if (APPOINTMENT_ARRIVAL_LEAD_STATUSES.has(lead.status)) {
    return true;
  }

  return Boolean(await findActiveWhatsappAppointment(lead, message.from));
}

function whatsappAgentCanHandle(status: string | null | undefined) {
  return [
    "felicitacion_enviada",
    "respondio_para_agendar",
    "pendiente_agendar",
    "esperando_preferencia_jornada",
    "esperando_dia_preferido",
    "ofreciendo_horarios",
    "esperando_confirmacion_horario",
    "requiere_humano",
  ].includes(status || "");
}

function isHumanManagedStatus(status: string | null | undefined) {
  return status === "en_gestion_callcenter" || status === "cerrado";
}

function isPreFelicitationStatus(status: string | null | undefined) {
  return ["registered", "registrado", "felicitacion_programada"].includes(status || "");
}

function isAskingWhenNotice(text: string) {
  return hasAny(text, [
    "cuando avisan",
    "cuando me avisan",
    "cuando me contactan",
    "cuando escriben",
    "cuando se sabe",
    "cuando me dicen",
    "cuando llaman",
    "cuando sale",
    "cuando salen",
  ]);
}

function isThanksMessage(text: string) {
  const normalized = normalizeText(text).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compact = normalized.replace(/\s+/g, " ").trim();
  return [
    "gracias",
    "muchas gracias",
    "ok gracias",
    "listo gracias",
    "perfecto gracias",
    "dios quiera que si",
  ].includes(compact);
}

function isShortHumanAckMessage(text: string) {
  const normalized = normalizeText(text).replace(/[^\p{Letter}\p{Number}\s]/gu, " ");
  const compact = normalized.replace(/\s+/g, " ").trim();
  return [
    "gracias",
    "si",
    "sí",
    "ok",
    "listo",
    "dale",
    "bueno",
    "perfecto",
    "de acuerdo",
  ].includes(compact);
}

function emailCollectionReplyForMessage(text: string) {
  const intent = analyzeWhatsappAgentIntent(text);
  if (intent === "asks_price") return EMAIL_COLLECTION_PRICE_MESSAGE;
  if (intent === "asks_location") return EMAIL_COLLECTION_LOCATION_MESSAGE;
  if (intent === "asks_duration") return EMAIL_COLLECTION_DURATION_MESSAGE;
  if (intent === "wants_info" || intent === "needs_human") return EMAIL_COLLECTION_INFO_MESSAGE;

  const normalized = normalizeText(text);
  if (hasAny(normalized, ["de que se trata", "que es", "informacion", "info", "como funciona"])) {
    return EMAIL_COLLECTION_INFO_MESSAGE;
  }

  return null;
}

function nameCollectionReplyForMessage(text: string) {
  const intent = analyzeWhatsappAgentIntent(text);
  if (
    intent === "wants_info" ||
    intent === "asks_price" ||
    intent === "asks_location" ||
    intent === "asks_duration"
  ) {
    return WELCOME_MESSAGE;
  }

  const normalized = normalizeText(text);
  if (hasAny(normalized, ["de que se trata", "que es", "informacion", "info", "como funciona"])) {
    return WELCOME_MESSAGE;
  }

  return null;
}

async function handlePreFelicitationLead(
  lead: WhatsappLeadRow,
  message: InboundTextMessage,
  inboundWindowFields: Record<string, unknown>
) {
  const normalized = normalizeText(message.body);
  const intent = analyzeWhatsappAgentIntent(message.body);
  const reply = isThanksMessage(message.body)
    ? PRE_FELICITATION_THANKS_MESSAGE
    : intent === "asks_location"
    ? PRE_FELICITATION_LOCATION_MESSAGE
    : intent === "asks_price"
      ? PRE_FELICITATION_COST_MESSAGE
      : intent === "needs_human"
        ? PRE_FELICITATION_CLINICAL_MESSAGE
        : isAskingWhenNotice(normalized)
          ? PRE_FELICITATION_WHEN_MESSAGE
          : PRE_FELICITATION_UNKNOWN_MESSAGE;

  await supabaseAdmin
    .from("whatsapp_leads")
    .update(inboundWindowFields)
    .eq("id", lead.id);
  await replyToLeadOnceRecently(message.from, reply);
}

async function updateWhatsappAgentLead(
  leadId: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabaseAdmin
    .from("whatsapp_leads")
    .update(payload)
    .eq("id", leadId);

  if (error) throw error;
}

async function offerWhatsappAgentSlots(
  lead: WhatsappLeadRow,
  inboundWindowFields: Record<string, unknown>,
  options: {
    period: "morning" | "afternoon";
    preferredDate?: string;
    intro?: string;
    reminder?: boolean;
    exactDateOnly?: boolean;
    noAvailabilityMessage?: string;
    minTime?: string;
    targetTime?: string;
  }
) {
  const slots = await getNextWhatsappAgendaSlots({
    limit: 3,
    period: options.period,
    preferredDate: options.preferredDate,
    exactDateOnly: options.exactDateOnly,
    minTime: options.minTime,
    targetTime: options.targetTime,
  });
  const context = readWhatsappAgentContext(lead.notes);

  if (slots.length === 0) {
    await updateWhatsappAgentLead(lead.id, {
      status: options.exactDateOnly ? "esperando_dia_preferido" : "requiere_humano",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, {
        ...context,
        period: options.period,
        preferredDate: options.preferredDate || context.preferredDate,
        pendingDate: undefined,
        pendingPeriod: undefined,
        pendingSlotDate: undefined,
        pendingSlotTime: undefined,
        pendingAction: undefined,
      }),
      ...inboundWindowFields,
    });
    const noSlotsMessage = options.noAvailabilityMessage || buildSlotsOfferMessage(slots, options.period);
    await replyToLead(
      lead.phone,
      options.intro ? `${options.intro}\n\n${noSlotsMessage}` : noSlotsMessage
    );
    return;
  }

  await updateWhatsappAgentLead(lead.id, {
    status: "esperando_confirmacion_horario",
    priority: "alta",
    notes: writeWhatsappAgentContext(lead.notes, {
      ...context,
      period: options.period,
      preferredDate: options.preferredDate || context.preferredDate,
      pendingDate: undefined,
      pendingPeriod: undefined,
      pendingSlotDate: undefined,
      pendingSlotTime: undefined,
      pendingAction: undefined,
      lastOfferedPeriod: options.period,
      lastOfferedDate: slots[0]?.date,
    }),
    ...inboundWindowFields,
  });
  const slotsMessage = options.reminder
    ? buildSlotsReminderMessage(slots, options.period)
    : buildSlotsOfferMessage(slots, options.period);
  await replyToLead(
    lead.phone,
    options.intro ? `${options.intro}\n\n${slotsMessage}` : slotsMessage
  );
}

async function askForTimeInPeriod(
  lead: WhatsappLeadRow,
  inboundWindowFields: Record<string, unknown>,
  period: "morning" | "afternoon",
  context: ReturnType<typeof readWhatsappAgentContext>,
  intro?: string
) {
  await updateWhatsappAgentLead(lead.id, {
    status: "esperando_confirmacion_horario",
    priority: "alta",
    notes: writeWhatsappAgentContext(lead.notes, {
      ...context,
      period,
      lastOfferedPeriod: period,
      lastOfferedDate: undefined,
      pendingDate: undefined,
      pendingPeriod: undefined,
      pendingSlotDate: undefined,
      pendingSlotTime: undefined,
      pendingAction: undefined,
    }),
    ...inboundWindowFields,
  });

  const question = buildPeriodTimeQuestion(period);
  await replyToLead(lead.phone, intro ? `${intro}\n\n${question}` : question);
}

async function offerSlotsFromTimePreference(
  lead: WhatsappLeadRow,
  inboundWindowFields: Record<string, unknown>,
  period: "morning" | "afternoon",
  timePreference: NonNullable<ReturnType<typeof parseTimePreference>>,
  context: ReturnType<typeof readWhatsappAgentContext>,
  preferredDate?: string
) {
  if (timePreference.type === "exact") {
    const matchingSlots = await getNextWhatsappAgendaSlots({
      limit: 80,
      period,
      preferredDate,
      exactDateOnly: Boolean(preferredDate),
    });
    const preferredSearchDate = preferredDate || matchingSlots[0]?.date;
    const sameDaySlots = preferredSearchDate
      ? matchingSlots.filter((slot) => slot.date === preferredSearchDate)
      : matchingSlots;
    const exactSlot = sameDaySlots.find((slot) => slot.time === timePreference.time);

    if (exactSlot) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_confirmacion_horario",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          period,
          preferredDate: preferredDate || context.preferredDate,
          lastOfferedPeriod: period,
          lastOfferedDate: exactSlot.date,
          pendingSlotDate: exactSlot.date,
          pendingSlotTime: exactSlot.time,
          pendingAction: "confirm_slot_for_booking",
        }),
        ...inboundWindowFields,
      });
      await replyToLead(lead.phone, buildExactSlotAvailableMessage(exactSlot));
      return;
    }

    const nearbyDate = preferredSearchDate;
    const nearbySlots = matchingSlots
      .filter((slot) => slot.date === nearbyDate && slot.time !== timePreference.time)
      .sort(
        (left, right) =>
          Math.abs(timeToMinutes(left.time) - timeToMinutes(timePreference.time)) -
            Math.abs(timeToMinutes(right.time) - timeToMinutes(timePreference.time)) ||
          left.time.localeCompare(right.time)
      )
      .slice(0, 3)
      .map((slot, index) => ({ ...slot, index: index + 1 }));

    await updateWhatsappAgentLead(lead.id, {
      status: nearbySlots.length > 0 ? "esperando_confirmacion_horario" : "requiere_humano",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, {
        ...context,
        period,
        preferredDate: preferredDate || context.preferredDate,
        lastOfferedPeriod: period,
        lastOfferedDate: nearbySlots[0]?.date,
        pendingSlotDate: nearbySlots.length === 1 ? nearbySlots[0].date : undefined,
        pendingSlotTime: nearbySlots.length === 1 ? nearbySlots[0].time : undefined,
        pendingAction: nearbySlots.length === 1 ? "confirm_slot_for_booking" : undefined,
      }),
      ...inboundWindowFields,
    });

    if (nearbySlots.length === 0) {
      await replyToLead(lead.phone, buildNoNearbySlotsMessage());
      return;
    }

    if (nearbySlots.length === 1) {
      await replyToLead(lead.phone, buildSingleNearbySlotMessage(timePreference.time, nearbySlots[0]));
      return;
    }

    await replyToLead(lead.phone, buildMultipleNearbySlotsMessage(timePreference.time, nearbySlots));
    return;
  }

  const minTime = timePreference.type === "after" ? timePreference.time : undefined;
  const slots = await getNextWhatsappAgendaSlots({
    limit: 3,
    period,
    preferredDate,
    exactDateOnly: Boolean(preferredDate),
    minTime,
  });

  await updateWhatsappAgentLead(lead.id, {
    status: slots.length > 0 ? "esperando_confirmacion_horario" : "requiere_humano",
    priority: "alta",
    notes: writeWhatsappAgentContext(lead.notes, {
      ...context,
      period,
      preferredDate: preferredDate || context.preferredDate,
      lastOfferedPeriod: period,
      lastOfferedDate: slots[0]?.date,
      pendingSlotDate: undefined,
      pendingSlotTime: undefined,
      pendingAction: undefined,
    }),
    ...inboundWindowFields,
  });
  await replyToLead(lead.phone, buildSlotsOfferMessage(slots, period));
}

async function handleWhatsappAgent(
  lead: WhatsappLeadRow,
  message: InboundTextMessage,
  inboundWindowFields: Record<string, unknown>
) {
  const intent = analyzeWhatsappAgentIntent(message.body);
  const context = readWhatsappAgentContext(lead.notes);
  const normalizedMessage = normalizeText(message.body);
  const period = detectPeriodPreference(message.body);
  const bareManana = /^(manana|ma\u00f1ana)$/.test(normalizedMessage);
  const periodForScheduling =
    lead.status === "esperando_dia_preferido" && bareManana ? null : period;
  const treatsBareMorningAsPeriod =
    lead.status === "esperando_preferencia_jornada" &&
    bareManana;
  const datePreference = treatsBareMorningAsPeriod
    ? null
    : parseSpecificDatePreference(message.body);
  const contextDate = datePreference?.date || context.preferredDate || context.pendingDate;
  const initialKnownPeriod = periodForScheduling || context.lastOfferedPeriod || context.period;
  const initialTimePreference = parseTimePreference(message.body, initialKnownPeriod);
  const periodFromTime =
    initialTimePreference && "time" in initialTimePreference
      ? inferPeriodFromTime(initialTimePreference.time)
      : null;
  const knownPeriod = initialKnownPeriod || periodFromTime;
  const timePreference = knownPeriod
    ? parseTimePreference(message.body, knownPeriod)
    : initialTimePreference;
  const pendingReplyTimePreference = context.pendingDate
    ? parseTimePreference(message.body, context.pendingPeriod || knownPeriod || undefined)
    : null;
  const pendingReplyPeriod =
    context.pendingPeriod ||
    knownPeriod ||
    (pendingReplyTimePreference && "time" in pendingReplyTimePreference
      ? inferPeriodFromTime(pendingReplyTimePreference.time)
      : null);
  const shouldTreatAsPeriod = Boolean(
    periodForScheduling && lead.status !== "esperando_dia_preferido"
  );

  if (context.pendingAction === "confirm_date_for_schedule" && context.pendingDate) {
    if (pendingReplyTimePreference && "time" in pendingReplyTimePreference) {
      const confirmedPeriod =
        pendingReplyPeriod || inferPeriodFromTime(pendingReplyTimePreference.time);

      if (confirmedPeriod) {
        await offerSlotsFromTimePreference(
          lead,
          inboundWindowFields,
          confirmedPeriod,
          { type: "exact", time: pendingReplyTimePreference.time },
          {
            ...context,
            preferredDate: context.pendingDate,
            pendingDate: undefined,
            pendingPeriod: undefined,
            pendingSlotTime: undefined,
            pendingAction: undefined,
          },
          context.pendingDate
        );
        return;
      }
    }

    if (isPositiveConfirmation(message.body)) {
      const confirmedTime =
        pendingReplyTimePreference && "time" in pendingReplyTimePreference
          ? pendingReplyTimePreference.time
          : context.pendingSlotTime;
      const confirmedPeriod =
        pendingReplyPeriod ||
        (confirmedTime ? inferPeriodFromTime(confirmedTime) : null);

      if (confirmedTime && confirmedPeriod) {
        await offerSlotsFromTimePreference(
          lead,
          inboundWindowFields,
          confirmedPeriod,
          { type: "exact", time: confirmedTime },
          {
            ...context,
            preferredDate: context.pendingDate,
            pendingDate: undefined,
            pendingPeriod: undefined,
            pendingSlotTime: undefined,
            pendingAction: undefined,
          },
          context.pendingDate
        );
        return;
      }

      if (context.pendingPeriod) {
        await offerWhatsappAgentSlots(lead, inboundWindowFields, {
          period: context.pendingPeriod,
          preferredDate: context.pendingDate,
          exactDateOnly: true,
        });
        return;
      }

      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_preferencia_jornada",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          preferredDate: context.pendingDate,
          pendingDate: undefined,
          pendingPeriod: undefined,
          pendingSlotTime: undefined,
          pendingAction: undefined,
        }),
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        `Perfecto 😊 Para ${formatPendingDateLabel(context.pendingDate)}, ¿te queda mejor en la mañana o en la tarde?`
      );
      return;
    }

    if (isNegativeDateConfirmation(message.body)) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_dia_preferido",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          pendingDate: undefined,
          pendingPeriod: undefined,
          pendingSlotTime: undefined,
          pendingAction: undefined,
        }),
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        "Claro 😊 ¿Qué día te queda fácil para revisar disponibilidad?"
      );
      return;
    }
  }

  if (intent === "needs_human") {
    const safeReply = replyForIntent(intent) || AGENT_UNKNOWN_MESSAGE;
    if (knownPeriod) {
      await askForTimeInPeriod(lead, inboundWindowFields, knownPeriod, context, safeReply);
      return;
    }

    await updateWhatsappAgentLead(lead.id, {
      status: "requiere_humano",
      priority: "alta",
      ...inboundWindowFields,
    });
    await replyToLead(message.from, safeReply);
    return;
  }

  if (isSlotRejectionMessage(message.body)) {
    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_dia_preferido",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, context),
      ...inboundWindowFields,
    });
    await replyToLead(
      message.from,
      knownPeriod ? DIFFERENT_DAY_WITH_PERIOD_MESSAGE : DIFFERENT_DAY_MESSAGE
    );
    return;
  }

  if (
    lead.status === "esperando_dia_preferido" &&
    context.pendingDate &&
    isPositiveConfirmation(message.body)
  ) {
    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_preferencia_jornada",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, {
        ...context,
        preferredDate: context.pendingDate,
        pendingDate: undefined,
      }),
      ...inboundWindowFields,
    });
    await replyToLead(message.from, "Perfecto 💚 ¿Te queda mejor en la mañana o en la tarde?");
    return;
  }

  if (timePreference && knownPeriod && datePreference) {
    if (datePreference.needsConfirmation) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_dia_preferido",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          period: knownPeriod,
          pendingDate: datePreference.date,
          pendingPeriod: knownPeriod,
          pendingSlotTime: "time" in timePreference ? timePreference.time : undefined,
          pendingAction: "confirm_date_for_schedule",
        }),
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        `¿Te refieres a este ${datePreference.label}?`
      );
      return;
    }

    await offerSlotsFromTimePreference(
      lead,
      inboundWindowFields,
      knownPeriod,
      timePreference,
      {
        ...context,
        preferredDate: datePreference.date,
      },
      datePreference.date
    );
    return;
  }

  if (timePreference && !knownPeriod) {
    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_preferencia_jornada",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, context),
      ...inboundWindowFields,
    });
    await replyToLead(message.from, PERIOD_QUESTION);
    return;
  }

  if (datePreference && periodForScheduling) {
    if (datePreference.needsConfirmation) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_dia_preferido",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          period: periodForScheduling,
          pendingDate: datePreference.date,
          pendingPeriod: periodForScheduling,
          pendingAction: "confirm_date_for_schedule",
        }),
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        `¿Te refieres a este ${datePreference.label}?`
      );
      return;
    }

    await askForTimeInPeriod(
      lead,
      inboundWindowFields,
      periodForScheduling,
      {
        ...context,
        preferredDate: datePreference.date,
        pendingDate: undefined,
        pendingPeriod: undefined,
        pendingAction: undefined,
      }
    );
    return;
  }

  if (shouldTreatAsPeriod && periodForScheduling) {
    await askForTimeInPeriod(lead, inboundWindowFields, periodForScheduling, context);
    return;
  }

  if (datePreference && lead.status !== "esperando_preferencia_jornada") {
    if (datePreference.needsConfirmation) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_dia_preferido",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, {
          ...context,
          pendingDate: datePreference.date,
          pendingPeriod: undefined,
          pendingAction: "confirm_date_for_schedule",
        }),
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        `¿Te refieres a este ${datePreference.label}?`
      );
      return;
    }

    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_preferencia_jornada",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, {
        ...context,
        preferredDate: datePreference.date,
        pendingDate: undefined,
      }),
      ...inboundWindowFields,
    });
    await replyToLead(message.from, "Perfecto 💚 ¿Te queda mejor en la mañana o en la tarde?");
    return;
  }

  if (
    context.pendingAction === "confirm_slot_for_booking" &&
    context.pendingSlotDate &&
    context.pendingSlotTime
  ) {
    if (!isPositiveConfirmation(message.body)) {
      await askForTimeInPeriod(
        lead,
        inboundWindowFields,
        knownPeriod || context.period || "morning",
        {
          ...context,
          pendingSlotDate: undefined,
          pendingSlotTime: undefined,
          pendingAction: undefined,
        }
      );
      return;
    }

    const selectedSlot = {
      index: 1,
      date: context.pendingSlotDate,
      time: context.pendingSlotTime,
      remaining: 1,
    };

    if (!isWhatsappAgentBookingEnabled()) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_confirmacion_horario",
        priority: "alta",
        ...inboundWindowFields,
      });
      await replyToLead(message.from, BOOKING_DISABLED_CONFIRMATION);
      return;
    }

    const result = await createWhatsappAgentAppointment({
      lead,
      slot: selectedSlot,
    });

    if (!result.ok) {
      await replyToLead(message.from, result.error);
      return;
    }

    await replyToLead(
      message.from,
      buildWhatsappAppointmentConfirmation({
        name: lead.full_name,
        date: selectedSlot.date,
        time: selectedSlot.time,
      })
    );
    return;
  }

  if (
    timePreference &&
    knownPeriod &&
    (!context.lastOfferedDate ||
      timePreference.type !== "exact" ||
      /(:|\blas\b|am|pm|a\s*m|p\s*m)/.test(normalizedMessage))
  ) {
    await offerSlotsFromTimePreference(
      lead,
      inboundWindowFields,
      knownPeriod,
      timePreference,
      {
        ...context,
        preferredDate: contextDate,
      },
      contextDate
    );
    return;
  }

  if (intent === "chooses_slot") {
    if (lead.status !== "esperando_confirmacion_horario") {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_preferencia_jornada",
        priority: "alta",
        notes: writeWhatsappAgentContext(lead.notes, context),
        ...inboundWindowFields,
      });
      await replyToLead(message.from, PERIOD_QUESTION);
      return;
    }

    const selectedPeriod = context.lastOfferedPeriod || context.period;
    const slots = await getNextWhatsappAgendaSlots({
      limit: 3,
      period: selectedPeriod,
      preferredDate: context.preferredDate,
    });
    const selectedSlot = pickOfferedSlot(message.body, slots);

    if (!selectedSlot) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_confirmacion_horario",
        priority: "alta",
        ...inboundWindowFields,
      });
      await replyToLead(
        message.from,
        "No alcance a identificar el horario elegido. Responde con 1, 2 o 3 segun la opcion que prefieras \ud83d\ude0a"
      );
      return;
    }

    if (!isWhatsappAgentBookingEnabled()) {
      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_confirmacion_horario",
        priority: "alta",
        ...inboundWindowFields,
      });
      await replyToLead(message.from, BOOKING_DISABLED_CONFIRMATION);
      return;
    }

    const result = await createWhatsappAgentAppointment({
      lead,
      slot: selectedSlot,
    });

    if (!result.ok) {
      if (result.reason === "duplicate" || result.reason === "insert_failed") {
        await replyToLead(message.from, result.error);
        return;
      }

      await updateWhatsappAgentLead(lead.id, {
        status: "esperando_confirmacion_horario",
        priority: "alta",
        ...inboundWindowFields,
      });
      await replyToLead(message.from, result.error);
      return;
    }

    await replyToLead(
      message.from,
      buildWhatsappAppointmentConfirmation({
        name: lead.full_name,
        date: selectedSlot.date,
        time: selectedSlot.time,
      })
    );
    return;
  }

  if (intent === "wants_schedule") {
    if (knownPeriod) {
      await askForTimeInPeriod(lead, inboundWindowFields, knownPeriod, context);
      return;
    }

    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_preferencia_jornada",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, context),
      ...inboundWindowFields,
    });
    await replyToLead(message.from, PERIOD_QUESTION);
    return;
  }

  const directReply = replyForIntent(intent);
  if (directReply) {
    if (knownPeriod) {
      await askForTimeInPeriod(
        lead,
        inboundWindowFields,
        knownPeriod,
        context,
        replyForIntentWithKnownPeriod(intent) || directReply
      );
      return;
    }

    await updateWhatsappAgentLead(lead.id, {
      status: "esperando_preferencia_jornada",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, context),
      ...inboundWindowFields,
    });
    await replyToLead(message.from, directReply);
    return;
  }

  await updateWhatsappAgentLead(lead.id, {
    status: "requiere_humano",
    priority: "alta",
    notes: writeWhatsappAgentContext(lead.notes, context),
    ...inboundWindowFields,
  });
  await replyToLeadOnceRecently(message.from, AGENT_UNHANDLED_MESSAGE);
}

async function getLeadByPhone(phone: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_leads")
    .select(
      "id, phone, profile_name, full_name, email, status, last_inbound_at, reply_window_expires_at, safe_deadline_at, felicitation_scheduled_for, felicitation_sent_at, after_hours_ack_sent_at, notes"
    )
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

  const text = message.body.trim();
  const normalizedText = normalizeText(text);
  const inboundAt = parseInboundTimestamp(message.timestamp);
  await markRecentOutboundMessagesDeliveredFromInbound(message.from, inboundAt);

  const currentLead = await getLeadByPhone(message.from);
  const schedule = calculateFelicitationSchedule(inboundAt);
  const referralFields = referralLeadFields(message.referral);
  const inboundWindowFields = {
    last_inbound_at: inboundAt.toISOString(),
    reply_window_expires_at: schedule.replyWindowExpiresAt.toISOString(),
    safe_deadline_at: schedule.safeDeadlineAt.toISOString(),
    raw_last_message: {
      phone_number_id: message.phoneNumberId,
      wa_id: message.waId,
      message_id: message.messageId,
      timestamp: message.timestamp,
      text: message.body,
      referral: message.referral,
    },
    ...referralFields,
    updated_at: new Date().toISOString(),
  };

  if (!currentLead) {
    const { error } = await supabaseAdmin.from("whatsapp_leads").insert({
      phone: message.from,
      profile_name: message.profileName,
      empresa: EMPRESA,
      campaign_code: CAMPAIGN_CODE,
      source: SOURCE,
      status: "collecting_name",
      ...inboundWindowFields,
    });

    if (error) throw error;
    await replyToLead(message.from, WELCOME_MESSAGE);
    return;
  }

  if (isHumanManagedStatus(currentLead.status)) {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update(inboundWindowFields)
      .eq("id", currentLead.id);

    if (error) throw error;
    return;
  }

  if (normalizedText === "actualizar datos") {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        status: "collecting_name",
        felicitation_scheduled_for: null,
        felicitation_sent_at: null,
        ...inboundWindowFields,
      })
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLead(message.from, UPDATE_DATA_MESSAGE);
    return;
  }

  if (await shouldReplyAsAppointmentArrival(currentLead, message)) {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update(inboundWindowFields)
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLead(message.from, APPOINTMENT_ARRIVAL_MESSAGE);
    return;
  }

  if (currentLead.status === "collecting_name" || currentLead.status === "pidiendo_nombre") {
    const contextualReply = nameCollectionReplyForMessage(text);
    if (contextualReply) {
      const { error } = await supabaseAdmin
        .from("whatsapp_leads")
        .update(inboundWindowFields)
        .eq("id", currentLead.id);

      if (error) throw error;
      await replyToLead(message.from, contextualReply);
      return;
    }

    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        full_name: text,
        profile_name: currentLead.profile_name || message.profileName,
        status: "collecting_email",
        ...inboundWindowFields,
      })
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLead(message.from, ASK_EMAIL_MESSAGE);
    return;
  }

  if (currentLead.status === "collecting_email" || currentLead.status === "pidiendo_correo") {
    if (!looksLikeEmail(text)) {
      const contextualReply = emailCollectionReplyForMessage(text);
      await supabaseAdmin
        .from("whatsapp_leads")
        .update(inboundWindowFields)
        .eq("id", currentLead.id);
      await replyToLead(message.from, contextualReply || INVALID_EMAIL_MESSAGE);
      return;
    }

    const scheduleStatus = schedule.canSchedule
      ? "felicitacion_programada"
      : "requiere_template";

    const { data: updatedLead, error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        email: text.toLowerCase(),
        profile_name: currentLead.profile_name || message.profileName,
        status: scheduleStatus,
        felicitation_scheduled_for: schedule.canSchedule
          ? schedule.felicitationScheduledFor.toISOString()
          : null,
        selected_at: null,
        ...inboundWindowFields,
      })
      .eq("id", currentLead.id)
      .select("id, phone, profile_name, full_name, email, status, last_inbound_at, reply_window_expires_at, safe_deadline_at, felicitation_scheduled_for, felicitation_sent_at, after_hours_ack_sent_at, notes")
      .single();

    if (error) throw error;
    await createCrmLeadFromWhatsapp(updatedLead as WhatsappLeadRow);
    await replyToLead(message.from, REGISTERED_MESSAGE);
    await sendAndStoreImageMessage(
      message.from,
      process.env.WHATSAPP_IMAGE_INSCRIPCION_URL,
      "Si tu inscripci\u00f3n resulta favorecida, te contactaremos pronto \ud83c\udf3f"
    );
    return;
  }

  if (isPreFelicitationStatus(currentLead.status)) {
    await handlePreFelicitationLead(currentLead, message, inboundWindowFields);
    return;
  }

  if (currentLead.status === "requiere_humano" && isShortHumanAckMessage(message.body)) {
    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update(inboundWindowFields)
      .eq("id", currentLead.id);

    if (error) throw error;
    await replyToLeadOnceRecently(message.from, REQUIRES_HUMAN_SHORT_ACK_MESSAGE);
    return;
  }

  if (whatsappAgentCanHandle(currentLead.status)) {
    await handleWhatsappAgent(currentLead, message, inboundWindowFields);
    return;
  }

  if (
    currentLead.status === "felicitacion_enviada" ||
    currentLead.status === "respondio_para_agendar"
  ) {
    const shouldSendAfterHoursAck =
      !currentLead.after_hours_ack_sent_at && !isWithinAttentionHours(inboundAt);
    const afterHoursAckSentAt = shouldSendAfterHoursAck
      ? new Date().toISOString()
      : currentLead.after_hours_ack_sent_at;

    const { error } = await supabaseAdmin
      .from("whatsapp_leads")
      .update({
        status: "respondio_para_agendar",
        priority: "alta",
        after_hours_ack_sent_at: afterHoursAckSentAt,
        ...inboundWindowFields,
      })
      .eq("id", currentLead.id);

    if (error) throw error;
    if (shouldSendAfterHoursAck) {
      await replyToLead(message.from, AFTER_HOURS_ACK_MESSAGE);
    }
    return;
  }

  await supabaseAdmin
    .from("whatsapp_leads")
    .update(inboundWindowFields)
    .eq("id", currentLead.id);

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
      const statuses = extractStatusEvents(payload);

      for (const status of statuses) {
        try {
          await updateOutboundMessageStatus(status);
        } catch (error) {
          console.error("[whatsapp] Could not update outbound message status.", {
            metaMessageId: status.id,
            status: status.status,
            recipientId: maskPhone(status.recipientId),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

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
