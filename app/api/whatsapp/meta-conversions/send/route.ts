import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendMode = "dry_run" | "test" | "send";
type EventStatus = "pending" | "error";
type EventName = "Lead" | "Schedule" | "QualifiedLead" | "Purchase";

type ConversionRow = {
  id: string;
  whatsapp_lead_id: string | null;
  event_name: EventName;
  event_time: string;
  event_value: number | null;
  currency: string | null;
  event_id: string;
  payload_preview: Record<string, unknown> | null;
  meta_ctwa_clid: string | null;
  status: string;
};

type LeadRow = {
  id: string;
  phone: string | null;
  email: string | null;
  meta_source_url: string | null;
  meta_ctwa_clid: string | null;
};

const EVENT_NAMES = new Set<EventName>(["Lead", "Schedule", "QualifiedLead", "Purchase"]);
const RETRYABLE_STATUSES = new Set<EventStatus>(["pending", "error"]);

function normalizeSecret(value: string | null | undefined) {
  return String(value || "").trim();
}

function providedSecret(request: Request) {
  return (
    normalizeSecret(request.headers.get("x-meta-conversions-secret")) ||
    normalizeSecret(request.headers.get("x-internal-secret"))
  );
}

function hasValidSecret(request: Request) {
  const expected = normalizeSecret(process.env.META_CONVERSIONS_SECRET);
  const provided = providedSecret(request);
  return Boolean(expected && provided && expected === provided);
}

