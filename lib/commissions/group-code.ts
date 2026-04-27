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

export function resolveEmployeeCode(params: {
  commissionGroupCode?: string | null;
  employeeCode?: string | null;
}) {
  const normalizedEmployeeCode = String(params.employeeCode || "")
    .trim()
    .toUpperCase();

  if (!normalizedEmployeeCode) return null;

  if (/^[A-Z]{2}\d{4}$/.test(normalizedEmployeeCode)) {
    return normalizedEmployeeCode;
  }

  const normalizedGroupCode = normalizeCommissionGroupCode(
    params.commissionGroupCode
  );

  if (normalizedGroupCode && /^\d{4}$/.test(normalizedEmployeeCode)) {
    return `${normalizedGroupCode}${normalizedEmployeeCode}`;
  }

  return null;
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

  const resolvedEmployeeCode = resolveEmployeeCode(params);
  const employeePrefix = extractCommissionGroupCodeFromEmployeeCode(
    resolvedEmployeeCode
  );
  const normalizedGroupCode = normalizeCommissionGroupCode(params.commissionGroupCode);

  if (employeePrefix && normalizedGroupCode && employeePrefix !== normalizedGroupCode) {
    return "El grupo de comision debe coincidir con las 2 primeras letras del codigo interno.";
  }

  return null;
}

export function getEmployeeCodeValidationError(params: {
  commissionGroupCode?: string | null;
  employeeCode?: string | null;
}) {
  const rawEmployeeCode = String(params.employeeCode || "").trim().toUpperCase();

  if (!rawEmployeeCode) return null;
  if (/^[A-Z]{2}\d{4}$/.test(rawEmployeeCode)) return null;
  if (/^\d{4}$/.test(rawEmployeeCode)) {
    return normalizeCommissionGroupCode(params.commissionGroupCode)
      ? null
      : "Si escribes solo 4 numeros, primero selecciona un grupo de comision.";
  }

  return "El codigo debe tener 4 numeros o 2 letras y 4 numeros. Ej: 3030 o CB3030.";
}
