import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import { getErrorMessage } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WhatsappLeadRow = {
  id: string;
  phone: string;
  profile_name: string | null;
  full_name: string | null;
  email: string | null;
  campaign_code: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  meta_adset_id: string | null;
  meta_adset_name: string | null;
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  meta_source_id: string | null;
  meta_source_url: string | null;
  meta_source_type: string | null;
  meta_ctwa_clid: string | null;
  meta_referral: Record<string, unknown> | null;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  patient_name: string | null;
  phone: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  attended_at: string | null;
};

type CommercialCaseRow = {
  id: string;
  lead_id: string | null;
  appointment_id: string | null;
  sale_result: string | null;
  sale_value: number | null;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  created_at: string | null;
  closed_at: string | null;
};

type ExistingConversionRow = {
  event_id: string;
  status: "pending" | "sent" | "error" | "skipped";
  error_message: string | null;
  sent_at: string | null;
};

type ConversionCandidate = {
  event_id: string;
  event_name: "Lead" | "Schedule" | "QualifiedLead" | "Purchase";
  event_label: string;
  event_time: string;
  event_value: number | null;
  currency: string | null;
  whatsapp_lead_id: string;
  appointment_id: string | null;
  commercial_case_id: string | null;
  lead_name: string;
  phone: string;
  email: string | null;
  meta_ctwa_clid: string | null;
  meta_source_id: string | null;
  meta_ad_id: string | null;
  meta_ad_name: string | null;
  meta_campaign_name: string | null;
  meta_source_url: string | null;
  report_status: "candidate" | "pending" | "sent" | "error" | "skipped" | "not_reportable";
  error_message: string | null;
  sent_at: string | null;
  reportable: boolean;
  reportable_reason: string | null;
  payload_preview: Record<string, unknown>;
};

const activeAppointmentStatuses = new Set([
  "agendada",
  "confirmada",
  "reagendada",
  "en_espera",
  "en_atencion",
  "asistio",
  "finalizada",
  "no_asistio",
]);

function normalizeTextParam(value: string | null) {
  const normalized = (value || "").trim();
  return normalized || null;
}

function normalizeDateParam(value: string | null) {
  const normalized = normalizeTextParam(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeLookupText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneDigits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function phoneLookupKeys(value: string | null | undefined) {
  const digits = phoneDigits(value);
  if (!digits) return [];
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return Array.from(new Set([digits, local, local ? `57${local}` : ""].filter(Boolean)));
}

function stableEventId(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "none").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_"))
    .join(":");
}

function sha256(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

function normalizedPhoneForMeta(value: string | null | undefined) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local ? `57${local}` : digits;
}

function leadName(lead: WhatsappLeadRow) {
  return lead.full_name || lead.profile_name || "Sin nombre";
}

function appointmentTimestamp(item: Pick<AppointmentRow, "appointment_date" | "appointment_time">) {
  return `${item.appointment_date || "9999-12-31"}T${item.appointment_time || "23:59:59"}`;
}

function appointmentEventTime(appointment: AppointmentRow) {
  if (appointment.created_at) return appointment.created_at;
  if (appointment.appointment_date && appointment.appointment_time) {
    return new Date(`${appointment.appointment_date}T${appointment.appointment_time.slice(0, 5)}:00-05:00`).toISOString();
  }
  return new Date().toISOString();
}

function attendanceEventTime(appointment: AppointmentRow) {
  if (appointment.attended_at) return appointment.attended_at;
  if (appointment.appointment_date && appointment.appointment_time) {
    return new Date(`${appointment.appointment_date}T${appointment.appointment_time.slice(0, 5)}:00-05:00`).toISOString();
  }
  return appointment.created_at || new Date().toISOString();
}

function matchesAppointmentName(lead: WhatsappLeadRow, appointment: AppointmentRow) {
  const currentLeadName = normalizeLookupText(`${lead.full_name || ""} ${lead.profile_name || ""}`);
  const currentAppointmentName = normalizeLookupText(appointment.patient_name);
  if (!currentLeadName || !currentAppointmentName) return false;
  const tokens = currentAppointmentName.split(" ").filter((token) => token.length >= 3);
  if (tokens.length < 3) return false;
  return tokens.every((token) => currentLeadName.includes(token));
}

function chooseRelatedAppointment(appointments: AppointmentRow[]) {
  const active = appointments
    .filter((item) => activeAppointmentStatuses.has(item.status || ""))
    .sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)));

  return active[0] || null;
}

