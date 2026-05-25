import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set([
  "collecting_name",
  "collecting_email",
  "registered",
]);

function normalizeTextParam(value: string | null) {
  const normalized = (value || "").trim();
  return normalized || null;
}

function normalizeDateParam(value: string | null) {
  const normalized = normalizeTextParam(value);

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export async function GET(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = normalizeTextParam(searchParams.get("status"));
    const campaignCode = normalizeTextParam(searchParams.get("campaign_code"));
    const dateFrom = normalizeDateParam(searchParams.get("date_from"));
    const dateTo = normalizeDateParam(searchParams.get("date_to"));

    let query = supabaseAdmin
      .from("whatsapp_leads")
      .select(
        "id, phone, profile_name, full_name, email, campaign_code, source, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (status && allowedStatuses.has(status)) {
      query = query.eq("status", status);
    }

    if (campaignCode) {
      query = query.eq("campaign_code", campaignCode);
    }

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00-05:00`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999-05:00`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron cargar los leads de WhatsApp." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      leads: data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
