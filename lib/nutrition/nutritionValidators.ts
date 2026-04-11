export type NutritionAssessmentInput = {
  foodData?: string
  nutritionalClassification?: string
  nutritionalObjective?: string
  nutritionalRecommendations?: string
  nutritionalPlan?: string
}

export type NutritionFinalizeValidationResult = {
  isValid: boolean
  errors: string[]
}

function hasValue(value?: string | null) {
  return Boolean(value && value.trim())
}

export function validateNutritionBeforeSave(
  _data: NutritionAssessmentInput,
): NutritionFinalizeValidationResult {
  return {
    isValid: true,
    errors: [],
  }
}

export function validateNutritionBeforeFinalize(
  data: NutritionAssessmentInput,
): NutritionFinalizeValidationResult {
  const errors: string[] = []

  if (!hasValue(data.nutritionalClassification)) {
    errors.push("La clasificación nutricional es obligatoria.")
  }

  if (!hasValue(data.nutritionalObjective)) {
    errors.push("El objetivo nutricional es obligatorio.")
  }

  if (!hasValue(data.nutritionalRecommendations)) {
    errors.push("Las recomendaciones nutricionales son obligatorias.")
  }

  if (!hasValue(data.nutritionalPlan)) {
    errors.push("El plan nutricional es obligatorio.")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