function isSale(caseRow: CommercialCaseRow) {
  return (
    caseRow.sale_result === "ganada" ||
    caseRow.sale_result === "venta_realizada" ||
    Number(caseRow.volume_amount || 0) > 0 ||
    Number(caseRow.cash_amount || 0) > 0 ||
    Number(caseRow.portfolio_amount || 0) > 0
  );
}

function matchesTextFilter(filter: string | null, values: Array<string | null>) {
  if (!filter) return true;
  const normalizedFilter = normalizeLookupText(filter);
  return values.some((value) => normalizeLookupText(value).includes(normalizedFilter));
}

function candidatePreview(candidate: Omit<ConversionCandidate, "payload_preview">) {
  const phoneHash = sha256(normalizedPhoneForMeta(candidate.phone));
  const emailHash = sha256(candidate.email);

  return {
    event_name: candidate.event_name,
    event_time: candidate.event_time,
    event_id: candidate.event_id,
    action_source: "business_messaging",
    user_data: {
      ph: phoneHash ? [phoneHash] : [],
      em: emailHash ? [emailHash] : [],
      ctwa_clid: candidate.meta_ctwa_clid || null,
    },
    custom_data: {
      value: candidate.event_value,
      currency: candidate.currency,
      content_name: candidate.event_label,
      meta_source_id: candidate.meta_source_id,
      meta_ad_id: candidate.meta_ad_id,
    },
  };
}

