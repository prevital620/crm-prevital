export function getAllowedRoleCodesForService(serviceType: string | null | undefined) {
  const value = String(serviceType || "").trim().toLowerCase();

  if (value === "nutricion") return ["nutricionista"];
  if (value === "fisioterapia") return ["fisioterapeuta"];
  if (value === "medico" || value === "detox" || value === "sueroterapia") {
    return ["medico_general", "medico"];
  }

  return [];
}

export function specialistMatchesService(
  serviceType: string | null | undefined,
  roleCode: string | null | undefined
) {
  const normalizedRole = String(roleCode || "").trim().toLowerCase();
  const allowedRoleCodes = getAllowedRoleCodesForService(serviceType);

  if (!normalizedRole) return false;
  if (allowedRoleCodes.length === 0) return true;

  return allowedRoleCodes.includes(normalizedRole);
}
