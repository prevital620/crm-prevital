import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      full_name,
      email,
      phone,
      job_title,
      department_id,
      role_id,
    } = body;

    if (!full_name?.trim()) {
      return NextResponse.json(
        { error: "El nombre completo es obligatorio." },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
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

    const tempPassword =
      process.env.DEFAULT_TEMP_PASSWORD || "Prevital2026*";

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario en Auth." },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: userId,
          full_name: full_name.trim(),
          phone: phone?.trim() || null,
          job_title: job_title?.trim() || null,
          department_id: department_id || null,
          is_active: true,
          must_change_password: true,
          notes: "Creado por super usuario",
        },
      ]);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert([
        {
          user_id: userId,
          role_id,
        },
      ]);

    if (roleError) {
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: roleError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Usuario creado correctamente.",
      tempPassword,
      userId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}