async function buildCandidates(request: Request): Promise<ConversionCandidate[]> {
  const { searchParams } = new URL(request.url);
  const dateFrom = normalizeDateParam(searchParams.get("date_from"));
  const dateTo = normalizeDateParam(searchParams.get("date_to"));
  const campaignFilter = normalizeTextParam(searchParams.get("campaign"));
  const adFilter = normalizeTextParam(searchParams.get("ad"));
  const statusFilter = normalizeTextParam(searchParams.get("status"));

  let leadsQuery = supabaseAdmin
    .from("whatsapp_leads")
    .select(
      "id, phone, profile_name, full_name, email, campaign_code, status, created_at, updated_at, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name, meta_ad_id, meta_ad_name, meta_source_id, meta_source_url, meta_source_type, meta_ctwa_clid, meta_referral"
    )
    .order("created_at", { ascending: false })
    .limit(3000);

  if (dateFrom) leadsQuery = leadsQuery.gte("created_at", `${dateFrom}T00:00:00-05:00`);
  if (dateTo) leadsQuery = leadsQuery.lte("created_at", `${dateTo}T23:59:59.999-05:00`);

  const { data: leadsData, error: leadsError } = await leadsQuery;
  if (leadsError) throw leadsError;

  const leads = ((leadsData || []) as WhatsappLeadRow[]).filter((lead) => {
    if (!matchesTextFilter(campaignFilter, [lead.campaign_code, lead.meta_campaign_id, lead.meta_campaign_name])) {
      return false;
    }
    if (!matchesTextFilter(adFilter, [lead.meta_ad_id, lead.meta_ad_name, lead.meta_source_id, lead.meta_source_url])) {
      return false;
    }
    if (statusFilter && lead.status !== statusFilter) return false;
    return true;
  });

  if (!leads.length) return [];

  const [{ data: appointmentsData, error: appointmentsError }] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("id, lead_id, patient_name, phone, appointment_date, appointment_time, status, notes, created_at, attended_at")
      .order("appointment_date", { ascending: false })
      .limit(5000),
  ]);

  if (appointmentsError) throw appointmentsError;

  const appointments = (appointmentsData || []) as AppointmentRow[];
  const appointmentsByLeadId = new Map<string, AppointmentRow[]>();
  const appointmentsByPhoneKey = new Map<string, AppointmentRow[]>();

  appointments.forEach((appointment) => {
    if (appointment.lead_id) {
      const existing = appointmentsByLeadId.get(appointment.lead_id) || [];
      existing.push(appointment);
      appointmentsByLeadId.set(appointment.lead_id, existing);
    }

    phoneLookupKeys(appointment.phone).forEach((key) => {
      const existing = appointmentsByPhoneKey.get(key) || [];
      existing.push(appointment);
      appointmentsByPhoneKey.set(key, existing);
    });
  });

  const appointmentByLeadId = new Map<string, AppointmentRow | null>();
  leads.forEach((lead) => {
    const related = new Map<string, AppointmentRow>();
    (appointmentsByLeadId.get(lead.id) || []).forEach((appointment) => related.set(appointment.id, appointment));
    phoneLookupKeys(lead.phone).forEach((key) => {
      (appointmentsByPhoneKey.get(key) || []).forEach((appointment) => related.set(appointment.id, appointment));
    });
    appointments
      .filter((appointment) => (appointment.notes || "").includes(lead.id) || matchesAppointmentName(lead, appointment))
      .forEach((appointment) => related.set(appointment.id, appointment));
    appointmentByLeadId.set(lead.id, chooseRelatedAppointment(Array.from(related.values())));
  });

  const relatedAppointments = Array.from(
    new Map(
      Array.from(appointmentByLeadId.values())
        .filter(Boolean)
        .map((appointment) => [(appointment as AppointmentRow).id, appointment as AppointmentRow])
    ).values()
  );
  const appointmentIds = relatedAppointments.map((appointment) => appointment.id);
  const appointmentLeadIds = Array.from(
    new Set(relatedAppointments.map((appointment) => appointment.lead_id).filter(Boolean) as string[])
  );
  const commercialFilters = [];
  if (appointmentIds.length) commercialFilters.push(`appointment_id.in.(${appointmentIds.join(",")})`);
  if (appointmentLeadIds.length) commercialFilters.push(`lead_id.in.(${appointmentLeadIds.join(",")})`);

  const { data: commercialData, error: commercialError } = commercialFilters.length
    ? await supabaseAdmin
        .from("commercial_cases")
        .select("id, lead_id, appointment_id, sale_result, sale_value, volume_amount, cash_amount, portfolio_amount, created_at, closed_at")
        .or(commercialFilters.join(","))
        .limit(5000)
    : { data: [], error: null };

  if (commercialError) throw commercialError;

  const commercialByAppointmentId = new Map<string, CommercialCaseRow[]>();
  const commercialByLeadId = new Map<string, CommercialCaseRow[]>();
  ((commercialData || []) as CommercialCaseRow[]).forEach((caseRow) => {
    if (caseRow.appointment_id) {
      const existing = commercialByAppointmentId.get(caseRow.appointment_id) || [];
      existing.push(caseRow);
      commercialByAppointmentId.set(caseRow.appointment_id, existing);
    }
    if (caseRow.lead_id) {
      const existing = commercialByLeadId.get(caseRow.lead_id) || [];
      existing.push(caseRow);
      commercialByLeadId.set(caseRow.lead_id, existing);
    }
  });

  const candidates: ConversionCandidate[] = [];

  leads.forEach((lead) => {
    const appointment = appointmentByLeadId.get(lead.id) || null;
    const base = {
      whatsapp_lead_id: lead.id,
      lead_name: leadName(lead),
      phone: lead.phone,
      email: lead.email,
      meta_ctwa_clid: lead.meta_ctwa_clid,
      meta_source_id: lead.meta_source_id,
      meta_ad_id: lead.meta_ad_id,
      meta_ad_name: lead.meta_ad_name,
      meta_campaign_name: lead.meta_campaign_name || lead.campaign_code,
      meta_source_url: lead.meta_source_url,
      report_status: "candidate" as const,
      error_message: null,
      sent_at: null,
      reportable: Boolean(lead.phone || lead.email),
      reportable_reason: lead.phone || lead.email ? null : "Falta telefono o correo para user_data.",
    };

    if (lead.email) {
      const candidate = {
        ...base,
        event_id: stableEventId(["prevital", "lead", lead.id]),
        event_name: "Lead" as const,
        event_label: "Lead completo",
        event_time: lead.updated_at || lead.created_at || new Date().toISOString(),
        event_value: null,
        currency: null,
        appointment_id: null,
        commercial_case_id: null,
      };
      candidates.push({ ...candidate, payload_preview: candidatePreview(candidate) });
    }

    if (appointment && activeAppointmentStatuses.has(appointment.status || "")) {
      const candidate = {
        ...base,
        event_id: stableEventId(["prevital", "schedule", lead.id, appointment.id]),
        event_name: "Schedule" as const,
        event_label: "Cita agendada",
        event_time: appointmentEventTime(appointment),
        event_value: null,
        currency: null,
        appointment_id: appointment.id,
        commercial_case_id: null,
      };
      candidates.push({ ...candidate, payload_preview: candidatePreview(candidate) });
    }

    if (appointment?.status === "asistio" || appointment?.status === "finalizada") {
      const candidate = {
        ...base,
        event_id: stableEventId(["prevital", "qualifiedlead", lead.id, appointment.id]),
        event_name: "QualifiedLead" as const,
        event_label: "Asistio",
        event_time: attendanceEventTime(appointment),
        event_value: null,
        currency: null,
        appointment_id: appointment.id,
        commercial_case_id: null,
      };
      candidates.push({ ...candidate, payload_preview: candidatePreview(candidate) });
    }

    const relatedCases = appointment
      ? [
          ...(commercialByAppointmentId.get(appointment.id) || []),
          ...(appointment.lead_id ? commercialByLeadId.get(appointment.lead_id) || [] : []),
        ]
      : [];
    const sales = Array.from(new Map(relatedCases.map((item) => [item.id, item])).values()).filter(isSale);

    sales.forEach((caseRow) => {
      const value = Number(caseRow.volume_amount || caseRow.sale_value || caseRow.cash_amount || 0);
      const candidate = {
        ...base,
        event_id: stableEventId(["prevital", "purchase", lead.id, appointment?.id, caseRow.id]),
        event_name: "Purchase" as const,
        event_label: "Compra",
        event_time: caseRow.closed_at || caseRow.created_at || new Date().toISOString(),
        event_value: value || null,
        currency: "COP",
        appointment_id: appointment?.id || null,
        commercial_case_id: caseRow.id,
      };
      candidates.push({ ...candidate, payload_preview: candidatePreview(candidate) });
    });
  });

  if (!candidates.length) return [];

  const eventIds = candidates.map((candidate) => candidate.event_id);
  const { data: existingData, error: existingError } = await supabaseAdmin
    .from("meta_conversion_events")
    .select("event_id, status, error_message, sent_at")
    .in("event_id", eventIds);

  if (existingError) throw existingError;

  const existingByEventId = new Map(
    ((existingData || []) as ExistingConversionRow[]).map((item) => [item.event_id, item])
  );

  return candidates.map((candidate) => {
    const existing = existingByEventId.get(candidate.event_id);
    if (!candidate.reportable) return { ...candidate, report_status: "not_reportable" };
    if (!existing) return candidate;
    return {
      ...candidate,
      report_status: existing.status,
      error_message: existing.error_message,
      sent_at: existing.sent_at,
    };
  });
}

