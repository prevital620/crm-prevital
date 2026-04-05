import { supabase } from "@/lib/supabase";

export async function getCurrentUserRole() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      roleCode: null,
      roleName: null,
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
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (error || !data) {
    return {
      user,
      roleCode: null,
      roleName: null,
    };
  }

  const role = (data as any).roles;

  return {
    user,
    roleCode: role?.code || null,
    roleName: role?.name || null,
  };
}