async function authorizeRequest(request: Request, mode: SendMode) {
  if (hasValidSecret(request)) return { ok: true as const, via: "secret" as const };

  if (mode === "test" || mode === "dry_run") {
    const authCheck = await requireWhatsappLeadsAccess();
    if (authCheck.ok) return { ok: true as const, via: "crm" as const };
    return {
      ok: false as const,
      status: authCheck.status,
      error: authCheck.error,
    };
  }

  return {
    ok: false as const,
    status: 401,
    error: "No autorizado. El envio real requiere META_CONVERSIONS_SECRET.",
  };
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

function normalizeMode(value: unknown): SendMode {
  const mode = String(value || "dry_run").trim();
  if (mode === "test" || mode === "send" || mode === "dry_run") return mode;
  return "dry_run";
}

function normalizeEventName(value: unknown) {
  const eventName = String(value || "").trim();
  return EVENT_NAMES.has(eventName as EventName) ? (eventName as EventName) : null;
}

function normalizeStatus(value: unknown): EventStatus {
  const status = String(value || "pending").trim();
  return RETRYABLE_STATUSES.has(status as EventStatus) ? (status as EventStatus) : "pending";
}

function environmentConfig(mode: SendMode) {
  const accessToken = normalizeSecret(process.env.META_ACCESS_TOKEN);
  const datasetId = normalizeSecret(process.env.META_DATASET_ID || process.env.META_PIXEL_ID);
  const datasetEnvName = normalizeSecret(process.env.META_DATASET_ID)
    ? "META_DATASET_ID"
    : normalizeSecret(process.env.META_PIXEL_ID)
      ? "META_PIXEL_ID"
      : null;
  const apiVersion = normalizeSecret(process.env.META_API_VERSION);
  const conversionsSecret = normalizeSecret(process.env.META_CONVERSIONS_SECRET);
  const testEventCode = normalizeSecret(process.env.META_TEST_EVENT_CODE);

  const missing: string[] = [];
  if (!accessToken) missing.push("META_ACCESS_TOKEN");
  if (!datasetId) missing.push("META_DATASET_ID or META_PIXEL_ID");
  if (!apiVersion) missing.push("META_API_VERSION");
  if (!conversionsSecret) missing.push("META_CONVERSIONS_SECRET");
  if (mode === "test" && !testEventCode) missing.push("META_TEST_EVENT_CODE");

  return {
    accessToken,
    datasetId,
    datasetEnvName,
    apiVersion,
    conversionsSecret,
    testEventCode,
    missing,
  };
}

function selectedEventIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function safePayloadForResponse(payload: Record<string, unknown>, testMode: boolean) {
  if (!testMode) return payload;
  return {
    ...payload,
    test_event_code: "[configured]",
  };
}

function metaSummary(result: Record<string, unknown>, eventsReceived: number) {
  const error = result.error as Record<string, unknown> | undefined;
  return {
    events_received: eventsReceived,
    messages: result.messages || undefined,
    fbtrace_id: result.fbtrace_id || error?.fbtrace_id || undefined,
    error_message: typeof error?.message === "string" ? error.message : undefined,
    error_type: typeof error?.type === "string" ? error.type : undefined,
    error_code: typeof error?.code === "number" ? error.code : undefined,
  };
}

function logMetaConversionAttempt(details: {
  eventName: EventName | null;
  mode: SendMode;
  count: number;
  httpStatus?: number;
  error?: string;
}) {
  const logPayload = {
    event_name: details.eventName || "all",
    mode: details.mode,
    count: details.count,
    http_status: details.httpStatus || null,
    error: details.error || null,
  };

  if (details.error) {
    console.error("[meta-conversions/send]", logPayload);
  } else {
    console.info("[meta-conversions/send]", logPayload);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const mode = normalizeMode(body?.mode);

    if (mode === "send" && !normalizeSecret(process.env.META_CONVERSIONS_SECRET)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Envio Meta desactivado: faltan variables de entorno.",
          message: "Envio Meta desactivado: faltan variables de entorno.",
          missing: ["META_CONVERSIONS_SECRET"],
          mode,
          event_name: normalizeEventName(body?.event_name) || "all",
          found: 0,
          attempted: 0,
          tested: 0,
          errors: 0,
          meta_response: metaSummary({}, 0),
          test_mode: false,
        },
        { status: 503 }
      );
    }

    const authorization = await authorizeRequest(request, mode);

    if (!authorization.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: authorization.error,
          message: authorization.error,
          mode,
          event_name: normalizeEventName(body?.event_name) || "all",
          found: 0,
          attempted: 0,
          tested: 0,
          errors: 0,
          missing: [],
          meta_response: metaSummary({}, 0),
        },
        { status: authorization.status }
      );
    }

    const config = environmentConfig(mode);
    if (config.missing.length > 0 && mode !== "dry_run") {
      logMetaConversionAttempt({
        eventName: normalizeEventName(body?.event_name),
        mode,
        count: 0,
        httpStatus: 503,
        error: `Missing env: ${config.missing.join(", ")}`,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Envio Meta desactivado: faltan variables de entorno.",
          message: "Envio Meta desactivado: faltan variables de entorno.",
          missing: config.missing,
          mode,
          event_name: normalizeEventName(body?.event_name) || "all",
          found: 0,
          attempted: 0,
          tested: 0,
          errors: 0,
          meta_response: metaSummary({}, 0),
          test_mode: mode === "test",
        },
        { status: 503 }
      );
    }

    const limit = Math.min(Math.max(Number(body?.limit || 25), 1), 100);
    const eventName = normalizeEventName(body?.event_name);
    const status = normalizeStatus(body?.status);
    const eventIds = selectedEventIds(body?.event_ids);

    if (body?.event_name && !eventName) {
      return NextResponse.json(
        {
          ok: false,
          error: "event_name invalido. Usa Lead, Schedule, QualifiedLead o Purchase.",
          message: "event_name invalido. Usa Lead, Schedule, QualifiedLead o Purchase.",
          mode,
          event_name: "invalid",
          found: 0,
          attempted: 0,
          tested: 0,
          errors: 0,
          missing: [],
          meta_response: metaSummary({}, 0),
        },
        { status: 400 }
      );
    }

    let query = supabaseAdmin
      .from("meta_conversion_events")
      .select("id, whatsapp_lead_id, event_name, event_time, event_value, currency, event_id, payload_preview, meta_ctwa_clid, status")
      .neq("status", "sent")
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (eventName) query = query.eq("event_name", eventName);
    if (eventIds.length > 0) query = query.in("event_id", eventIds);

    const { data: eventsData, error: eventsError } = await query;
    if (eventsError) throw eventsError;

    const events = (eventsData || []) as ConversionRow[];
    if (!events.length) {
      logMetaConversionAttempt({
        eventName,
        mode,
        count: 0,
        httpStatus: 200,
      });

      return NextResponse.json({
        ok: true,
        mode,
        event_name: eventName || "all",
        found: 0,
        attempted: 0,
        tested: 0,
        errors: 0,
        missing: [],
        meta_response: metaSummary({}, 0),
        dataset_env: config.datasetEnvName,
        dataset_id: config.datasetId,
        api_version: config.apiVersion,
        test_event_code_configured: Boolean(config.testEventCode),
        test_mode: mode === "test",
        selected: 0,
        sent: 0,
        failed: 0,
        sent_test: 0,
        message: "No hay eventos pendientes para los filtros indicados.",
        summary: {
          candidates_found: 0,
          sent_to_meta_test: 0,
          sent_to_meta: 0,
          failed: 0,
          status_not_changed: mode === "test",
          meta: metaSummary({}, 0),
        },
      });
    }

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
    if (mode === "test") payload.test_event_code = config.testEventCode;

    if (mode === "dry_run") {
      return NextResponse.json({
        ok: true,
        mode,
        event_name: eventName || "all",
        found: events.length,
        attempted: 0,
        tested: 0,
        errors: 0,
        missing: config.missing,
        meta_response: metaSummary({}, 0),
        dataset_env: config.datasetEnvName,
        dataset_id: config.datasetId,
        api_version: config.apiVersion,
        test_event_code_configured: Boolean(config.testEventCode),
        message: "Vista previa generada. No se enviaron eventos a Meta.",
        test_mode: false,
        selected: events.length,
        sent: 0,
        failed: 0,
        ready_to_send: config.missing.length === 0,
        payload_preview: safePayloadForResponse(payload, false),
        event_ids: events.map((event) => event.event_id),
      });
    }

    const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.datasetId}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    const eventsReceived = Number(result?.events_received || 0);
    const metaAcceptedAll = response.ok && eventsReceived === events.length;
    const summary = {
      candidates_found: events.length,
      sent_to_meta_test: mode === "test" ? eventsReceived : 0,
      sent_to_meta: mode === "send" ? eventsReceived : 0,
      failed: metaAcceptedAll ? 0 : events.length,
      status_not_changed: mode === "test",
      meta: metaSummary(result, eventsReceived),
    };

    if (!metaAcceptedAll) {
      const errorMessage =
        typeof result?.error?.message === "string"
          ? result.error.message
          : response.ok
            ? `Meta recibio ${eventsReceived} de ${events.length} eventos.`
            : "Meta rechazo el lote de conversiones.";

      logMetaConversionAttempt({
        eventName,
        mode,
        count: events.length,
        httpStatus: response.status,
        error: errorMessage,
      });

      if (mode === "send") {
        await supabaseAdmin
          .from("meta_conversion_events")
          .update({
            status: "error",
            error_message: errorMessage,
          })
          .in("id", events.map((event) => event.id));
      }

      return NextResponse.json(
        {
          ok: false,
          mode,
          event_name: eventName || "all",
          found: events.length,
          attempted: events.length,
          tested: mode === "test" ? eventsReceived : 0,
          errors: events.length,
          missing: [],
          meta_response: summary.meta,
          dataset_env: config.datasetEnvName,
          dataset_id: config.datasetId,
          api_version: config.apiVersion,
          test_event_code_configured: Boolean(config.testEventCode),
          message: errorMessage,
          test_mode: mode === "test",
          error: errorMessage,
          selected: events.length,
          sent: 0,
          failed: events.length,
          sent_test: 0,
          meta: result,
          meta_summary: summary.meta,
          summary,
          status_not_changed: mode === "test",
        },
        { status: 502 }
      );
    }

    if (mode === "send") {
      await supabaseAdmin
        .from("meta_conversion_events")
        .update({
          status: "sent",
          error_message: null,
          sent_at: new Date().toISOString(),
        })
        .in("id", events.map((event) => event.id));
    }

    logMetaConversionAttempt({
      eventName,
      mode,
      count: events.length,
      httpStatus: response.status,
    });

    return NextResponse.json({
      ok: true,
      mode,
      event_name: eventName || "all",
      found: events.length,
      attempted: events.length,
      tested: mode === "test" ? eventsReceived : 0,
      errors: 0,
      missing: [],
      meta_response: summary.meta,
      dataset_env: config.datasetEnvName,
      dataset_id: config.datasetId,
      api_version: config.apiVersion,
      test_event_code_configured: Boolean(config.testEventCode),
      message:
        mode === "test"
          ? "Prueba Meta completada. Los eventos no fueron marcados como sent."
          : "Envio Meta completado.",
      test_mode: mode === "test",
      selected: events.length,
      sent: mode === "send" ? events.length : 0,
      failed: 0,
      sent_test: mode === "test" ? eventsReceived : 0,
      meta_events_received: eventsReceived,
      meta: result,
      meta_summary: summary.meta,
      summary,
      status_not_changed: mode === "test",
      payload_preview: safePayloadForResponse(payload, mode === "test"),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, "No se pudieron enviar conversiones Meta.");
    return NextResponse.json(
      {
        ok: false,
        error: message,
        message,
        mode: "unknown",
        event_name: "unknown",
        found: 0,
        attempted: 0,
        tested: 0,
        errors: 1,
        missing: [],
        meta_response: metaSummary({}, 0),
      },
      { status: 500 }
    );
  }
}
