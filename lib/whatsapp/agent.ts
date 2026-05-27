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
  | "asks_companion"
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

type WhatsappAppointmentCreateResult =
  | {
      ok: true;
      appointmentId?: string;
    }
  | {
      ok: false;
      error: string;
      reason: "slot_unavailable" | "duplicate" | "insert_failed";
    };

export type WhatsappAgentContext = {
  period?: AgendaPeriod;
  preferredDate?: string;
  pendingDate?: string;
  pendingPeriod?: AgendaPeriod;
  pendingSlotDate?: string;
  pendingSlotTime?: string;
  pendingAction?: "confirm_date_for_schedule" | "confirm_slot_for_booking";
  lastOfferedPeriod?: AgendaPeriod;
  lastOfferedDate?: string;
};

export type ParsedDatePreference = {
  date: string;
  needsConfirmation: boolean;
  label: string;
};

export type ParsedTimePreference =
  | {
      type: "any" | "earliest";
    }
  | {
      type: "after" | "exact";
      time: string;
    };

const AGENT_CONTEXT_PREFIX = "WhatsApp IA contexto:";
const ACTIVE_APPOINTMENT_STATUSES = [
  "agendada",
  "confirmada",
  "en_espera",
  "reagendada",
  "en_atencion",
];
const DUPLICATE_APPOINTMENT_REPLY =
  "Ya tienes una cita registrada en Prevital 💚 Nuestro equipo revisará tu caso y te ayudará si necesitas cambiarla.";
const APPOINTMENT_INSERT_ERROR_REPLY =
  "Gracias por tu paciencia 💚 Tuvimos un inconveniente al confirmar la cita automáticamente. Nuestro equipo revisará tu caso y te contactará para ayudarte a finalizar la agenda.";

export const PERIOD_QUESTION =
  "Claro 😊 ¿Te queda mejor en la mañana o en la tarde?";

export const MORNING_TIME_QUESTION =
  "Perfecto 💚 ¿Qué horario te queda mejor entre 8:30 a. m. y 12:30 p. m.?";

export const AFTERNOON_TIME_QUESTION =
  "Perfecto 💚 ¿Qué horario te queda mejor entre 12:30 p. m. y 5:30 p. m.?";

const CLINICAL_SAFE_REPLY =
  "Esa información la revisa directamente nuestro equipo profesional durante la cita 😊 Yo puedo ayudarte a coordinar el horario para que recibas orientación adecuada en Prevital.";

const INFO_TO_SCHEDULE_REPLY =
  "Con gusto te ayudamos 🌿 Para darte la información completa y coordinar tu experiencia en Prevital, primero necesitamos agendar tu valoración. ¿Te queda mejor en la mañana o en la tarde?";

const LOCATION_REPLY =
  "Estamos en El Poblado, Medellín 🌿 Cuando confirmemos tu cita te compartiremos la dirección completa e instrucciones para llegar.\n\n¿Te queda mejor en la mañana o en la tarde para coordinar tu cita?";

const PRICE_REPLY =
  "Esta experiencia no tiene costo para las personas seleccionadas 💚 Te ayudo a coordinar tu cita en Prevital.\n\n¿Te queda mejor en la mañana o en la tarde para coordinar tu cita?";

const DURATION_REPLY =
  "La cita inicial tiene una duración aproximada de 30 minutos 😊\n\n¿Te queda mejor en la mañana o en la tarde para coordinar tu cita?";

const COMPANION_REPLY =
  "Puedes venir acompañado/a si lo deseas 😊 Lo importante es que la cita quede a tu nombre y llegues con tu cédula original.\n\n¿Te queda mejor en la mañana o en la tarde para coordinar tu cita?";

const WHAT_TO_BRING_REPLY =
  "Para la cita es importante traer tu cédula original. Al confirmar la cita te enviaremos las instrucciones completas 🌿\n\n¿Te queda mejor en la mañana o en la tarde para coordinar tu cita?";

