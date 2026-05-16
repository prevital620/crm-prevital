import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import {
  getErrorMessage,
  getTemporaryUserPassword,
  requireUserManagementAccess,
  requireSuperUser,
} from "@/lib/server/user-security";
import {
  getEmployeeCodeValidationError,
  getCommissionGroupCodeValidationError,
  resolveEmployeeCode,
  resolveCommissionGroupCode,
} from "@/lib/commissions/group-code";
import { roleNeedsCommissionGroup } from "@/lib/commissions/group-assignment";

async function getRoleCodes(roleIds: string[]) {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("code")
    .in("id", roleIds);

  if (error) throw error;
  return ((data as Array<{ code: string | null }> | null) || [])
    .map((item) => String(item.code || "").trim())
    .filter(Boolean);
}

async function commissionGroupExists(code: string) {
  const { data, error } = await supabaseAdmin
    .from("commission_groups")
    .select("code")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.code);
}

function getProfileRoleCodes(profile: Record<string, unknown>) {
  return (((profile.user_roles as Array<{ roles?: { code?: string | null } | Array<{ code?: string | null }> | null }> | null) || [])
    .flatMap((item) => {
      const roles = item.roles;
      return Array.isArray(roles) ? roles : roles ? [roles] : [];
    })
    .map((role) => String(role.code || "").trim())
    .filter(Boolean));
}

function supervisorCanSeeUser(managerRoleCodes: string[], targetRoleCodes: string[]) {
  if (
    targetRoleCodes.includes("super_user") ||
    targetRoleCodes.includes("administrador")
  ) {
    return false;
  }

  if (managerRoleCodes.includes("supervisor_opc")) {
    return targetRoleCodes.includes("promotor_opc");
  }

  if (managerRoleCodes.includes("supervisor_call_center")) {
    return (
      targetRoleCodes.includes("tmk") ||
      targetRoleCodes.includes("confirmador")
    );
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireSuperUser(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await request.json();

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const employee_code = String(body?.employee_code || "")
      .trim()
      .toUpperCase();
    const commission_group_code = String(body?.commission_group_code || "")
      .trim()
      .toUpperCase();
    const job_title = String(body?.job_title || "").trim();
    const department_id = String(body?.department_id || "").trim();
    const role_id = String(body?.role_id || "").trim();
    const role_ids = Array.isArray(body?.role_ids)
      ? body.role_ids
          .map((item: unknown) => String(item || "").trim())
          .filter(Boolean)
      : [];
    const selectedRoleIds: string[] = Array.from(
      new Set(role_ids.length > 0 ? role_ids : role_id ? [role_id] : [])
    );

    if (!full_name) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "El correo es obligatorio." },
        { status: 400 }
      );
    }

    if (selectedRoleIds.length === 0) {
      return NextResponse.json(
        { error: "Debes seleccionar al menos un rol." },
        { status: 400 }
      );
    }

    const employeeCodeError = getEmployeeCodeValidationError({
      commissionGroupCode: commission_group_code,
      employeeCode: employee_code,
    });

    if (employeeCodeError) {
      return NextResponse.json(
        { error: employeeCodeError },
        { status: 400 }
      );
    }

    const resolvedEmployeeCode =
      resolveEmployeeCode({
        commissionGroupCode: commission_group_code,
        employeeCode: employee_code,
      }) || null;

    const groupCodeError = getCommissionGroupCodeValidationError({
      commissionGroupCode: commission_group_code,
      employeeCode: resolvedEmployeeCode,
    });

    if (groupCodeError) {
      return NextResponse.json({ error: groupCodeError }, { status: 400 });
    }

    const resolvedGroupCode =
      resolveCommissionGroupCode({
        commissionGroupCode: commission_group_code,
        employeeCode: resolvedEmployeeCode,
      }) || null;
    const selectedRoleCodes = await getRoleCodes(selectedRoleIds);
    const requiresCommissionGroup = selectedRoleCodes.some((code) =>
      roleNeedsCommissionGroup(code)
    );

    if (requiresCommissionGroup && !resolvedGroupCode) {
      return NextResponse.json(
        {
          error:
            "Debes seleccionar un grupo de comision para OPC, TMK, confirmador o supervisores relacionados.",
        },
        { status: 400 }
      );
    }

    if (resolvedGroupCode && !(await commissionGroupExists(resolvedGroupCode))) {
      return NextResponse.json(
        {
          error:
            "El grupo de comision no existe todavia. Crealo primero y luego seleccionarlo en el usuario.",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El correo no tiene un formato válido." },
        { status: 400 }
      );
    }

    const tempPassword = getTemporaryUserPassword();

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (createError || !createdUser.user) {
      return NextResponse.json(
        { error: createError?.message || "No se pudo crear el usuario." },
        { status: 400 }
      );
    }

    const userId = createdUser.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      [
        {
          id: userId,
          full_name,
          phone: phone || null,
          employee_code: resolvedEmployeeCode,
          commission_group_code: resolvedGroupCode,
          job_title: job_title || null,
          department_id: department_id || null,
          is_active: true,
          must_change_password: true,
        },
      ],
      { onConflict: "id" }
    );

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message || "No se pudo crear el perfil." },
        { status: 400 }
      );
    }

    const roleRows = selectedRoleIds.map((selectedRoleId) => ({
      user_id: userId,
      role_id: selectedRoleId,
    }));

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert(roleRows);

    if (roleError) {
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: roleError.message || "No se pudo asignar el rol." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario creado correctamente.",
      userId,
      tempPassword,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireUserManagementAccess(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    let profilesQuery = supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        employee_code,
        commission_group_code,
        job_title,
        is_active,
        created_at,
        departments (
          name
        ),
        user_roles!user_roles_user_id_fkey (
          roles (
            name,
            code
          )
        )
      `);

    if (!authCheck.isSuperUser && authCheck.commissionGroupCode) {
      profilesQuery = profilesQuery.eq(
        "commission_group_code",
        authCheck.commissionGroupCode
      );
    }

    const { data: profiles, error: profilesError } = await profilesQuery.order(
      "created_at",
      { ascending: false }
    );

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message || "No se pudieron cargar los usuarios." },
        { status: 400 }
      );
    }

    const authUsers = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsers.error) {
      return NextResponse.json(
        {
          error:
            authUsers.error.message ||
            "No se pudieron cargar los accesos de autenticación.",
        },
        { status: 400 }
      );
    }

    const authById = new Map(
      (authUsers.data.users || []).map((user) => [
        user.id,
        {
          email: user.email || null,
          last_sign_in_at: user.last_sign_in_at || null,
        },
      ])
    );

    const visibleProfiles = ((profiles || []) as Array<Record<string, unknown>>).filter(
      (profile) => {
        if (authCheck.isSuperUser) return true;
        if (String(profile.id) === authCheck.user.id) return false;
        return supervisorCanSeeUser(authCheck.roleCodes, getProfileRoleCodes(profile));
      }
    );

    const result = visibleProfiles.map((profile) => {
        const authUser = authById.get(String(profile.id));

        return {
          ...profile,
          email: authUser?.email || null,
          auth_exists: Boolean(authUser),
          last_sign_in_at: authUser?.last_sign_in_at || null,
        };
      });

    return NextResponse.json({
      ok: true,
      users: result,
      viewer: {
        is_super_user: authCheck.isSuperUser,
        role_codes: authCheck.roleCodes,
        commission_group_code: authCheck.commissionGroupCode,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
