export function normalizeCommissionGroupCode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function extractCommissionGroupCodeFromEmployeeCode(
  employeeCode: string | null | undefined
) {
  const normalized = String(employeeCode || "").trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{2})\d{4}$/);
  return match?.[1] || null;
}

export function resolveCommissionGroupCode(params: {
  commissionGroupCode?: string | null;
  employeeCode?: string | null;
}) {
  return (
    normalizeCommissionGroupCode(params.commissionGroupCode) ||
    extractCommissionGroupCodeFromEmployeeCode(params.employeeCode)
  );
}

export function getCommissionGroupCodeValidationError(params: {
  commissionGroupCode?: string | null;
  employeeCode?: string | null;
}) {
  const rawGroupCode = String(params.commissionGroupCode || "").trim().toUpperCase();
  if (rawGroupCode && !normalizeCommissionGroupCode(rawGroupCode)) {
    return "El grupo de comision debe tener exactamente 2 letras. Ej: CB.";
  }

  const employeePrefix = extractCommissionGroupCodeFromEmployeeCode(params.employeeCode);
  const normalizedGroupCode = normalizeCommissionGroupCode(params.commissionGroupCode);

  if (employeePrefix && normalizedGroupCode && employeePrefix !== normalizedGroupCode) {
    return "El grupo de comision debe coincidir con las 2 primeras letras del codigo interno.";
  }

  return null;
}
