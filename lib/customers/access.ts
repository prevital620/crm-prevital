import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export const CUSTOMER_CONSULT_FULL_ROLES = [
  "super_user",
  "administrador",
  "recepcion",
  "coordinador_clinico",
  "auditor_clinico",
] as const;

export const CUSTOMER_CONSULT_TEAM_ROLES = [
  "gerencia_comercial",
  "gerente_comercial",
  "gerente",
] as const;

export const CUSTOMER_CONSULT_SELF_ROLES = [
  "comercial",
  "tmk",
  "nutricionista",
  "fisioterapeuta",
  "medico_general",
] as const;

export const CUSTOMER_CONSULT_ALLOWED_ROLES = [
  ...CUSTOMER_CONSULT_FULL_ROLES,
  ...CUSTOMER_CONSULT_TEAM_ROLES,
  ...CUSTOMER_CONSULT_SELF_ROLES,
] as const;

export type CustomerConsultScope = "full" | "team" | "self" | "none";

type CustomerConsultAllowedRole =
  | (typeof CUSTOMER_CONSULT_FULL_ROLES)[number]
  | (typeof CUSTOMER_CONSULT_TEAM_ROLES)[number]
  | (typeof CUSTOMER_CONSULT_SELF_ROLES)[number];

export type CustomerConsultSessionContext = {
  user: User;
  roleCodes: string[];
  profileJobTitle: string | null;
  effectiveRole: CustomerConsultAllowedRole | null;
  scope: CustomerConsultScope;
};

function normalizeRoleCode(roleCode: string | null | undefined) {
  if (!roleCode) return null;

  const normalized = String(roleCode)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+(am|pm)$/i, "")
    .replace(/[\s-]+/g, "_");

  if (!normalized) return null;

  if (["gerente", "gerente_comercial", "gerencia_comercial"].includes(normalized)) {
    return "gerencia_comercial";
  }

  if (normalized === "super_usuario") {
    return "super_user";
  }

  return normalized;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function getCustomerConsultScope(roleCodes: string[]): CustomerConsultScope {
  if (roleCodes.some((role) => CUSTOMER_CONSULT_FULL_ROLES.includes(role as never))) {
    return "full";
  }

  if (roleCodes.some((role) => CUSTOMER_CONSULT_TEAM_ROLES.includes(role as never))) {
    return "team";
  }

  if (roleCodes.some((role) => CUSTOMER_CONSULT_SELF_ROLES.includes(role as never))) {
    return "self";
  }

  return "none";
}

export async function getCustomerConsultSessionContext(
  supabase: SupabaseClient
): Promise<CustomerConsultSessionContext | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select(
      `
      role_id,
      roles (
        code,
        name
      )
    `
    )
    .eq("user_id", user.id);

  const roleCodes = unique(
    (
      (roleRows as Array<{
        roles?:
          | { code?: string | null; name?: string | null }
          | Array<{ code?: string | null; name?: string | null }>;
      }> | null) || []
    )
      .map((row) => {
        const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
        return normalizeRoleCode(role?.code || role?.name || null);
      })
      .filter(Boolean) as string[]
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("job_title")
    .eq("id", user.id)
    .maybeSingle();

  const fallbackRole = normalizeRoleCode(profile?.job_title || null);
  const effectiveRoleCodes = unique(
    fallbackRole ? [...roleCodes, fallbackRole] : roleCodes
  );

  const scope = getCustomerConsultScope(effectiveRoleCodes);
  const effectiveRole =
    effectiveRoleCodes.find((role) =>
      (CUSTOMER_CONSULT_ALLOWED_ROLES as readonly string[]).includes(role)
    ) || null;

  return {
    user,
    roleCodes: effectiveRoleCodes,
    profileJobTitle: profile?.job_title || null,
    effectiveRole: effectiveRole as CustomerConsultAllowedRole | null,
    scope,
  };
}

export function canUseCustomerConsult(
  context: CustomerConsultSessionContext | null
) {
  return Boolean(context && context.scope !== "none");
}
