import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  sendAndStoreImageMessage,
  sendAndStoreTextMessage,
} from "@/lib/whatsapp/outbound";
import { calculateFelicitationSchedule } from "@/lib/whatsapp/scheduling";
import {
  analyzeWhatsappAgentIntent,
  buildSlotsOfferMessage,
  buildSlotsReminderMessage,
  buildWhatsappAppointmentConfirmation,
  createWhatsappAgentAppointment,
  detectPeriodPreference,
  getNextWhatsappAgendaSlots,
  isWhatsappAgentBookingEnabled,
  isPositiveConfirmation,
  isSlotRejectionMessage,
  parseDatePreference,
  pickOfferedSlot,
  PERIOD_QUESTION,
  readWhatsappAgentContext,
  replyForIntent,
  replyForIntentWithKnownPeriod,
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
  payload: unknown;
};

const WELCOME_MESSAGE =
  "\u00a1Hola! \ud83d\udc4b Bienvenido/a a Prevital.\n\nGracias por escribirnos. Para completar tu inscripci\u00f3n y participar por una experiencia de Detox I\u00f3nico, por favor d\u00e9janos tu nombre completo.";

const ASK_EMAIL_MESSAGE =
  "Gracias \ud83d\ude0a Ahora d\u00e9janos tu correo electr\u00f3nico para finalizar tu inscripci\u00f3n.";

const INVALID_EMAIL_MESSAGE =
  "Parece que el correo no qued\u00f3 completo. \u00bfNos lo puedes enviar nuevamente, por favor?";

const REGISTERED_MESSAGE =
  "\u00a1Listo! \ud83d\udc9a Tu inscripci\u00f3n qued\u00f3 confirmada.\n\nGracias por participar en la campa\u00f1a de Detox I\u00f3nico de Prevital \ud83c\udf3f\n\nNuestro equipo revisar\u00e1 tu registro y, si eres seleccionado/a, te contactaremos por este mismo medio.";

const ALREADY_REGISTERED_MESSAGE =
  "Tu inscripci\u00f3n ya est\u00e1 registrada \ud83d\udc9a Si necesitas actualizar alg\u00fan dato, escr\u00edbenos: actualizar datos.";

const UPDATE_DATA_MESSAGE =
  "Claro \ud83d\ude0a Para actualizar tu inscripci\u00f3n, por favor env\u00edanos nuevamente tu nombre completo.";

const AFTER_HOURS_ACK_MESSAGE =
  "\u00a1Gracias por responder! \ud83d\udc9a\n\nTu mensaje qued\u00f3 registrado. Nuestro equipo de Prevital te contactar\u00e1 en horario de atenci\u00f3n para ayudarte a coordinar tu cita.\n\nHorario de atenci\u00f3n: lunes a s\u00e1bado de 8:00 a. m. a 6:00 p. m. \ud83c\udf3f";

const AGENT_UNKNOWN_MESSAGE =
  "Gracias por escribirnos 😊 Para ayudarte mejor, nuestro equipo revisará tu mensaje. Mientras tanto, puedo ayudarte a coordinar tu cita en Prevital.";

const BOOKING_DISABLED_CONFIRMATION =
  "Perfecto \ud83d\udc9a Ya tengo tu horario preferido. Nuestro equipo confirmara la cita por este mismo chat antes de dejarla agendada.";

const AGENT_UNHANDLED_MESSAGE =
  "Gracias por escribirnos \ud83d\ude0a Nuestro equipo revisar\u00e1 tu mensaje para ayudarte mejor.";

const DIFFERENT_DAY_MESSAGE =
  "Claro, sin problema 😊 ¿Qué día te queda fácil? Puedo revisar disponibilidad entre mañana y los próximos días.";

const DIFFERENT_DAY_WITH_PERIOD_MESSAGE =
  "Claro, sin problema 😊 ¿Qué día te queda fácil? Revisaré opciones en la jornada que me indicaste.";

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

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
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
    meta_message_id: message.messageId,
    message_type: "text",
    body: message.body,
    status: "received",
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

