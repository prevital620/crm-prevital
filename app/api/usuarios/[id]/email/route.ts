import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage, requireSuperUser } from "@/lib/server/user-security";

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
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();

    if (!id) {
      return NextResponse.json(
        { error: "Falta el id del usuario." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "El correo es obligatorio." },
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

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo actualizar el correo." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Correo actualizado correctamente.",
      userId: data.user?.id,
      email: data.user?.email || email,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
