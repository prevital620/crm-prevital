import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const TEMP_PASSWORD = "Prevital2026*";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: TEMP_PASSWORD,
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
        { error: profileError.message || "No se pudo marcar el cambio obligatorio de contraseña." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contraseña restablecida correctamente.",
      tempPassword: TEMP_PASSWORD,
      user: data.user,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
