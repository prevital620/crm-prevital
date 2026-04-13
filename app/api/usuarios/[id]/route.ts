import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage, requireSuperUser } from "@/lib/server/user-security";

type UserUpdatePayload = {
  full_name?: string;
  phone?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  is_active?: boolean;
  role_ids?: string[];
};

function normalizeOptionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseUserUpdatePayload(body: unknown): UserUpdatePayload {
  const payload = (body ?? {}) as Record<string, unknown>;

  const roleIds = Array.isArray(payload.role_ids)
    ? payload.role_ids
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : undefined;

  const result: UserUpdatePayload = {};

  if ("full_name" in payload) {
    result.full_name = String(payload.full_name ?? "").trim();
  }

  if ("phone" in payload) {
    result.phone = normalizeOptionalText(payload.phone);
  }

  if ("job_title" in payload) {
    result.job_title = normalizeOptionalText(payload.job_title);
  }

  if ("department_id" in payload) {
    result.department_id = normalizeOptionalText(payload.department_id);
  }

  if ("is_active" in payload) {
    result.is_active = Boolean(payload.is_active);
  }

  if (roleIds) {
    result.role_ids = Array.from(new Set(roleIds));
  }

  return result;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireSuperUser(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const payload = parseUserUpdatePayload(body);

    if ("full_name" in payload && !payload.full_name) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio." },
        { status: 400 }
      );
    }

    const profileUpdate: Record<string, string | boolean | null> = {};

    if ("full_name" in payload) {
      profileUpdate.full_name = payload.full_name ?? "";
    }

    if ("phone" in payload) {
      profileUpdate.phone = payload.phone ?? null;
    }

    if ("job_title" in payload) {
      profileUpdate.job_title = payload.job_title ?? null;
    }

    if ("department_id" in payload) {
      profileUpdate.department_id = payload.department_id ?? null;
    }

    if ("is_active" in payload) {
      profileUpdate.is_active = payload.is_active ?? false;
    }

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", id);

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message || "No se pudo actualizar el perfil." },
          { status: 400 }
        );
      }
    }

    if (payload.role_ids) {
      const { error: deleteRoleError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", id);

      if (deleteRoleError) {
        return NextResponse.json(
          {
            error:
              deleteRoleError.message || "No se pudieron actualizar los roles.",
          },
          { status: 400 }
        );
      }

      if (payload.role_ids.length > 0) {
        const rows = payload.role_ids.map((roleId) => ({
          user_id: id,
          role_id: roleId,
        }));

        const { error: insertRoleError } = await supabaseAdmin
          .from("user_roles")
          .insert(rows);

        if (insertRoleError) {
          return NextResponse.json(
            {
              error:
                insertRoleError.message ||
                "No se pudieron guardar los roles seleccionados.",
            },
            { status: 400 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario actualizado correctamente.",
      userId: id,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireSuperUser(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id, true);

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo eliminar el usuario." },
        { status: 400 }
      );
    }

    await supabaseAdmin.from("profiles").delete().eq("id", id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);

    return NextResponse.json({
      ok: true,
      message: "Usuario eliminado correctamente.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