export async function GET(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const candidates = await buildCandidates(request);
    return NextResponse.json({
      ok: true,
      candidates,
      summary: {
        total: candidates.length,
        candidate: candidates.filter((item) => item.report_status === "candidate").length,
        pending: candidates.filter((item) => item.report_status === "pending").length,
        sent: candidates.filter((item) => item.report_status === "sent").length,
        error: candidates.filter((item) => item.report_status === "error").length,
        not_reportable: candidates.filter((item) => item.report_status === "not_reportable").length,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudieron cargar conversiones Meta.") },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();
    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json().catch(() => null);
    const requestedIds = Array.isArray(body?.event_ids)
      ? new Set(body.event_ids.map((item: unknown) => String(item || "")))
      : new Set<string>();

    if (requestedIds.size === 0) {
      return NextResponse.json({ error: "Selecciona al menos una conversion." }, { status: 400 });
    }

    const candidates = await buildCandidates(request);
    const selected = candidates.filter((candidate) => requestedIds.has(candidate.event_id));

    const sentIds = selected
      .filter((candidate) => candidate.report_status === "sent")
      .map((candidate) => candidate.event_id);
    const insertable = selected.filter(
      (candidate) => candidate.reportable && candidate.report_status !== "sent"
    );

    if (!insertable.length) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped: requestedIds.size,
        sent_ids: sentIds,
      });
    }

    const rows = insertable.map((candidate) => ({
      whatsapp_lead_id: candidate.whatsapp_lead_id,
      appointment_id: candidate.appointment_id,
      commercial_case_id: candidate.commercial_case_id,
      event_name: candidate.event_name,
      event_time: candidate.event_time,
      event_value: candidate.event_value,
      currency: candidate.currency,
      meta_ctwa_clid: candidate.meta_ctwa_clid,
      meta_source_id: candidate.meta_source_id,
      meta_ad_id: candidate.meta_ad_id,
      event_id: candidate.event_id,
      payload_preview: candidate.payload_preview,
      status: "pending",
      error_message: null,
      sent_at: null,
    }));

    const { error } = await supabaseAdmin
      .from("meta_conversion_events")
      .upsert(rows, { onConflict: "event_id" });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      inserted: rows.length,
      skipped: requestedIds.size - rows.length,
      sent_ids: sentIds,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudieron preparar conversiones Meta.") },
      { status: 500 }
    );
  }
}
