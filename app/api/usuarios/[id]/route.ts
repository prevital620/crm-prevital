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

export async function DELETE(
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
