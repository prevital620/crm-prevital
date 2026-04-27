export const commissionGroupRoleCodes = [
  "promotor_opc",
  "supervisor_opc",
  "tmk",
  "supervisor_call_center",
  "confirmador",
] as const;

export function roleNeedsCommissionGroup(roleCode: string | null | undefined) {
  return commissionGroupRoleCodes.includes(
    (roleCode || "") as (typeof commissionGroupRoleCodes)[number]
  );
}

function normalizeCommissionGroupHint(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function jobTitleSuggestsCommissionGroup(jobTitle: string | null | undefined) {
  const normalized = normalizeCommissionGroupHint(jobTitle);

  if (!normalized) return false;

  return [
    "OPC",
    "TMK",
    "CONFIRMADOR",
    "SUPERVISOR OPC",
    "SUPERVISOR CALL CENTER",
  ].some((hint) => normalized.includes(hint));
}
