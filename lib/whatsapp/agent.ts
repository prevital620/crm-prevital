import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCommercialAgendaAvailability } from "@/lib/server/agenda-scheduling";

export type WhatsappAgentIntent =
  | "greeting"
  | "wants_info"
  | "wants_schedule"
  | "gives_name"
  | "gives_email"
  | "chooses_slot"
  | "asks_location"
  | "asks_price"
  | "asks_duration"
  | "asks_what_to_bring"
  | "gives_period_preference"
  | "gives_day_preference"
  | "rejects_slots"
  | "needs_human"
  | "unknown";

export type AgendaPeriod = "morning" | "afternoon";

export type WhatsappAgentLead = {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
};

export type OfferedAgendaSlot = {
  index: number;
  date: string;
  time: string;
  remaining: number;
};

export type WhatsappAgentContext = {
  period?: AgendaPeriod;
  preferredDate?: string;
  pendingDate?: string;
  lastOfferedPeriod?: AgendaPeriod;
  lastOfferedDate?: string;
};

export type ParsedDatePreference = {
  date: string;
  needsConfirmation: boolean;
  label: string;
};

const AGENT_CONTEXT_PREFIX = "WhatsApp IA contexto:";

export const PERIOD_QUESTION =
  "Claro 😊 ¿Te queda mejor en la mañana o en la tarde para coordinar tu experiencia en Prevital?";

const CLINICAL_SAFE_REPLY =
  "Esa información la revisa directamente nuestro equipo profesional durante la valoración 😊 Yo puedo ayudarte a agendar tu cita para que recibas orientación adecuada en Prevital.";

const INFO_TO_SCHEDULE_REPLY =
  "Con gusto te ayudamos 🌿 Para darte la información completa y coordinar tu experiencia en Prevital, primero necesitamos agendar tu valoración. ¿Te queda mejor en la mañana o en la tarde?";

const LOCATION_REPLY =
  "Estamos en Medellín 🌿 Al confirmar tu cita, nuestro equipo te compartirá la información completa para llegar. ¿Te queda mejor en la mañana o en la tarde?";

const PRICE_REPLY =
  "Esta experiencia no tiene costo para las personas seleccionadas 💚 ¿Te queda mejor en la mañana o en la tarde?";

const DURATION_REPLY =
  "La cita inicial suele tomar aproximadamente entre 30 y 45 minutos 😊 ¿Te queda mejor en la mañana o en la tarde?";

const WHAT_TO_BRING_REPLY =
  "Por ahora solo necesitamos coordinar tu cita 😊 Luego nuestro equipo te indicará cualquier recomendación necesaria. ¿Te queda mejor en la mañana o en la tarde?";

const DIRECT_REPLIES_WITHOUT_PERIOD_QUESTION: Partial<Record<WhatsappAgentIntent, string>> = {
  asks_location:
    "Estamos en Medellín 🌿 Al confirmar tu cita, nuestro equipo te compartirá la información completa para llegar.",
  asks_price:
    "Esta experiencia no tiene costo para las personas seleccionadas 💚",
  asks_duration:
    "La cita inicial suele tomar aproximadamente entre 30 y 45 minutos 😊",
  asks_what_to_bring:
    "Por ahora solo necesitamos coordinar tu cita 😊 Luego nuestro equipo te indicará cualquier recomendación necesaria.",
  wants_info:
    "Con gusto te ayudamos 🌿 En la valoración nuestro equipo te dará la información completa para coordinar tu experiencia en Prevital.",
  greeting:
    "Con gusto te ayudamos 🌿",
};

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

function looksLikeName(value: string) {
  const cleaned = value.trim();
  if (cleaned.length < 5 || cleaned.length > 80) return false;
  if (/[0-9@:/]/.test(cleaned)) return false;
  return cleaned.split(/\s+/).length >= 2;
}

