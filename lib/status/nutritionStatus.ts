export const NUTRITION_STATUSES = {
  SCHEDULED: "Agendada",
  WAITING: "En espera",
  IN_PROGRESS: "En atención",
  COMPLETED: "Finalizada",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reprogramada",
} as const

export type NutritionStatus =
  (typeof NUTRITION_STATUSES)[keyof typeof NUTRITION_STATUSES]

export const ACTIVE_NUTRITION_STATUSES: NutritionStatus[] = [
  NUTRITION_STATUSES.SCHEDULED,
  NUTRITION_STATUSES.WAITING,
  NUTRITION_STATUSES.IN_PROGRESS,
]

export function isActiveNutritionStatus(status?: string | null) {
  if (!status) return false
  return ACTIVE_NUTRITION_STATUSES.includes(status as NutritionStatus)
}

export function canFinalizeNutrition(status?: string | null) {
  return isActiveNutritionStatus(status)
}

export function isCompletedNutritionStatus(status?: string | null) {
  return status === NUTRITION_STATUSES.COMPLETED
}
