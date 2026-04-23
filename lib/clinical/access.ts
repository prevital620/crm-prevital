import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

export const CLINICAL_CONTENT_ROLES = [
  "nutricionista",
  "fisioterapeuta",
  "medico_general",
  "coordinador_clinico",
  "auditor_clinico",
] as const;

export const CLINICAL_FULL_ACCESS_ROLES = [
  "coordinador_clinico",
  "auditor_clinico",
] as const;

type ClinicalContentRole = (typeof CLINICAL_CONTENT_ROLES)[number];
type ClinicalFullAccessRole = (typeof CLINICAL_FULL_ACCESS_ROLES)[number];

export type ClinicalSessionContext = {
  user: User;
  roleCodes: string[];
  profileJobTitle: string | null;
  contentRoles: ClinicalContentRole[];
  fullAccessRoles: ClinicalFullAccessRole[];
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

export async function getClinicalSessionContext(
  supabase: SupabaseClient
): Promise<ClinicalSessionContext | null> {
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
    ((roleRows as Array<{ roles?: { code?: string | null; name?: string | null } | Array<{ code?: string | null; name?: string | null }> }> | null) || [])
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

  const contentRoles = effectiveRoleCodes.filter((role): role is ClinicalContentRole =>
    (CLINICAL_CONTENT_ROLES as readonly string[]).includes(role)
  );

  const fullAccessRoles = effectiveRoleCodes.filter((role): role is ClinicalFullAccessRole =>
    (CLINICAL_FULL_ACCESS_ROLES as readonly string[]).includes(role)
  );

  return {
    user,
    roleCodes: effectiveRoleCodes,
    profileJobTitle: profile?.job_title || null,
    contentRoles,
    fullAccessRoles,
  };
}

export function canReadClinicalContent(context: ClinicalSessionContext | null) {
  return Boolean(context && context.contentRoles.length > 0);
}

export function hasFullClinicalAccess(context: ClinicalSessionContext | null) {
  return Boolean(context && context.fullAccessRoles.length > 0);
}

export function canAccessEncounter(
  context: ClinicalSessionContext | null,
  encounter: { specialist_user_id: string } | null | undefined
) {
  if (!context || !encounter) return false;
  if (hasFullClinicalAccess(context)) return true;
  return context.user.id === encounter.specialist_user_id;
}