async function replyToLead(phone: string, body: string) {
  return sendAndStoreTextMessage(phone, body);
}

async function createCrmLeadFromWhatsapp(_lead: WhatsappLeadRow) {
  // TODO: Map this lead into public.leads once the final CRM field mapping is confirmed.
  // The current public.leads schema carries operational ownership, source, status,
  // group routing and campaign assumptions. For this MVP we keep WhatsApp leads
  // safely isolated in whatsapp_leads to avoid creating malformed CRM records.
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

async function handlePreFelicitationLead(
  lead: WhatsappLeadRow,
  message: InboundTextMessage,
  inboundWindowFields: Record<string, unknown>
) {
  const normalized = normalizeText(message.body);
  const intent = analyzeWhatsappAgentIntent(message.body);
  const reply = intent === "asks_location"
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
  await replyToLead(message.from, reply);
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
  }
) {
  const slots = await getNextWhatsappAgendaSlots({
    limit: 3,
    period: options.period,
    preferredDate: options.preferredDate,
  });
  const context = readWhatsappAgentContext(lead.notes);

  if (slots.length === 0) {
    await updateWhatsappAgentLead(lead.id, {
      status: "requiere_humano",
      priority: "alta",
      notes: writeWhatsappAgentContext(lead.notes, {
        ...context,
        period: options.period,
        preferredDate: options.preferredDate || context.preferredDate,
      }),
      ...inboundWindowFields,
    });
    const noSlotsMessage = buildSlotsOfferMessage(slots, options.period);
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

async function handleWhatsappAgent(
  lead: WhatsappLeadRow,
  message: InboundTextMessage,
  inboundWindowFields: Record<string, unknown>
) {
  const intent = analyzeWhatsappAgentIntent(message.body);
  const context = readWhatsappAgentContext(lead.notes);
  const period = detectPeriodPreference(message.body);
  const datePreference = parseDatePreference(message.body);
  const knownPeriod = period || context.lastOfferedPeriod || context.period;
  const shouldTreatAsPeriod = Boolean(period && lead.status !== "esperando_dia_preferido");

  if (intent === "needs_human") {
    const safeReply = replyForIntent(intent) || AGENT_UNKNOWN_MESSAGE;
    if (knownPeriod) {
      await offerWhatsappAgentSlots(lead, inboundWindowFields, {
        period: knownPeriod,
        preferredDate: context.preferredDate,
        intro: safeReply,
        reminder: true,
      });
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

  if (shouldTreatAsPeriod && period) {
    await offerWhatsappAgentSlots(lead, inboundWindowFields, {
      period,
      preferredDate: context.preferredDate,
    });
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
      await offerWhatsappAgentSlots(lead, inboundWindowFields, {
        period: knownPeriod,
        preferredDate: context.preferredDate,
        reminder: true,
      });
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
      await offerWhatsappAgentSlots(lead, inboundWindowFields, {
        period: knownPeriod,
        preferredDate: context.preferredDate,
        intro: replyForIntentWithKnownPeriod(intent) || directReply,
        reminder: true,
      });
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
  await replyToLead(message.from, AGENT_UNHANDLED_MESSAGE);
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

  const currentLead = await getLeadByPhone(message.from);
  const text = message.body.trim();
  const normalizedText = normalizeText(text);
  const inboundAt = parseInboundTimestamp(message.timestamp);
  const schedule = calculateFelicitationSchedule(inboundAt);
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
    },
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

  if (currentLead.status === "collecting_name") {
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

  if (currentLead.status === "collecting_email") {
    if (!looksLikeEmail(text)) {
      await supabaseAdmin
        .from("whatsapp_leads")
        .update(inboundWindowFields)
        .eq("id", currentLead.id);
      await replyToLead(message.from, INVALID_EMAIL_MESSAGE);
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
      "Inscripci\u00f3n confirmada Detox I\u00f3nico Prevital"
    );
    return;
  }

  if (isPreFelicitationStatus(currentLead.status)) {
    await handlePreFelicitationLead(currentLead, message, inboundWindowFields);
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
