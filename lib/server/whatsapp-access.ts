import "server-only";

import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getVerifiedSessionState } from "@/lib/server/user-security";

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function normalizeRoleCode(roleCode: string | null | undefined) {
  const normalized = normalizeText(roleCode).replace(/[\s-]+/g, "_");

  if (["gerente", "gerente_comercial", "gerencia_comercial"].includes(normalized)) {
    return "gerencia_comercial";
  }

  if (normalized === "super_usuario") {
    return "super_user";
  }

  return normalized || null;
}

function normalizeGroupCode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

function roleCodesFromRows(data: unknown) {
  return (((data as Array<{ roles?: { code?: string | null } | Array<{ code?: string | null }> | null }> | null) || [])
    .map((row) => {
      const roles = row.roles;

      if (Array.isArray(roles)) {
        return roles[0]?.code || null;
      }

      return roles?.code || null;
    })
    .map((code) => normalizeRoleCode(code))
    .filter(Boolean) as string[]);
}

export async function requireWhatsappLeadsAccess() {
  const supabase = await createRouteHandlerSupabaseClient();
  const sessionState = await getVerifiedSessionState(supabase);

  if (sessionState.error) {
    return {
      ok: false as const,
      error: sessionState.error,
      status: 500,
    };
  }

  if (!sessionState.user) {
    return {
      ok: false as const,
      error: "Debes iniciar sesion para usar esta funcion.",
      status: 401,
    };
  }

  if (sessionState.mustChangePassword) {
    return {
      ok: false as const,
      error: "Debes cambiar tu contrasena antes de continuar.",
      status: 403,
    };
  }

  const [{ data: roleRows, error: rolesError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("user_roles")
        .select(
          `
          roles (
            code
          )
        `
        )
        .eq("user_id", sessionState.user.id),
      supabase
        .from("profiles")
        .select("full_name, commission_group_code")
        .eq("id", sessionState.user.id)
        .maybeSingle(),
    ]);

  if (rolesError) {
    return {
      ok: false as const,
      error: rolesError.message,
      status: 500,
    };
  }

  if (profileError) {
    return {
      ok: false as const,
      error: profileError.message,
      status: 500,
    };
  }

  const roleCodes = roleCodesFromRows(roleRows);
  const isSuperUser = roleCodes.includes("super_user");
  const profileName = normalizeText(profile?.full_name);
  const groupCode = normalizeGroupCode(profile?.commission_group_code);
  const isBibianaCalleCallCb =
    roleCodes.includes("supervisor_call_center") &&
    groupCode === "CB" &&
    profileName.includes("bibiana") &&
    profileName.includes("calle");

  if (!isSuperUser && !isBibianaCalleCallCb) {
    return {
      ok: false as const,
      error: "No tienes permiso para ver los leads de WhatsApp.",
      status: 403,
    };
  }

  return {
    ok: true as const,
    user: sessionState.user,
  };
}

export async function requireWhatsappMetaConversionsSendAccess() {
  const supabase = await createRouteHandlerSupabaseClient();
  const sessionState = await getVerifiedSessionState(supabase);

  if (sessionState.error) {
    return {
      ok: false as const,
      error: sessionState.error,
      status: 500,
    };
  }

  if (!sessionState.user) {
    return {
      ok: false as const,
      error: "Debes iniciar sesion para enviar conversiones reales a Meta.",
      status: 401,
    };
  }

  if (sessionState.mustChangePassword) {
    return {
      ok: false as const,
      error: "Debes cambiar tu contrasena antes de continuar.",
      status: 403,
    };
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select(
      `
      roles (
        code
      )
    `
    )
    .eq("user_id", sessionState.user.id);

  if (rolesError) {
    return {
      ok: false as const,
      error: rolesError.message,
      status: 500,
    };
  }

  const roleCodes = roleCodesFromRows(roleRows);
  if (!roleCodes.includes("super_user")) {
    return {
      ok: false as const,
      error: "Solo un Super Usuario puede enviar conversiones reales a Meta.",
      status: 403,
    };
  }

  return {
    ok: true as const,
    user: sessionState.user,
    roleCodes,
  };
}
