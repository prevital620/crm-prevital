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
  | "needs_human"
  | "unknown";

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

const CLINICAL_SAFE_REPLY =
  "Esa información la revisa directamente nuestro equipo profesional durante la valoración 😊 Yo puedo ayudarte a agendar tu cita para que recibas orientación adecuada en Prevital.";

const INFO_TO_SCHEDULE_REPLY =
  "Con gusto te ayudamos \ud83c\udf3f Para darte la informacion completa y coordinar tu experiencia en Prevital, primero necesitamos agendar tu valoracion. \u00bfTe gustaria que revisemos horarios disponibles?";

const LOCATION_REPLY =
  "Estamos en Prevital y nuestro equipo te dara todos los detalles para llegar cuando confirmemos tu cita \ud83c\udf3f \u00bfQuieres que revisemos horarios disponibles para tu valoracion?";

const PRICE_REPLY =
  "Te ayudamos con esa informacion en la valoracion, donde el equipo revisa tu caso y te orienta correctamente \ud83d\ude0a \u00bfRevisamos horarios disponibles?";

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

  if (
    /^(1|2|3)$/.test(normalized) ||
    hasAny(normalized, ["primera", "primer horario", "segunda", "segundo", "tercera", "tercero"]) ||
    /\b([01]?\d|2[0-3])(?::|\s*y\s*)[0-5]\d\b/.test(normalized) ||
    /\b(8|9|10|11|1|2|3|4|5)(:30|:00)?\s*(am|pm|a m|p m)?\b/.test(normalized)
  ) {
    return "chooses_slot";
  }

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

  if (hasAny(normalized, ["ubicacion", "direccion", "donde quedan", "donde estan", "sede"])) {
    return "asks_location";
  }

  if (hasAny(normalized, ["precio", "valor", "cuanto cuesta", "costo", "gratis", "pagar"])) {
    return "asks_price";
  }

  if (
    hasAny(normalized, [
      "agendar",
      "agenda",
      "cita",
      "horario",
      "disponible",
      "disponibilidad",
      "cuando",
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

function addDaysISO(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

function todayBogota() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
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

export async function getNextWhatsappAgendaSlots(limit = 3) {
  const slots: OfferedAgendaSlot[] = [];
  const base = new Date(`${todayBogota()}T12:00:00`);

  for (let offset = 0; offset < 21 && slots.length < limit; offset += 1) {
    const date = addDaysISO(base, offset);
    const availability = await getCommercialAgendaAvailability({
      date,
      serviceType: "valoracion",
      onlyAvailable: true,
    });

    for (const slot of availability.slots) {
      if (slot.remaining <= 0) continue;

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

export function buildSlotsOfferMessage(slots: OfferedAgendaSlot[]) {
  if (slots.length === 0) {
    return "En este momento no veo cupos disponibles para agendar por WhatsApp. Dejo tu caso para que nuestro equipo te ayude personalmente \ud83d\ude0a";
  }

  const lines = slots.map(
    (slot) =>
      `${slot.index}. ${formatSlotDate(slot.date)} ${formatSlotTime(slot.time)}`
  );

  return `Tenemos disponibilidad para valoracion en estos horarios:\n${lines.join(
    "\n"
  )}\n\n\u00bfCual prefieres?`;
}

export function pickOfferedSlot(message: string, slots: OfferedAgendaSlot[]) {
  const normalized = normalizeText(message);
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

  return slots.find((slot) => slot.time === selectedTime) || null;
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

  if (!selectedSlot || !selectedSlot.available || selectedSlot.remaining <= 0) {
    return {
      ok: false as const,
      error:
        "Ese horario ya no tiene cupo disponible. Revisemos otros horarios para tu valoracion \ud83d\ude0a",
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
  if (intent === "wants_info" || intent === "greeting") return INFO_TO_SCHEDULE_REPLY;
  return null;
}
