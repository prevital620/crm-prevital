import type { ReceptionSection } from "./agendaSections";

export type SlotOption = {
  value: string;
  label: string;
};

export const SLOT_OPTIONS: SlotOption[] = [
  { value: "08:00", label: "8:00 a. m." },
  { value: "08:30", label: "8:30 a. m." },
  { value: "09:00", label: "9:00 a. m." },
  { value: "09:30", label: "9:30 a. m." },
  { value: "10:00", label: "10:00 a. m." },
  { value: "10:30", label: "10:30 a. m." },
  { value: "11:00", label: "11:00 a. m." },
  { value: "11:30", label: "11:30 a. m." },
  { value: "13:00", label: "1:00 p. m." },
  { value: "13:30", label: "1:30 p. m." },
  { value: "14:00", label: "2:00 p. m." },
  { value: "14:30", label: "2:30 p. m." },
  { value: "15:00", label: "3:00 p. m." },
  { value: "15:30", label: "3:30 p. m." },
  { value: "16:00", label: "4:00 p. m." },
  { value: "16:30", label: "4:30 p. m." },
  { value: "17:00", label: "5:00 p. m." },
];

export const ACTIVE_APPOINTMENT_STATUSES = [
  "agendada",
  "confirmada",
  "en_espera",
  "reagendada",
  "en_atencion",
];

export const DEFAULT_SLOT_CAPACITY = 6;
export const DEFAULT_DAILY_CAPACITY = 60;
export const SPECIALIST_SINGLE_CAPACITY = 1;
export const TREATMENT_DOUBLE_CAPACITY = 2;

export function getDayOfWeek(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function getSlotIndex(time: string) {
  return SLOT_OPTIONS.findIndex((slot) => slot.value === time);
}

export function getSlotsForDuration(startTime: string, durationMinutes: number) {
  const startIndex = getSlotIndex(startTime);
  if (startIndex < 0) return [];
  const blocksNeeded = Math.max(1, Math.ceil(durationMinutes / 30));
  const slots = SLOT_OPTIONS.slice(startIndex, startIndex + blocksNeeded).map((slot) => slot.value);
  if (slots.length !== blocksNeeded) return [];
  return slots;
}

export function getResourceCapacity(section: ReceptionSection) {
  if (section === "especialistas") return SPECIALIST_SINGLE_CAPACITY;
  if (section === "tratamientos") return TREATMENT_DOUBLE_CAPACITY;
  if (section === "nutricion_entregas") return DEFAULT_SLOT_CAPACITY;
  return DEFAULT_SLOT_CAPACITY;
}

export function getDurationOptions(
  section: ReceptionSection,
  serviceType: string,
  appointmentDate: string
) {
  if (section === "nutricion_entregas") return [];
  if (section === "tratamientos") return [{ value: "30", label: "30 min" }];

  if (section === "especialistas") {
    if (serviceType === "medico") {
      return getDayOfWeek(appointmentDate) === 3 ? [{ value: "60", label: "60 min" }] : [];
    }
    if (serviceType === "nutricion" || serviceType === "fisioterapia") {
      return [
        { value: "30", label: "30 min" },
        { value: "60", label: "60 min" },
      ];
    }
    return [];
  }

  return [{ value: "30", label: "30 min" }];
}

export function getAllowedSlotOptions(
  section: ReceptionSection,
  serviceType: string,
  appointmentDate: string,
  durationMinutes: number
) {
  if (section === "nutricion_entregas") return [];

  if (section === "especialistas") {
    if (serviceType === "medico") {
      if (getDayOfWeek(appointmentDate) !== 3 || durationMinutes !== 60) return [];
      return SLOT_OPTIONS.filter((slot) =>
        ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"].includes(slot.value)
      );
    }

    if (serviceType === "nutricion" || serviceType === "fisioterapia") {
      return SLOT_OPTIONS.filter((slot) => {
        if (slot.value === "17:00") return false;
        const slotsNeeded = getSlotsForDuration(slot.value, durationMinutes);
        if (slotsNeeded.length === 0) return false;
        if (durationMinutes === 60 && slot.value === "11:30") return false;
        return true;
      });
    }

    return [];
  }

  if (section === "tratamientos") return SLOT_OPTIONS.filter((slot) => slot.value !== "17:00");
  return SLOT_OPTIONS.filter((slot) => slot.value !== "17:00");
}
