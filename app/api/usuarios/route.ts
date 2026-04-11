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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const job_title = String(body?.job_title || "").trim();
    const department_id = String(body?.department_id || "").trim();
    const role_id = String(body?.role_id || "").trim();

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

    if (!role_id) {
      return NextResponse.json(
        { error: "Debes seleccionar un rol." },
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

    const tempPassword = TEMP_PASSWORD;

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

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert([
      {
        user_id: userId,
        role_id,
      },
    ]);

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}