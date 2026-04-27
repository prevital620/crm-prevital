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
