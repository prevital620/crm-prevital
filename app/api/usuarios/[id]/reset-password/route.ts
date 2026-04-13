import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import {
  getErrorMessage,
  getTemporaryUserPassword,
  requireSuperUser,
} from "@/lib/server/user-security";

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
    const tempPassword = getTemporaryUserPassword();

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: tempPassword,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo restablecer la contraseña." },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", id);

    if (profileError) {
      return NextResponse.json(
        {
          error:
            profileError.message ||
            "No se pudo marcar el cambio obligatorio de contraseña.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseña restablecida correctamente.",
      tempPassword,
      userId: data.user?.id,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