export function analyzeWhatsappAgentIntent(message: string): WhatsappAgentIntent {
  const normalized = normalizeText(message);

  if (!normalized) return "unknown";
  if (looksLikeEmail(message)) return "gives_email";

  if (isSlotConfirmationMessage(message)) return "chooses_slot";

  if (
    hasAny(normalized, [
      "diagnostico",
      "diagnosticar",
      "medicamento",
      "medicamentos",
      "contraindicacion",
      "contraindicaciones",
      "embarazo",
      "embarazada",
      "hipertension",
      "diabetes",
      "enfermedad",
      "dolor",
      "riesgo",
      "resultado",
      "resultados",
      "cura",
      "curar",
      "sirve para",
      "puedo hacerme",
      "me recomienda",
    ])
  ) {
    return "needs_human";
  }

  if (isSlotRejectionMessage(message)) return "rejects_slots";
  if (detectPeriodPreference(message)) return "gives_period_preference";
  if (parseDatePreference(message)) return "gives_day_preference";

  if (hasAny(normalized, ["ubicacion", "direccion", "donde quedan", "donde estan", "sede"])) {
    return "asks_location";
  }

  if (hasAny(normalized, ["precio", "valor", "cuanto cuesta", "costo", "gratis", "pagar"])) {
    return "asks_price";
  }

  if (hasAny(normalized, ["cuanto tarda", "cuanto dura", "duracion", "demora", "tiempo"])) {
    return "asks_duration";
  }

  if (hasAny(normalized, ["que debo llevar", "que llevo", "llevar algo", "puedo ir con alguien", "acompanante"])) {
    return "asks_what_to_bring";
  }

  if (
    hasAny(normalized, [
      "agendar",
      "agenda",
      "cita",
      "horario",
      "disponible",
      "disponibilidad",
      "quiero ir",
      "separar",
      "programar",
    ])
  ) {
    return "wants_schedule";
  }

  if (
    hasAny(normalized, [
      "info",
      "informacion",
      "detox",
      "limpieza",
      "limpieza ionica",
      "que es",
      "como funciona",
      "beneficio",
      "beneficios",
    ])
  ) {
    return "wants_info";
  }

  if (/^(hola|buenos dias|buenas tardes|buenas noches|buenas|hey|hello)\b/.test(normalized)) {
    return "greeting";
  }

  if (looksLikeName(message)) return "gives_name";

  return "unknown";
}

function dateFromISO(date: string) {
  return new Date(`${date}T12:00:00-05:00`);
}

