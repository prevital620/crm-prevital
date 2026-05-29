import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConversionRow = {
  id: string;
  whatsapp_lead_id: string | null;
  event_name: string;
  event_time: string;
  event_value: number | null;
  currency: string | null;
  event_id: string;
  payload_preview: Record<string, unknown> | null;
  meta_ctwa_clid: string | null;
};

type LeadRow = {
  id: string;
  phone: string | null;
  email: string | null;
  meta_source_url: string | null;
  meta_ctwa_clid: string | null;
};

function normalizeSecret(value: string | null | undefined) {
  return String(value || "").trim();
}

function requireSecret(request: Request) {
  const expected = normalizeSecret(process.env.META_CONVERSIONS_SECRET);
  const provided =
    normalizeSecret(request.headers.get("x-meta-conversions-secret")) ||
    normalizeSecret(request.headers.get("x-internal-secret"));

  return Boolean(expected && provided && expected === provided);
}

function sha256(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

function phoneDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizedPhoneForMeta(value: string | null | undefined) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local ? `57${local}` : digits;
}

function eventTimeSeconds(value: string) {
  const time = new Date(value).getTime();
  return Math.floor((Number.isNaN(time) ? Date.now() : time) / 1000);
}

export async function POST(request: Request) {
  try {
    if (!requireSecret(request)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const accessToken = normalizeSecret(process.env.META_ACCESS_TOKEN);
    const datasetId = normalizeSecret(process.env.META_DATASET_ID || process.env.META_PIXEL_ID);
    const apiVersion = normalizeSecret(process.env.META_API_VERSION) || "v20.0";

    if (!accessToken || !datasetId) {
      return NextResponse.json(
        {
          error:
            "Envio desactivado: faltan META_ACCESS_TOKEN y META_DATASET_ID o META_PIXEL_ID.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const limit = Math.min(Math.max(Number(body?.limit || 25), 1), 100);

    const { data: eventsData, error: eventsError } = await supabaseAdmin
      .from("meta_conversion_events")
      .select("id, whatsapp_lead_id, event_name, event_time, event_value, currency, event_id, payload_preview, meta_ctwa_clid")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (eventsError) throw eventsError;

    const events = (eventsData || []) as ConversionRow[];
    if (!events.length) return NextResponse.json({ ok: true, sent: 0, failed: 0 });

    const leadIds = Array.from(new Set(events.map((event) => event.whatsapp_lead_id).filter(Boolean) as string[]));
    const { data: leadsData, error: leadsError } = leadIds.length
      ? await supabaseAdmin
          .from("whatsapp_leads")
          .select("id, phone, email, meta_source_url, meta_ctwa_clid")
          .in("id", leadIds)
      : { data: [], error: null };

    if (leadsError) throw leadsError;

    const leadsById = new Map(((leadsData || []) as LeadRow[]).map((lead) => [lead.id, lead]));
    const data = events.map((event) => {
      const lead = event.whatsapp_lead_id ? leadsById.get(event.whatsapp_lead_id) : null;
      const phoneHash = sha256(normalizedPhoneForMeta(lead?.phone));
      const emailHash = sha256(lead?.email);
      const previewCustomData = (event.payload_preview?.custom_data || {}) as Record<string, unknown>;

      return {
        event_name: event.event_name,
        event_time: eventTimeSeconds(event.event_time),
        event_id: event.event_id,
        action_source: "business_messaging",
        event_source_url: lead?.meta_source_url || undefined,
        user_data: {
          ph: phoneHash ? [phoneHash] : undefined,
          em: emailHash ? [emailHash] : undefined,
          ctwa_clid: event.meta_ctwa_clid || lead?.meta_ctwa_clid || undefined,
        },
        custom_data: {
          ...previewCustomData,
          value: event.event_value || undefined,
          currency: event.currency || undefined,
        },
      };
    });

    const payload: Record<string, unknown> = { data };
    const testEventCode = normalizeSecret(process.env.META_TEST_EVENT_CODE);
    if (testEventCode) payload.test_event_code = testEventCode;

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${datasetId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        typeof result?.error?.message === "string"
          ? result.error.message
          : "Meta rechazo el lote de conversiones.";

      await supabaseAdmin
        .from("meta_conversion_events")
        .update({
          status: "error",
          error_message: errorMessage,
        })
        .in("id", events.map((event) => event.id));

      return NextResponse.json({ ok: false, error: errorMessage }, { status: 502 });
    }

    await supabaseAdmin
      .from("meta_conversion_events")
      .update({
        status: "sent",
        error_message: null,
        sent_at: new Date().toISOString(),
      })
      .in("id", events.map((event) => event.id));

    return NextResponse.json({ ok: true, sent: events.length, failed: 0, meta: result });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudieron enviar conversiones Meta.") },
      { status: 500 }
    );
  }
}
