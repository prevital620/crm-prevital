import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

type VerifiedSessionState = {
  user: User | null;
  mustChangePassword: boolean;
  error?: string;
};

type SuperUserCheck =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

function normalizeRoleCode(roleCode: string | null | undefined) {
  if (!roleCode) return null;

  if (
    roleCode === "gerente" ||
    roleCode === "gerente_comercial" ||
    roleCode === "gerencia_comercial"
  ) {
    return "gerencia_comercial";
  }

  return roleCode;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function getTemporaryUserPassword() {
  return (
    process.env.DEFAULT_TEMP_PASSWORD ||
    process.env.DEFAULT_USER_TEMP_PASSWORD ||
    "Prevital2026*"
  );
}

export async function getVerifiedSessionState(
  supabase: SupabaseClient
): Promise<VerifiedSessionState> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      user: null,
      mustChangePassword: false,
      error: error.message,
    };
  }

  if (!user) {
    return {
      user: null,
      mustChangePassword: false,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      user,
      mustChangePassword: false,
      error: profileError.message,
    };
  }

  return {
    user,
    mustChangePassword: Boolean(profile?.must_change_password),
  };
}

export async function requireSuperUser(
  supabase: SupabaseClient
): Promise<SuperUserCheck> {
  const sessionState = await getVerifiedSessionState(supabase);

  if (sessionState.error) {
    return {
      ok: false,
      error: sessionState.error,
      status: 500,
    };
  }

  if (!sessionState.user) {
    return {
      ok: false,
      error: "Debes iniciar sesión para usar esta función.",
      status: 401,
    };
  }

  if (sessionState.mustChangePassword) {
    return {
      ok: false,
      error: "Debes cambiar tu contraseña antes de continuar.",
      status: 403,
    };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      roles (
        code
      )
    `)
    .eq("user_id", sessionState.user.id);

  if (error) {
    return {
      ok: false,
      error: error.message,
      status: 500,
    };
  }

  const roleCodes = (data || [])
    .map((row) => {
      const roles = row.roles as
        | { code?: string | null }
        | Array<{ code?: string | null }>
        | null;

      if (Array.isArray(roles)) {
        return roles[0]?.code || null;
      }

      return roles?.code || null;
    })
    .map((code) => normalizeRoleCode(code))
    .filter(Boolean);

  if (!roleCodes.includes("super_user")) {
    return {
      ok: false,
      error: "No tienes permiso para usar esta función.",
      status: 403,
    };
  }

  return {
    ok: true,
    user: sessionState.user,
  };
}
