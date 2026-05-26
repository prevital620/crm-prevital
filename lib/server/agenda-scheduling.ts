import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildSlotAvailability,
  countBookingsForSlot,
} from "@/lib/agenda/agendaAvailability";
import { getSectionForService } from "@/lib/agenda/agendaSections";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_CAPACITY,
  DEFAULT_SLOT_CAPACITY,
} from "@/lib/agenda/agendaDurations";

export type AgendaAvailabilitySlot = {
  time: string;
  available: boolean;
  capacity: number;
  used: number;
  remaining: number;
};

type AppointmentForAvailability = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
};

type AgendaSlotSetting = {
  agenda_date: string;
  slot_time: string;
  capacity: number | null;
  is_blocked: boolean;
};

const COMMERCIAL_WEEKDAY_TIMES = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
];

const COMMERCIAL_SATURDAY_TIMES = COMMERCIAL_WEEKDAY_TIMES.filter(
  (time) => time <= "15:00"
);

function normalizeTime(value: string | null | undefined) {
  return String(value || "").slice(0, 5);
}

function buildSlotSettingsMap(rows: AgendaSlotSetting[]) {
  const map: Record<string, AgendaSlotSetting> = {};

  rows.forEach((item) => {
    const slotTime = normalizeTime(item.slot_time);
    map[`${item.agenda_date}_${slotTime}`] = {
      ...item,
      slot_time: slotTime,
    };
  });

  return map;
}

export function normalizeAgendaDate(value: unknown) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function normalizeAgendaTime(value: unknown) {
  const normalized = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
}

export function normalizeCommercialServiceType(value: unknown) {
  const normalized = String(value || "valoracion").trim().toLowerCase();
  return normalized || "valoracion";
}

function parseISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(year: number, month: number, day: number, days: number) {
  const date = new Date(year, month - 1, day + days);
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function nextMonday(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const daysToAdd = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
  return addDays(year, month, day, daysToAdd);
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { year, month, day };
}

function getColombiaHolidayKeys(year: number) {
  const easter = easterSunday(year);

  return new Set([
    dateKey(year, 1, 1),
    nextMonday(year, 1, 6),
    nextMonday(year, 3, 19),
    addDays(easter.year, easter.month, easter.day, -3),
    addDays(easter.year, easter.month, easter.day, -2),
    dateKey(year, 5, 1),
    addDays(easter.year, easter.month, easter.day, 43),
    addDays(easter.year, easter.month, easter.day, 64),
    addDays(easter.year, easter.month, easter.day, 71),
    nextMonday(year, 6, 29),
    dateKey(year, 7, 20),
    dateKey(year, 8, 7),
    nextMonday(year, 8, 15),
    nextMonday(year, 10, 12),
    nextMonday(year, 11, 1),
    nextMonday(year, 11, 11),
    dateKey(year, 12, 8),
    dateKey(year, 12, 25),
  ]);
}

function getCommercialAgendaTimes(isoDate: string) {
  const parsed = parseISODate(isoDate);
  if (!parsed) return [];

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0) return [];
  if (getColombiaHolidayKeys(parsed.year).has(isoDate)) return [];
  if (dayOfWeek === 6) return COMMERCIAL_SATURDAY_TIMES;

  return COMMERCIAL_WEEKDAY_TIMES;
}

export async function getCommercialAgendaAvailability(params: {
  date: string;
  serviceType?: string;
  editingAppointmentId?: string | null;
  onlyAvailable?: boolean;
}) {
  const serviceType = normalizeCommercialServiceType(params.serviceType);

  const [appointmentsResult, daySettingsResult, slotSettingsResult] =
    await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select("id, appointment_date, appointment_time, status, service_type, notes")
        .eq("appointment_date", params.date)
        .order("appointment_time", { ascending: true }),
      supabaseAdmin
        .from("agenda_day_settings")
        .select("agenda_date, daily_capacity, is_closed")
        .eq("agenda_date", params.date)
        .maybeSingle(),
      supabaseAdmin
        .from("agenda_slot_settings")
        .select("agenda_date, slot_time, capacity, is_blocked")
        .eq("agenda_date", params.date),
    ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (daySettingsResult.error) throw daySettingsResult.error;
  if (slotSettingsResult.error) throw slotSettingsResult.error;

  const appointments = ((appointmentsResult.data || []) as AppointmentForAvailability[])
    .map((item) => ({
      ...item,
      appointment_time: normalizeTime(item.appointment_time),
    }));
  const daySetting = daySettingsResult.data as
    | { daily_capacity: number | null; is_closed: boolean | null }
    | null;
  const selectedDateActiveTotal = appointments.filter((item) =>
    ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
  ).length;

  const availability = buildSlotAvailability({
    appointments,
    section: "agenda",
    serviceType,
    appointmentDate: params.date,
    durationMinutes: 30,
    slotSettings: buildSlotSettingsMap((slotSettingsResult.data || []) as AgendaSlotSetting[]),
    selectedDateClosed: Boolean(daySetting?.is_closed),
    selectedDateDailyCapacity: daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY,
    selectedDateActiveTotal,
    editingAppointmentId: params.editingAppointmentId || null,
    getSectionForService,
  });
  const availabilityByTime = new Map(
    availability.map((slot) => [
      slot.value,
      {
        time: slot.value,
        available: !slot.disabled,
        capacity: slot.capacity,
        used: slot.booked,
        remaining: Math.max(slot.capacity - slot.booked, 0),
      },
    ])
  );
  const slotSettings = buildSlotSettingsMap(
    (slotSettingsResult.data || []) as AgendaSlotSetting[]
  );
  const selectedDateClosed = Boolean(daySetting?.is_closed);
  const selectedDateDailyCapacity =
    daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;
  const dayLimited = selectedDateActiveTotal >= selectedDateDailyCapacity;

  const slots: AgendaAvailabilitySlot[] = getCommercialAgendaTimes(params.date)
    .map((time) => {
      const existingSlot = availabilityByTime.get(time);
      if (existingSlot) return existingSlot;

      const setting = slotSettings[`${params.date}_${time}`];
      const used = countBookingsForSlot(
        appointments,
        "agenda",
        serviceType,
        params.date,
        time,
        params.editingAppointmentId || null,
        getSectionForService
      );
      const capacity = DEFAULT_SLOT_CAPACITY;
      const blocked = Boolean(setting?.is_blocked);
      const available =
        !selectedDateClosed && !blocked && !dayLimited && used < capacity;

      return {
        time,
        available,
        capacity,
        used,
        remaining: Math.max(capacity - used, 0),
      };
    })
    .filter((slot) => (params.onlyAvailable ? slot.available : true));

  return {
    date: params.date,
    service_type: serviceType,
    slots,
  };
}
