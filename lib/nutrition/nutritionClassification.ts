export const NUTRITION_CLASSIFICATIONS = [
  "Desnutrición grado 1",
  "Desnutrición grado 2",
  "Desnutrición grado 3",
  "Normal",
  "Sobrepeso",
  "Preobeso",
  "Obesidad",
  "Obesidad grado 1",
  "Obesidad grado 2",
  "Obesidad grado 3",
] as const

export type NutritionClassification =
  (typeof NUTRITION_CLASSIFICATIONS)[number]

export function isNutritionClassification(
  value?: string | null,
): value is NutritionClassification {
  if (!value) return false
  return NUTRITION_CLASSIFICATIONS.includes(
    value as NutritionClassification,
  )
}
