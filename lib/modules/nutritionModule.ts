export const NUTRITION_MODULE = {
  key: "nutrition",
  title: "Nutrición",
  description: "Valorar pacientes, registrar plan nutricional e imprimir resultados.",
  href: "/nutricion",
  roles: ["admin", "gerencia", "recepcion", "nutricionista"],
} as const

export function canAccessNutritionModule(role?: string | null) {
  if (!role) return false
  return NUTRITION_MODULE.roles.includes(role as (typeof NUTRITION_MODULE.roles)[number])
}