function addDaysISO(date: string, days: number) {
  const next = dateFromISO(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function todayBogota(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function monthNumber(month: string) {
  const normalized = normalizeText(month);
  const months: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    setiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
  };
  return months[normalized] || null;
}

function weekdayIndex(day: string) {
  const normalized = normalizeText(day);
  const weekdays: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };
  return weekdays[normalized] ?? null;
}

function formatISODate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function currentBogotaParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function formatSlotDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatSlotTime(time: string) {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour < 12 ? "a. m." : "p. m.";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${suffix}`;
}

export function detectPeriodPreference(message: string): AgendaPeriod | null {
  const normalized = normalizeText(message);
  if (hasAny(normalized, ["manana", "mañana", "temprano", "antes del medio dia", "antes de medio dia"])) {
    return "morning";
  }
  if (hasAny(normalized, ["tarde", "despues del medio dia", "despues de medio dia"])) {
    return "afternoon";
  }
  return null;
}

export function isPositiveConfirmation(message: string) {
  const normalized = normalizeText(message);
  return /^(si|sí|sii|dale|correcto|asi es|confirmo|ok|okay|listo)$/.test(normalized);
}

export function isSlotRejectionMessage(message: string) {
  const normalized = normalizeText(message);
  return hasAny(normalized, [
    "no puedo",
    "no me sirve",
    "otro dia",
    "otra fecha",
    "ese dia no",
    "esa hora no",
    "ninguno",
    "ninguna",
    "no a esa hora",
  ]);
}

export function isSlotConfirmationMessage(message: string) {
  const normalized = normalizeText(message);
  return (
    /^(1|2|3)$/.test(normalized) ||
    hasAny(normalized, [
      "primera",
      "primer horario",
      "segunda",
      "segundo",
      "tercera",
      "tercero",
      "esa me sirve",
      "ese me sirve",
      "me sirve",
      "confirmo",
    ]) ||
    /\b([01]?\d|2[0-3])(?::|\s*y\s*)[0-5]\d\b/.test(normalized) ||
    /\b(8|9|10|11|1|2|3|4|5)(:30|:00)?\s*(am|pm|a m|p m)?\b/.test(normalized)
  );
}

export function parseDatePreference(
  message: string,
  now = new Date()
): ParsedDatePreference | null {
  const normalized = normalizeText(message);
  const today = todayBogota(now);

  if (hasAny(normalized, ["pasado manana", "pasado mañana"])) {
    const date = addDaysISO(today, 2);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (/\bmanana\b/.test(normalized) || /\bmañana\b/.test(message.toLowerCase())) {
    const date = addDaysISO(today, 1);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (hasAny(normalized, ["otra semana", "la proxima semana", "proxima semana"])) {
    const date = addDaysISO(today, 7);
    return { date, needsConfirmation: true, label: formatSlotDate(date) };
  }

  const explicitDate = normalized.match(/\b(\d{1,2})(?:\s*de\s*([a-z]+))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const parts = currentBogotaParts(now);
    const month = explicitDate[2] ? monthNumber(explicitDate[2]) : parts.month;
    if (month && day >= 1 && day <= 31) {
      let year = parts.year;
      let date = formatISODate(year, month, day);
      if (date < today) {
        if (explicitDate[2]) {
          year += 1;
          date = formatISODate(year, month, day);
        } else {
          const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
          const nextMonthYear = parts.month === 12 ? parts.year + 1 : parts.year;
          date = formatISODate(nextMonthYear, nextMonth, day);
        }
      }
      return {
        date,
        needsConfirmation: !explicitDate[2],
        label: formatSlotDate(date),
      };
    }
  }

  const weekdayMatch = normalized.match(/\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/);
  if (weekdayMatch) {
    const target = weekdayIndex(weekdayMatch[1]);
    if (target === null) return null;

    const base = dateFromISO(today);
    const current = base.getUTCDay();
    const diff = (target - current + 7) % 7 || 7;
    const date = addDaysISO(today, diff);

    return {
      date,
      needsConfirmation: diff > 6,
      label: formatSlotDate(date),
    };
  }

  return null;
}

function periodMatches(time: string, period?: AgendaPeriod) {
  if (!period) return true;
  if (period === "morning") return time >= "08:00" && time < "12:00";
  return time >= "12:00" && time <= "17:30";
}

export function isFutureSlotAllowed(
  date: string,
  time: string,
  now = new Date(),
  minimumLeadMinutes = 60
) {
  const slotDate = new Date(`${date}T${time}:00-05:00`);
  return slotDate.getTime() >= now.getTime() + minimumLeadMinutes * 60 * 1000;
}

export async function getNextWhatsappAgendaSlots(options: {
  limit?: number;
  period?: AgendaPeriod;
  preferredDate?: string;
  now?: Date;
  maxDays?: number;
} = {}) {
  const limit = options.limit || 3;
  const maxDays = options.maxDays || 7;
  const now = options.now || new Date();
  const slots: OfferedAgendaSlot[] = [];
  const today = todayBogota(now);
  const startDate = options.preferredDate || addDaysISO(today, 1);

  for (let offset = 0; offset < maxDays && slots.length < limit; offset += 1) {
    const date = addDaysISO(startDate, offset);
    if (date < today) continue;

    const availability = await getCommercialAgendaAvailability({
      date,
      serviceType: "valoracion",
      onlyAvailable: true,
    });

    for (const slot of availability.slots) {
      if (slot.remaining <= 0) continue;
      if (!periodMatches(slot.time, options.period)) continue;
      if (!isFutureSlotAllowed(date, slot.time, now, 60)) continue;

      slots.push({
        index: slots.length + 1,
        date,
        time: slot.time,
        remaining: slot.remaining,
      });

      if (slots.length >= limit) break;
    }
  }

  return slots;
}

export function buildSlotsOfferMessage(slots: OfferedAgendaSlot[], period?: AgendaPeriod) {
  if (slots.length === 0) {
    return "En este momento no veo cupos disponibles para esa jornada. Dejo tu caso para que nuestro equipo te ayude personalmente 😊";
  }

  const periodLabel = period === "afternoon" ? "tarde" : "mañana";
  const lines = slots.map(
    (slot) =>
      `${slot.index}. ${formatSlotDate(slot.date)} ${formatSlotTime(slot.time)}`
  );

  return `Perfecto 💚 Tenemos estas opciones en la ${periodLabel}:\n\n${lines.join(
    "\n"
  )}\n\n¿Cuál prefieres?`;
}

export function buildSlotsReminderMessage(slots: OfferedAgendaSlot[], period: AgendaPeriod) {
  if (slots.length === 0) {
    return "En este momento no veo cupos disponibles para esa jornada. Dejo tu caso para que nuestro equipo te ayude personalmente 😊";
  }

  const periodLabel = period === "afternoon" ? "tarde" : "mañana";
  const lines = slots.map(
    (slot) =>
      `${slot.index}. ${formatSlotDate(slot.date)} ${formatSlotTime(slot.time)}`
  );

  return `Como me indicaste que te queda mejor en la ${periodLabel}, te comparto nuevamente opciones disponibles:\n\n${lines.join(
    "\n"
  )}\n\n¿Cuál prefieres?`;
}

export function pickOfferedSlot(message: string, slots: OfferedAgendaSlot[]) {
  const normalized = normalizeText(message);

  if (hasAny(normalized, ["esa me sirve", "ese me sirve", "me sirve"])) {
    return slots[0] || null;
  }

  const numberMatch = normalized.match(/^(1|2|3)$/);
  const index = numberMatch
    ? Number(numberMatch[1])
    : hasAny(normalized, ["primera", "primer horario"])
      ? 1
      : hasAny(normalized, ["segunda", "segundo"])
        ? 2
        : hasAny(normalized, ["tercera", "tercero"])
          ? 3
          : null;

  if (index) return slots.find((slot) => slot.index === index) || null;

  const timeMatch = normalized.match(/\b([01]?\d|2[0-3])(?::|\s*y\s*)?([0-5]\d)?\b/);
  if (!timeMatch) return null;

  const rawHour = Number(timeMatch[1]);
  const minute = timeMatch[2] || "00";
  const hasPm = /\b(pm|p m|tarde)\b/.test(normalized);
  const hour = hasPm && rawHour < 12 ? rawHour + 12 : rawHour;
  const selectedTime = `${String(hour).padStart(2, "0")}:${minute}`;

  const dateAndTimeMatch = slots.find((slot) => {
    const slotDateLabel = normalizeText(formatSlotDate(slot.date));
    const weekday = slotDateLabel.split(",")[0].split(" ")[0].trim();
    return Boolean(
      slot.time === selectedTime && weekday && normalized.includes(weekday)
    );
  });

  return dateAndTimeMatch || slots.find((slot) => slot.time === selectedTime) || null;
}

export function readWhatsappAgentContext(notes: string | null | undefined): WhatsappAgentContext {
  if (!notes) return {};
  const contextLine = notes
    .split("\n")
    .reverse()
    .find((line) => line.startsWith(AGENT_CONTEXT_PREFIX));
  if (!contextLine) return {};

  try {
    return JSON.parse(contextLine.slice(AGENT_CONTEXT_PREFIX.length).trim()) as WhatsappAgentContext;
  } catch {
    return {};
  }
}

export function writeWhatsappAgentContext(
  notes: string | null | undefined,
  context: WhatsappAgentContext
) {
  const preserved = (notes || "")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith(AGENT_CONTEXT_PREFIX));
  return [...preserved, `${AGENT_CONTEXT_PREFIX} ${JSON.stringify(context)}`].join("\n");
}

export function isWhatsappAgentBookingEnabled() {
  return String(process.env.WHATSAPP_AGENT_ENABLE_BOOKING || "")
    .trim()
    .toLowerCase() === "true";
}

export async function createWhatsappAgentAppointment(params: {
  lead: WhatsappAgentLead;
  slot: OfferedAgendaSlot;
}) {
  const availability = await getCommercialAgendaAvailability({
    date: params.slot.date,
    serviceType: "valoracion",
  });
  const selectedSlot = availability.slots.find((slot) => slot.time === params.slot.time);

  if (
    !selectedSlot ||
    !selectedSlot.available ||
    selectedSlot.remaining <= 0 ||
    !isFutureSlotAllowed(params.slot.date, params.slot.time)
  ) {
    return {
      ok: false as const,
      error:
        "Ese horario ya no tiene cupo disponible. Revisemos otros horarios para tu valoración 😊",
    };
  }

  const notes = [
    "Cita agendada desde WhatsApp IA",
    `WhatsApp lead ID: ${params.lead.id}`,
    params.lead.email ? `Correo: ${params.lead.email}` : "",
    `Auditoria: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert([
      {
        lead_id: null,
        patient_name: params.lead.full_name || "Lead WhatsApp",
        phone: params.lead.phone,
        appointment_date: params.slot.date,
        appointment_time: params.slot.time,
        status: "agendada",
        service_type: "valoracion",
        specialist_user_id: null,
        notes,
        created_by_user_id: null,
        updated_by_user_id: null,
      },
    ])
    .select("id")
    .single();

  if (error) throw error;

  await supabaseAdmin
    .from("whatsapp_leads")
    .update({ status: "agendado", priority: "normal", updated_at: new Date().toISOString() })
    .eq("id", params.lead.id);

  return {
    ok: true as const,
    appointmentId: data?.id as string | undefined,
  };
}

export function replyForIntent(intent: WhatsappAgentIntent) {
  if (intent === "needs_human") return CLINICAL_SAFE_REPLY;
  if (intent === "asks_location") return LOCATION_REPLY;
  if (intent === "asks_price") return PRICE_REPLY;
  if (intent === "asks_duration") return DURATION_REPLY;
  if (intent === "asks_what_to_bring") return WHAT_TO_BRING_REPLY;
  if (intent === "wants_info" || intent === "greeting") return INFO_TO_SCHEDULE_REPLY;
  return null;
}

export function replyForIntentWithKnownPeriod(intent: WhatsappAgentIntent) {
  if (intent === "needs_human") return CLINICAL_SAFE_REPLY;
  return DIRECT_REPLIES_WITHOUT_PERIOD_QUESTION[intent] || null;
}