const DIRECT_REPLIES_WITHOUT_PERIOD_QUESTION: Partial<Record<WhatsappAgentIntent, string>> = {
  asks_location:
    "Estamos en El Poblado, Medellín 🌿 Cuando confirmemos tu cita te compartiremos la dirección completa e instrucciones para llegar.",
  asks_price:
    "Esta experiencia no tiene costo para las personas seleccionadas 💚",
  asks_duration:
    "La cita inicial tiene una duración aproximada de 30 minutos 😊",
  asks_companion:
    "Puedes venir acompañado/a si lo deseas 😊 Lo importante es que la cita quede a tu nombre y llegues con tu cédula original.",
  asks_what_to_bring:
    "Para la cita es importante traer tu cédula original. Al confirmar la cita te enviaremos las instrucciones completas 🌿",
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
      "presion",
      "tension",
      "tratamiento",
      "tratamientos",
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

  if (hasAny(normalized, ["acompanante", "pareja", "hermana", "hermano", "mama", "papa", "familiar", "puedo ir con alguien"])) {
    return "asks_companion";
  }

  if (hasAny(normalized, ["que debo llevar", "que llevo", "llevar algo", "cedula", "documento"])) {
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
  if (hasAny(normalized, ["manana", "temprano", "antes del medio dia", "antes de medio dia"])) {
    return "morning";
  }
  if (hasAny(normalized, ["tarde", "despues del medio dia", "despues de medio dia"])) {
    return "afternoon";
  }
  return null;
}

export function isPositiveConfirmation(message: string) {
  const normalized = normalizeText(message);
  return /^(si|sii|si correcto|correcto|asi es|exacto|ese|esa|ese mismo|esa misma|claro|dale|ok|okay|listo|confirmo|me sirve|esa me sirve|ese me sirve)$/.test(normalized);
}

export function isNegativeDateConfirmation(message: string) {
  const normalized = normalizeText(message);
  return (
    /^(no|no ese|otro|otro dia)$/.test(normalized) ||
    hasAny(normalized, ["no el otro", "otro martes", "me referia a otro"])
  );
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
  const mentionsAfternoon = hasAny(normalized, ["tarde", "despues del medio dia", "despues de medio dia"]);
  const asksAlternativeWeekday = /\bo\s+el\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(normalized);
  const morningOnlyPhrases = [
    "en la manana",
    "por la manana",
    "de la manana",
    "en manana",
    "por manana",
  ];
  const dateNormalized =
    !mentionsAfternoon && hasAny(normalized, morningOnlyPhrases)
      ? normalized.replace(/\bmanana\b/g, "")
      : normalized;

  if (hasAny(normalized, ["pasado manana"])) {
    const date = addDaysISO(today, 2);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (/\bmanana\b/.test(normalized)) {
    const date = addDaysISO(today, 1);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (hasAny(normalized, ["otra semana", "la proxima semana", "proxima semana"])) {
    const date = addDaysISO(today, 7);
    return { date, needsConfirmation: true, label: formatSlotDate(date) };
  }

  const weekdayMatch = normalized.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (weekdayMatch) {
    const target = weekdayIndex(weekdayMatch[1]);
    if (target === null) return null;

    const base = dateFromISO(today);
    const current = base.getUTCDay();
    const diff = (target - current + 7) % 7 || 7;
    const date = addDaysISO(today, diff);

    return {
      date,
      needsConfirmation: diff > 6 || asksAlternativeWeekday,
      label: formatSlotDate(date),
    };
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

  return null;
}

export function parseSpecificDatePreference(
  message: string,
  now = new Date()
): ParsedDatePreference | null {
  const normalized = normalizeText(message);
  const today = todayBogota(now);
  const mentionsAfternoon = hasAny(normalized, ["tarde", "despues del medio dia", "despues de medio dia"]);
  const asksAlternativeWeekday = /\bo\s+el\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(normalized);
  const morningOnlyPhrases = [
    "en la manana",
    "por la manana",
    "de la manana",
    "en manana",
    "por manana",
  ];

  if (hasAny(normalized, ["pasado manana"])) {
    const date = addDaysISO(today, 2);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (
    /\bmanana\b/.test(normalized) &&
    (mentionsAfternoon || !hasAny(normalized, morningOnlyPhrases))
  ) {
    const date = addDaysISO(today, 1);
    return { date, needsConfirmation: false, label: formatSlotDate(date) };
  }

  if (hasAny(normalized, ["otra semana", "la proxima semana", "proxima semana"])) {
    const date = addDaysISO(today, 7);
    return { date, needsConfirmation: true, label: formatSlotDate(date) };
  }

  const weekdayMatch = normalized.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (weekdayMatch) {
    const target = weekdayIndex(weekdayMatch[1]);
    if (target === null) return null;

    const base = dateFromISO(today);
    const current = base.getUTCDay();
    const diff = (target - current + 7) % 7 || 7;
    const date = addDaysISO(today, diff);

    return {
      date,
      needsConfirmation: diff > 6 || asksAlternativeWeekday,
      label: formatSlotDate(date),
    };
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

  return null;
}

function periodMatches(time: string, period?: AgendaPeriod) {
  if (!period) return true;
  if (period === "morning") return time >= "08:30" && time <= "12:30";
  return time >= "12:30" && time <= "17:30";
}

export function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeRequestedHour(hour: number, period?: AgendaPeriod, meridiem?: string) {
  const normalizedMeridiem = meridiem ? normalizeText(meridiem).replace(/\s+/g, "") : "";

  if (normalizedMeridiem === "pm" && hour < 12) return hour + 12;
  if (normalizedMeridiem === "am" && hour === 12) return 0;

  if (!normalizedMeridiem && period === "afternoon" && hour >= 1 && hour <= 7) {
    return hour + 12;
  }

  if (!normalizedMeridiem && !period && hour >= 1 && hour <= 5) {
    return hour + 12;
  }

  return hour;
}

export function parseTimePreference(
  message: string,
  period?: AgendaPeriod
): ParsedTimePreference | null {
  const normalized = normalizeText(message);

  if (
    hasAny(normalized, [
      "cualquier hora",
      "cualquiera",
      "la que haya",
      "lo que haya",
      "la que tengas",
      "el que haya",
    ])
  ) {
    return { type: "any" };
  }

  if (hasAny(normalized, ["la mas temprano", "lo mas temprano", "la primera", "temprano"])) {
    return { type: "earliest" };
  }

  const afterMatch = normalized.match(
    /\b(?:despues|luego|posterior|mas tarde)\s+(?:de\s+)?(?:las\s+)?(\d{1,2})(?::([0-5]\d))?\s*(a\s*m|p\s*m|am|pm)?\b/
  );
  if (afterMatch) {
    const hour = normalizeRequestedHour(Number(afterMatch[1]), period, afterMatch[3]);
    const minute = afterMatch[2] ? Number(afterMatch[2]) : 0;
    return { type: "after", time: minutesToTime(hour * 60 + minute) };
  }

  const exactMatch = normalized.match(
    /(?:\ba\s+las\s+|\blas\s+|\b)(\d{1,2})(?::([0-5]\d))?\s*(a\s*m|p\s*m|am|pm)?\b/
  );
  if (!exactMatch) return null;

  const rawHour = Number(exactMatch[1]);
  if (rawHour > 23) return null;

  const hour = normalizeRequestedHour(rawHour, period, exactMatch[3]);
  const minute = exactMatch[2] ? Number(exactMatch[2]) : 0;
  const time = minutesToTime(hour * 60 + minute);

  if (!periodMatches(time, period)) return null;
  return { type: "exact", time };
}

export function inferPeriodFromTime(time: string): AgendaPeriod | null {
  if (periodMatches(time, "afternoon")) return "afternoon";
  if (periodMatches(time, "morning")) return "morning";
  return null;
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
  exactDateOnly?: boolean;
  minTime?: string;
  targetTime?: string;
} = {}) {
  const limit = options.limit || 3;
  const maxDays = options.exactDateOnly ? 1 : options.maxDays || 7;
  const now = options.now || new Date();
  const slots: OfferedAgendaSlot[] = [];
  const today = todayBogota(now);
  const startDate = options.preferredDate || addDaysISO(today, 1);
  const shouldRankByTarget = Boolean(options.targetTime);

  for (
    let offset = 0;
    offset < maxDays && (shouldRankByTarget || slots.length < limit);
    offset += 1
  ) {
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
      if (options.minTime && slot.time < options.minTime) continue;
      if (!isFutureSlotAllowed(date, slot.time, now, 60)) continue;

      slots.push({
        index: slots.length + 1,
        date,
        time: slot.time,
        remaining: slot.remaining,
      });

      if (!shouldRankByTarget && slots.length >= limit) break;
    }
  }

  const rankedSlots = shouldRankByTarget
    ? [...slots].sort((left, right) => {
        const leftDistance = Math.abs(timeToMinutes(left.time) - timeToMinutes(options.targetTime!));
        const rightDistance = Math.abs(timeToMinutes(right.time) - timeToMinutes(options.targetTime!));
        return (
          leftDistance - rightDistance ||
          left.date.localeCompare(right.date) ||
          left.time.localeCompare(right.time)
        );
      })
    : slots;

  return rankedSlots.slice(0, limit).map((slot, index) => ({
    ...slot,
    index: index + 1,
  }));
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

export function buildSlotsOptionsMessage(slots: OfferedAgendaSlot[]) {
  if (slots.length === 0) {
    return "En este momento no veo cupos disponibles para esa jornada. Dejo tu caso para que nuestro equipo te ayude personalmente 😊";
  }

  const lines = slots.map(
    (slot) =>
      `${slot.index}. ${formatSlotDate(slot.date)} ${formatSlotTime(slot.time)}`
  );

  return `${lines.join("\n")}\n\n¿Cuál prefieres?`;
}

export function buildPeriodTimeQuestion(period: AgendaPeriod) {
  return period === "afternoon" ? AFTERNOON_TIME_QUESTION : MORNING_TIME_QUESTION;
}

export function buildExactSlotAvailableMessage(slot: OfferedAgendaSlot) {
  return `Sí 💚 Tenemos disponible ${formatSlotDate(slot.date)} a las ${formatSlotTime(slot.time)}. ¿Quieres que te la separe?`;
}

export function buildExactSlotUnavailableIntro(date: string, time: string) {
  return `Para ${formatSlotDate(date)} a las ${formatSlotTime(time)} no veo cupo disponible por ahora 😊 Te comparto opciones cercanas en esa misma jornada:`;
}

export function buildSingleNearbySlotMessage(requestedTime: string, slot: OfferedAgendaSlot) {
  return `Para ${formatSlotTime(requestedTime)} no veo cupo disponible por ahora 😊 Pero tengo disponibilidad a las ${formatSlotTime(slot.time)} ¿Te sirve?`;
}

export function buildMultipleNearbySlotsMessage(requestedTime: string, slots: OfferedAgendaSlot[]) {
  const lines = slots.map(
    (slot) =>
      `${slot.index}. ${formatSlotDate(slot.date)} ${formatSlotTime(slot.time)}`
  );

  return `Para ${formatSlotTime(requestedTime)} no veo cupo disponible por ahora 😊 Tengo estas opciones cercanas:\n\n${lines.join(
    "\n"
  )}\n\n¿Cuál te sirve?`;
}

export function buildNoNearbySlotsMessage() {
  return "Para ese horario no veo cupos disponibles por ahora 😊 ¿Quieres que revise otro horario o prefieres otro día?";
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

function phoneCandidates(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  const withoutCountry = digits.startsWith("57") ? digits.slice(2) : digits;
  const withCountry = withoutCountry ? `57${withoutCountry}` : "";
  const candidates = [
    value.trim(),
    digits,
    withoutCountry,
    withCountry,
    withCountry ? `+${withCountry}` : "",
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function findRelatedLeadId(phone: string) {
  const candidates = phoneCandidates(phone);

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .in("phone", candidates)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id || null;
}

async function findActiveAppointment(params: {
  phone: string;
  leadId: string | null;
  whatsappLeadId: string;
}) {
  const candidates = phoneCandidates(params.phone);

  const phoneResult = await supabaseAdmin
    .from("appointments")
    .select("id, lead_id, phone, appointment_date, appointment_time, status")
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .in("phone", candidates)
    .limit(1);

  if (phoneResult.error) throw phoneResult.error;
  if (phoneResult.data?.[0]) return phoneResult.data[0];

  if (params.leadId) {
    const leadResult = await supabaseAdmin
      .from("appointments")
      .select("id, lead_id, phone, appointment_date, appointment_time, status")
      .in("status", ACTIVE_APPOINTMENT_STATUSES)
      .eq("lead_id", params.leadId)
      .limit(1);

    if (leadResult.error) throw leadResult.error;
    if (leadResult.data?.[0]) return leadResult.data[0];
  }

  const whatsappLeadResult = await supabaseAdmin
    .from("appointments")
    .select("id, lead_id, phone, appointment_date, appointment_time, status")
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .ilike("notes", `%WhatsApp lead ID: ${params.whatsappLeadId}%`)
    .limit(1);

  if (whatsappLeadResult.error) throw whatsappLeadResult.error;
  return whatsappLeadResult.data?.[0] || null;
}

async function markWhatsappLeadAgendado(id: string) {
  await supabaseAdmin
    .from("whatsapp_leads")
    .update({ status: "agendado", priority: "normal", updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function markWhatsappLeadRequiresHuman(id: string) {
  await supabaseAdmin
    .from("whatsapp_leads")
    .update({ status: "requiere_humano", priority: "alta", updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function markWhatsappLeadWaitingConfirmation(id: string) {
  await supabaseAdmin
    .from("whatsapp_leads")
    .update({
      status: "esperando_confirmacion_horario",
      priority: "alta",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function claimWhatsappLeadForBooking(id: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_leads")
    .update({
      status: "en_gestion_callcenter",
      priority: "alta",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", [
      "pendiente_agendar",
      "ofreciendo_horarios",
      "esperando_preferencia_jornada",
      "esperando_dia_preferido",
      "esperando_confirmacion_horario",
      "felicitacion_enviada",
      "respondio_para_agendar",
    ])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function createWhatsappAgentAppointment(params: {
  lead: WhatsappAgentLead;
  slot: OfferedAgendaSlot;
}): Promise<WhatsappAppointmentCreateResult> {
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
      reason: "slot_unavailable",
      error:
        "Ese horario ya no tiene cupo disponible. Revisemos otros horarios para tu valoración 😊",
    };
  }

  const claimed = await claimWhatsappLeadForBooking(params.lead.id);
  if (!claimed) {
    return {
      ok: false as const,
      reason: "duplicate",
      error: DUPLICATE_APPOINTMENT_REPLY,
    };
  }

  let leadId: string | null = null;
  try {
    leadId = await findRelatedLeadId(params.lead.phone);

    const activeAppointment = await findActiveAppointment({
      phone: params.lead.phone,
      leadId,
      whatsappLeadId: params.lead.id,
    });

    if (activeAppointment) {
      await markWhatsappLeadAgendado(params.lead.id);
      return {
        ok: false as const,
        reason: "duplicate",
        error: DUPLICATE_APPOINTMENT_REPLY,
      };
    }
  } catch (error) {
    console.error("[whatsapp-agent] Could not verify active appointment before booking.", {
      whatsappLeadId: params.lead.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await markWhatsappLeadRequiresHuman(params.lead.id);
    return {
      ok: false as const,
      reason: "insert_failed",
      error: APPOINTMENT_INSERT_ERROR_REPLY,
    };
  }

  const freshAvailability = await getCommercialAgendaAvailability({
    date: params.slot.date,
    serviceType: "valoracion",
  });
  const freshSlot = freshAvailability.slots.find((slot) => slot.time === params.slot.time);

  if (
    !freshSlot ||
    !freshSlot.available ||
    freshSlot.remaining <= 0 ||
    !isFutureSlotAllowed(params.slot.date, params.slot.time)
  ) {
    await markWhatsappLeadWaitingConfirmation(params.lead.id);
    return {
      ok: false as const,
      reason: "slot_unavailable",
      error:
        "Ese horario ya no tiene cupo disponible. Revisemos otros horarios para tu valoración 😊",
    };
  }

  const notes = [
    leadId
      ? "Cita agendada desde WhatsApp IA"
      : "Cita agendada desde WhatsApp IA sin lead CRM relacionado",
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
        lead_id: leadId,
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

  if (error) {
    console.error("[whatsapp-agent] Could not create appointment.", {
      whatsappLeadId: params.lead.id,
      code: error.code,
      error: error.message,
    });
    await markWhatsappLeadRequiresHuman(params.lead.id);
    return {
      ok: false as const,
      reason: "insert_failed",
      error: APPOINTMENT_INSERT_ERROR_REPLY,
    };
  }

  await markWhatsappLeadAgendado(params.lead.id);

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
  if (intent === "asks_companion") return COMPANION_REPLY;
  if (intent === "asks_what_to_bring") return WHAT_TO_BRING_REPLY;
  if (intent === "wants_info" || intent === "greeting") return INFO_TO_SCHEDULE_REPLY;
  return null;
}

export function replyForIntentWithKnownPeriod(intent: WhatsappAgentIntent) {
  if (intent === "needs_human") return CLINICAL_SAFE_REPLY;
  return DIRECT_REPLIES_WITHOUT_PERIOD_QUESTION[intent] || null;
}

export function buildWhatsappAppointmentConfirmation(params: {
  name: string | null | undefined;
  date: string;
  time: string;
}) {
  const displayName = params.name?.trim() || "Prevital";

  return `*Hola, ${displayName}* 💚

Tu cita gratuita en *Prevital* ha sido confirmada.

📅 *Fecha:* ${formatSlotDate(params.date)}
🕐 *Hora:* ${formatSlotTime(params.time)}

*Muy importante presentar:*
✔️ Cédula original
✔️ Disponibilidad aproximada de 30 minutos para tu orientación inicial
✔️ Código de consulta gratis: *BD 0803*

📍 *Dirección:*
*Av. El Poblado*
*Edificio Caja Social*
Carrera 43A # 1 - 71, Piso 2
Frente a San Fernando Plaza, Medellín.

📲 *Instagram:*
https://www.instagram.com/prevital_col

Gracias por priorizar tu bienestar 🌿
Te esperamos en Prevital.`;
}

