import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage, getVerifiedSessionState } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set([
  "collecting_name",
  "collecting_email",
  "registered",
]);

function normalizeTextParam(value: string | null) {
  const normalized = (value || "").trim();
  return normalized || null;
}

function normalizeDateParam(value: string | null) {
  const normalized = normalizeTextParam(value);

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

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

async function requireWhatsappLeadsAccess() {
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
  };
}

export async function GET(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = normalizeTextParam(searchParams.get("status"));
    const campaignCode = normalizeTextParam(searchParams.get("campaign_code"));
    const dateFrom = normalizeDateParam(searchParams.get("date_from"));
    const dateTo = normalizeDateParam(searchParams.get("date_to"));

    let query = supabaseAdmin
      .from("whatsapp_leads")
      .select(
        "id, phone, profile_name, full_name, email, campaign_code, source, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (status && allowedStatuses.has(status)) {
      query = query.eq("status", status);
    }

    if (campaignCode) {
      query = query.eq("campaign_code", campaignCode);
    }

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00-05:00`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999-05:00`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron cargar los leads de WhatsApp." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      leads: data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
