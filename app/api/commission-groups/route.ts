import { NextResponse } from "next/server";
import { normalizeCommissionGroupCode } from "@/lib/commissions/group-code";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage, requireSuperUser } from "@/lib/server/user-security";

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

    const { data, error } = await supabaseAdmin
      .from("commission_groups")
      .select("code, is_active")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron cargar los grupos." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      groups: (data || []).map((item) => ({
        code: item.code,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}

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
    const code = normalizeCommissionGroupCode(body?.code);

    if (!code) {
      return NextResponse.json(
        { error: "El grupo de comision debe tener 2 letras. Ej: CB." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("commission_groups").upsert(
      [
        {
          code,
          is_active: true,
        },
      ],
      { onConflict: "code" }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudo guardar el grupo." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      code,
      message: "Grupo de comision guardado correctamente.",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
