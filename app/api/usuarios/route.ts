import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import {
  getErrorMessage,
  getTemporaryUserPassword,
  requireSuperUser,
} from "@/lib/server/user-security";

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireSuperUser(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

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

    const tempPassword = getTemporaryUserPassword();

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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerSupabaseClient();
    const authCheck = await requireSuperUser(supabase);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        job_title,
        is_active,
        created_at,
        departments (
          name
        ),
        user_roles!user_roles_user_id_fkey (
          roles (
            name,
            code
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json(
        { error: profilesError.message || "No se pudieron cargar los usuarios." },
        { status: 400 }
      );
    }

    const authUsers = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authUsers.error) {
      return NextResponse.json(
        {
          error:
            authUsers.error.message ||
            "No se pudieron cargar los accesos de autenticación.",
        },
        { status: 400 }
      );
    }

    const authById = new Map(
      (authUsers.data.users || []).map((user) => [
        user.id,
        {
          email: user.email || null,
          last_sign_in_at: user.last_sign_in_at || null,
        },
      ])
    );

    const result = ((profiles || []) as Array<Record<string, unknown>>).map(
      (profile) => {
        const authUser = authById.get(String(profile.id));

        return {
          ...profile,
          email: authUser?.email || null,
          auth_exists: Boolean(authUser),
          last_sign_in_at: authUser?.last_sign_in_at || null,
        };
      }
    );

    return NextResponse.json({
      ok: true,
      users: result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
