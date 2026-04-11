import type { ReceptionSection } from "./agendaSections";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_CAPACITY,
  getAllowedSlotOptions,
  getResourceCapacity,
  getSlotsForDuration,
} from "./agendaDurations";

export type AppointmentRowLike = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
};

export type AgendaSlotSettingLike = {
  agenda_date: string;
  slot_time: string;
  capacity: number | null;
  is_blocked: boolean;
};

export function extraerDuracionDesdeNotas(notes: string | null | undefined) {
  if (!notes) return 30;
  const match = notes.match(/Duración:\s*(30|60)\s*min/i);
  return match?.[1] === "60" ? 60 : 30;
}

export function getAppointmentOccupiedSlots(item: AppointmentRowLike) {
  const duration = extraerDuracionDesdeNotas(item.notes);
  return getSlotsForDuration(item.appointment_time.slice(0, 5), duration);
}

export function sameAgendaResource(
  section: ReceptionSection,
  item: AppointmentRowLike,
  selectedServiceType: string,
  getSectionForService: (serviceType: string | null | undefined) => ReceptionSection
) {
  const itemSection = getSectionForService(item.service_type);
  if (section === "agenda") return itemSection === "agenda";
  return itemSection === section && (item.service_type || "") === selectedServiceType;
}

export function countBookingsForSlot(
  allAppointments: AppointmentRowLike[],
  section: ReceptionSection,
  serviceType: string,
  appointmentDate: string,
  slotValue: string,
  editingAppointmentId: string | null,
  getSectionForService: (serviceType: string | null | undefined) => ReceptionSection
) {
  return allAppointments.filter((item) => {
    if (item.appointment_date !== appointmentDate) return false;
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(item.status)) return false;
    if (item.id === editingAppointmentId) return false;
    if (!sameAgendaResource(section, item, serviceType, getSectionForService)) return false;
    return getAppointmentOccupiedSlots(item).includes(slotValue);
  }).length;
}

export function buildSlotAvailability({
  appointments,
  section,
  serviceType,
  appointmentDate,
  durationMinutes,
  slotSettings,
  selectedDateClosed,
  selectedDateDailyCapacity = DEFAULT_DAILY_CAPACITY,
  selectedDateActiveTotal,
  editingAppointmentId,
  getSectionForService,
}: {
  appointments: AppointmentRowLike[];
  section: ReceptionSection;
  serviceType: string;
  appointmentDate: string;
  durationMinutes: number;
  slotSettings: Record<string, AgendaSlotSettingLike>;
  selectedDateClosed: boolean;
  selectedDateDailyCapacity?: number;
  selectedDateActiveTotal: number;
  editingAppointmentId: string | null;
  getSectionForService: (serviceType: string | null | undefined) => ReceptionSection;
}) {
  const allowedSlots = getAllowedSlotOptions(section, serviceType, appointmentDate, durationMinutes);

  return allowedSlots.map((slot) => {
    const requiredSlots = getSlotsForDuration(slot.value, durationMinutes);
    const capacity = getResourceCapacity(section);

    const perSlotBookings = requiredSlots.map((requiredSlot) =>
      countBookingsForSlot(
        appointments,
        section,
        serviceType,
        appointmentDate,
        requiredSlot,
        editingAppointmentId,
        getSectionForService
      )
    );

    const maxBooked = perSlotBookings.length > 0 ? Math.max(...perSlotBookings) : 0;
    const blockedByConfig = requiredSlots.some((requiredSlot) => {
      const setting = slotSettings[`${appointmentDate}_${requiredSlot}`];
      return setting?.is_blocked ?? false;
    });

    const dayLimited = selectedDateActiveTotal >= selectedDateDailyCapacity && !editingAppointmentId;

    const disabled =
      selectedDateClosed ||
      blockedByConfig ||
      requiredSlots.length === 0 ||
      maxBooked >= capacity ||
      dayLimited;

    return {
      ...slot,
      capacity,
      booked: maxBooked,
      disabled,
      isBlocked: blockedByConfig,
      isFullBySlot: maxBooked >= capacity,
      isFullByDay: dayLimited,
    };
  });
}
