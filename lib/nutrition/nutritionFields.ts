export type NutritionMetricFieldKey =
  | "weight"
  | "height"
  | "armPerimeter"
  | "bodyMassIndex"
  | "bodyFatPercentage"
  | "muscleMass"
  | "restingMetabolism"
  | "visceralFat"
  | "bodyAge"
  | "waistCircumference"
  | "calfPerimeter"

export type NutritionMetricField = {
  key: NutritionMetricFieldKey
  label: string
  placeholder?: string
  unit?: string
}

export const NUTRITION_METRIC_FIELDS: NutritionMetricField[] = [
  {
    key: "weight",
    label: "Peso",
    placeholder: "Ej. 72",
    unit: "kg",
  },
  {
    key: "height",
    label: "Talla",
    placeholder: "Ej. 1.68",
    unit: "m",
  },
  {
    key: "armPerimeter",
    label: "Perímetro brazo",
    placeholder: "Ej. 28",
    unit: "cm",
  },
  {
    key: "bodyMassIndex",
    label: "Índice masa corporal",
    placeholder: "Ej. 25.5",
  },
  {
    key: "bodyFatPercentage",
    label: "Porcentaje masa corporal",
    placeholder: "Ej. 31",
    unit: "%",
  },
  {
    key: "muscleMass",
    label: "Masa muscular",
    placeholder: "Ej. 24",
    unit: "kg",
  },
  {
    key: "restingMetabolism",
    label: "Metabolismo en reposo",
    placeholder: "Ej. 1450",
    unit: "kcal",
  },
  {
    key: "visceralFat",
    label: "Grasa visceral",
    placeholder: "Ej. 9",
  },
  {
    key: "bodyAge",
    label: "Edad corporal",
    placeholder: "Ej. 42",
    unit: "años",
  },
  {
    key: "waistCircumference",
    label: "Circunferencia cintura",
    placeholder: "Ej. 92",
    unit: "cm",
  },
  {
    key: "calfPerimeter",
    label: "Perímetro pantorrilla",
    placeholder: "Ej. 35",
    unit: "cm",
  },
]

export const NUTRITION_TEXT_FIELDS = {
  foodData: "Datos alimentarios",
  nutritionalObjective: "Objetivo nutricional",
  nutritionalRecommendations: "Recomendaciones nutricionales",
  nutritionalPlan: "Plan nutricional",
} as const
