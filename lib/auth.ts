import { supabase } from "@/lib/supabase";

type AuthRoleResult = {
  user: any | null;
  roleCode: string | null;
  roleName: string | null;
  allRoleCodes: string[];
  allRoleNames: string[];
};

const ROLE_PRIORITY = [
  "super_user",
  "gerencia_comercial",
  "gerente_comercial",
  "gerente",
  "comercial",
  "supervisor_call_center",
  "confirmador",
  "tmk",
  "promotor_opc",
  "supervisor_opc",
  "recepcion",
  "nutricionista",
  "medico_general",
  "fisioterapeuta",
];

function normalizeRoleCode(roleCode: string | null | undefined) {
  if (!roleCode) return null;

  if (["gerente", "gerente_comercial", "gerencia_comercial"].includes(roleCode)) {
    return "gerencia_comercial";
  }

  return roleCode;
}

function pickBestRole(roles: Array<{ code: string | null; name: string | null }>) {
  if (roles.length === 0) {
    return {
      roleCode: null,
      roleName: null,
    };
  }

  const normalizedRoles = roles.map((role) => ({
    code: normalizeRoleCode(role.code),
    name: role.name,
  }));

  for (const priorityCode of ROLE_PRIORITY) {
    const found = normalizedRoles.find((role) => role.code === priorityCode);
    if (found) {
      return {
        roleCode: found.code,
        roleName: found.name,
      };
    }
  }

  return {
    roleCode: normalizedRoles[0]?.code || null,
    roleName: normalizedRoles[0]?.name || null,
  };
}

export async function getCurrentUserRole(): Promise<AuthRoleResult> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      roleCode: null,
      roleName: null,
      allRoleCodes: [],
      allRoleNames: [],
    };
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select(`
      role_id,
      roles (
        name,
        code
      )
    `)
    .eq("user_id", user.id);

  if (error || !data) {
    return {
      user,
      roleCode: null,
      roleName: null,
      allRoleCodes: [],
      allRoleNames: [],
    };
  }

  const rows = (data as any[]) || [];

  const roles = rows
    .map((row) => ({
      code: row.roles?.code || null,
      name: row.roles?.name || null,
    }))
    .filter((role) => role.code);

  const uniqueByCode = new Map<string, { code: string | null; name: string | null }>();
  roles.forEach((role) => {
    const normalizedCode = normalizeRoleCode(role.code);
    if (!normalizedCode) return;

    if (!uniqueByCode.has(normalizedCode)) {
      uniqueByCode.set(normalizedCode, {
        code: normalizedCode,
        name: role.name,
      });
    }
  });

  const uniqueRoles = Array.from(uniqueByCode.values());
  const selectedRole = pickBestRole(uniqueRoles);

  return {
    user,
    roleCode: selectedRole.roleCode,
    roleName: selectedRole.roleName,
    allRoleCodes: uniqueRoles.map((role) => role.code).filter(Boolean) as string[],
    allRoleNames: uniqueRoles.map((role) => role.name).filter(Boolean) as string[],
  };
}
