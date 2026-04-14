import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import {
  getErrorMessage,
  isAuthUserMissingError,
  requireSuperUser,
} from "@/lib/server/user-security";

type UserUpdatePayload = {
  full_name?: string;
  phone?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  is_active?: boolean;
  role_ids?: string[];
};

function isForeignKeyConstraintError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return message.includes("violates foreign key constraint");
}

async function clearUserReferences(
  userId: string,
  replacementUserId: string
) {
  const cleanupSteps = [
    () =>
      supabaseAdmin
        .from("leads")
        .update({ created_by_user_id: replacementUserId })
        .eq("created_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("leads")
        .update({ assigned_to_user_id: null })
        .eq("assigned_to_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ created_by_user_id: replacementUserId })
        .eq("created_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ updated_by_user_id: replacementUserId })
        .eq("updated_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ assigned_commercial_user_id: null })
        .eq("assigned_commercial_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ assigned_by_user_id: null })
        .eq("assigned_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ closed_by_user_id: null })
        .eq("closed_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ call_user_id: null })
        .eq("call_user_id", userId),
    () =>
      supabaseAdmin
        .from("commercial_cases")
        .update({ opc_user_id: null })
        .eq("opc_user_id", userId),
    () =>
      supabaseAdmin
        .from("appointments")
        .update({ specialist_user_id: null })
        .eq("specialist_user_id", userId),
    () =>
      supabaseAdmin
        .from("appointments")
        .update({ created_by_user_id: replacementUserId })
        .eq("created_by_user_id", userId),
    () =>
      supabaseAdmin
        .from("appointments")
        .update({ updated_by_user_id: replacementUserId })
        .eq("updated_by_user_id", userId),
  ];

  for (const step of cleanupSteps) {
    const { error } = await step();
    if (error && !isForeignKeyConstraintError(error)) {
      return error;
    }
  }

  return null;
}

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

    const cleanupError = await clearUserReferences(id, authCheck.user.id);

    if (cleanupError) {
      return NextResponse.json(
        {
          error:
            cleanupError.message ||
            "No se pudieron soltar las referencias del usuario antes de eliminarlo.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id, true);

    if (error && !isAuthUserMissingError(error)) {
      return NextResponse.json(
        { error: error.message || "No se pudo eliminar el usuario." },
        { status: 400 }
      );
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", id);

    if (profileDeleteError) {
      if (!isForeignKeyConstraintError(profileDeleteError)) {
        return NextResponse.json(
          {
            error:
              profileDeleteError.message ||
              "No se pudo limpiar el perfil del usuario eliminado.",
          },
          { status: 400 }
        );
      }
    }

    const { error: rolesDeleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", id);

    if (rolesDeleteError) {
      return NextResponse.json(
        {
          error:
            rolesDeleteError.message ||
            "No se pudieron limpiar los roles del usuario eliminado.",
        },
        { status: 400 }
      );
    }

    if (profileDeleteError && isForeignKeyConstraintError(profileDeleteError)) {
      const { error: archiveError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_active: false,
          must_change_password: false,
          department_id: null,
        })
        .eq("id", id);

      if (archiveError) {
        return NextResponse.json(
          {
            error:
              archiveError.message ||
              "No se pudo archivar el usuario con historial.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        archived: true,
        message:
          "El usuario tenía historial relacionado, así que se archivó y se le quitó el acceso en lugar de borrarlo por completo.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: error
        ? "Se limpió el registro local de un usuario que ya no existía en autenticación."
        : "Usuario eliminado correctamente.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
