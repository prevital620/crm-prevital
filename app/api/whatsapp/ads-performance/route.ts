import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";
import { getErrorMessage } from "@/lib/server/user-security";

export const dynamic = "force-dynamic";

type WhatsappLeadRow = {
  id: string;
  phone: string;
  profile_name: string | null;
  full_name: string | null;
  email: string | null;
  campaign_code: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
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

type WhatsappMessageRow = {
  phone: string | null;
  created_at: string | null;
  payload: Record<string, unknown> | null;
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
};

type Attribution = {
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  sourceType: string | null;
  ctwaClid: string | null;
  referral: Record<string, unknown> | null;
};

type ReportRow = {
  key: string;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  source_id: string | null;
  source_url: string | null;
  source_type: string | null;
  conversations: number;
  completed_registrations: number;
  scheduled_appointments: number;
  attended: number;
  no_show: number;
  purchases: number;
  volume_sold: number;
  cash: number;
  portfolio: number;
};

const appointmentStatuses = new Set([
  "agendada",
  "confirmada",
  "reagendada",
  "en_espera",
  "asistio",
  "finalizada",
  "no_asistio",
  "en_atencion",
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return null;
}

function referralFromPayload(payload: Record<string, unknown> | null) {
  const direct = asRecord(payload?.referral);
  if (direct) return direct;
  const message = asRecord(payload?.message);
  return asRecord(message?.referral);
}

function attributionFromReferral(referral: Record<string, unknown> | null): Attribution {
  const adsContext = asRecord(referral?.ads_context_data);
  const campaign = asRecord(referral?.campaign);
  const adset = asRecord(referral?.adset);
  const ad = asRecord(referral?.ad);

  return {
    campaignId: firstString(referral?.campaign_id, adsContext?.campaign_id, campaign?.id),
    campaignName: firstString(referral?.campaign_name, adsContext?.campaign_name, campaign?.name),
    adsetId: firstString(referral?.adset_id, adsContext?.adset_id, adset?.id),
    adsetName: firstString(referral?.adset_name, adsContext?.adset_name, adset?.name),
    adId: firstString(referral?.ad_id, adsContext?.ad_id, ad?.id, referral?.source_id),
    adName: firstString(
      referral?.ad_name,
      adsContext?.ad_name,
      adsContext?.ad_title,
      ad?.name,
      referral?.headline
    ),
    sourceId: firstString(referral?.source_id),
    sourceUrl: firstString(referral?.source_url),
    sourceType: firstString(referral?.source_type),
    ctwaClid: firstString(referral?.ctwa_clid),
    referral,
  };
}

function attributionFromLead(lead: WhatsappLeadRow, messageReferral: Record<string, unknown> | null): Attribution {
  const fallback = attributionFromReferral(messageReferral);

  return {
    campaignId: lead.meta_campaign_id || fallback.campaignId,
    campaignName: lead.meta_campaign_name || fallback.campaignName || lead.campaign_code,
    adsetId: lead.meta_adset_id || fallback.adsetId,
    adsetName: lead.meta_adset_name || fallback.adsetName,
    adId: lead.meta_ad_id || fallback.adId || lead.meta_source_id,
    adName: lead.meta_ad_name || fallback.adName,
    sourceId: lead.meta_source_id || fallback.sourceId,
    sourceUrl: lead.meta_source_url || fallback.sourceUrl,
    sourceType: lead.meta_source_type || fallback.sourceType,
    ctwaClid: lead.meta_ctwa_clid || fallback.ctwaClid,
    referral: lead.meta_referral || fallback.referral,
  };
}

function appointmentTimestamp(item: Pick<AppointmentRow, "appointment_date" | "appointment_time">) {
  return `${item.appointment_date || "9999-12-31"}T${item.appointment_time || "23:59:59"}`;
}

function matchesAppointmentName(lead: WhatsappLeadRow, appointment: AppointmentRow) {
  const leadName = normalizeLookupText(`${lead.full_name || ""} ${lead.profile_name || ""}`);
  const appointmentName = normalizeLookupText(appointment.patient_name);
  if (!leadName || !appointmentName) return false;
  const tokens = appointmentName.split(" ").filter((token) => token.length >= 3);
  if (tokens.length < 3) return false;
  return tokens.every((token) => leadName.includes(token));
}

function chooseRelatedAppointment(appointments: AppointmentRow[]) {
  const activeStatuses = new Set(["agendada", "confirmada", "reagendada", "en_espera", "en_atencion"]);
  const active = appointments
    .filter((item) => activeStatuses.has(item.status || ""))
    .sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)));

  if (active[0]) return active[0];

  return appointments
    .filter((item) => appointmentStatuses.has(item.status || ""))
    .sort((a, b) => appointmentTimestamp(b).localeCompare(appointmentTimestamp(a)))[0] || null;
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

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function matchesTextFilter(filter: string | null, values: Array<string | null>) {
  if (!filter) return true;
  const normalizedFilter = normalizeLookupText(filter);
  return values.some((value) => normalizeLookupText(value).includes(normalizedFilter));
}

function emptyReportRow(attribution: Attribution): ReportRow {
  const key =
    attribution.adId ||
    attribution.sourceId ||
    attribution.sourceUrl ||
    attribution.adName ||
    attribution.campaignName ||
    "sin_dato_anuncio";

  return {
    key,
    campaign_id: attribution.campaignId,
    campaign_name: attribution.campaignName,
    adset_id: attribution.adsetId,
    adset_name: attribution.adsetName,
    ad_id: attribution.adId,
    ad_name: attribution.adName,
    source_id: attribution.sourceId,
    source_url: attribution.sourceUrl,
    source_type: attribution.sourceType,
    conversations: 0,
    completed_registrations: 0,
    scheduled_appointments: 0,
    attended: 0,
    no_show: 0,
    purchases: 0,
    volume_sold: 0,
    cash: 0,
    portfolio: 0,
  };
}

export async function GET(request: Request) {
  try {
    const authCheck = await requireWhatsappLeadsAccess();

    if (!authCheck.ok) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = normalizeDateParam(searchParams.get("date_from"));
    const dateTo = normalizeDateParam(searchParams.get("date_to"));
    const campaignFilter = normalizeTextParam(searchParams.get("campaign"));
    const adFilter = normalizeTextParam(searchParams.get("ad"));
    const statusFilter = normalizeTextParam(searchParams.get("status"));

    let leadsQuery = supabaseAdmin
      .from("whatsapp_leads")
      .select(
        "id, phone, profile_name, full_name, email, campaign_code, source, status, created_at, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name, meta_ad_id, meta_ad_name, meta_source_id, meta_source_url, meta_source_type, meta_ctwa_clid, meta_referral"
      )
      .order("created_at", { ascending: false })
      .limit(3000);

    if (dateFrom) leadsQuery = leadsQuery.gte("created_at", `${dateFrom}T00:00:00-05:00`);
    if (dateTo) leadsQuery = leadsQuery.lte("created_at", `${dateTo}T23:59:59.999-05:00`);

    const { data: leadsData, error: leadsError } = await leadsQuery;
    if (leadsError) throw leadsError;

    const leads = (leadsData || []) as WhatsappLeadRow[];
    const leadPhones = Array.from(new Set(leads.map((lead) => lead.phone).filter(Boolean)));

    const [{ data: messagesData, error: messagesError }, { data: appointmentsData, error: appointmentsError }] =
      await Promise.all([
        leadPhones.length
          ? supabaseAdmin
              .from("whatsapp_messages")
              .select("phone, created_at, payload")
              .eq("direction", "inbound")
              .in("phone", leadPhones)
              .order("created_at", { ascending: true })
              .limit(5000)
          : Promise.resolve({ data: [], error: null }),
        supabaseAdmin
          .from("appointments")
          .select("id, lead_id, patient_name, phone, appointment_date, appointment_time, status, notes")
          .order("appointment_date", { ascending: false })
          .limit(5000),
      ]);

    if (messagesError) throw messagesError;
    if (appointmentsError) throw appointmentsError;

    const referralByPhone = new Map<string, Record<string, unknown>>();
    ((messagesData || []) as WhatsappMessageRow[]).forEach((message) => {
      const phone = message.phone || "";
      if (!phone || referralByPhone.has(phone)) return;
      const referral = referralFromPayload(message.payload);
      if (referral) referralByPhone.set(phone, referral);
    });

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

    const relatedAppointmentByLeadId = new Map<string, AppointmentRow | null>();
    leads.forEach((lead) => {
      const related = new Map<string, AppointmentRow>();
      (appointmentsByLeadId.get(lead.id) || []).forEach((appointment) => related.set(appointment.id, appointment));
      phoneLookupKeys(lead.phone).forEach((key) => {
        (appointmentsByPhoneKey.get(key) || []).forEach((appointment) => related.set(appointment.id, appointment));
      });
      appointments
        .filter((appointment) => {
          const notes = appointment.notes || "";
          return notes.includes(lead.id) || matchesAppointmentName(lead, appointment);
        })
        .forEach((appointment) => related.set(appointment.id, appointment));

      relatedAppointmentByLeadId.set(lead.id, chooseRelatedAppointment(Array.from(related.values())));
    });

    const relatedAppointments = Array.from(
      new Map(
        Array.from(relatedAppointmentByLeadId.values())
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
          .select("id, lead_id, appointment_id, sale_result, sale_value, volume_amount, cash_amount, portfolio_amount")
          .or(commercialFilters.join(","))
          .limit(5000)
      : { data: [], error: null };

    if (commercialError) throw commercialError;

    const commercialCases = (commercialData || []) as CommercialCaseRow[];
    const commercialByAppointmentId = new Map<string, CommercialCaseRow[]>();
    const commercialByLeadId = new Map<string, CommercialCaseRow[]>();

    commercialCases.forEach((caseRow) => {
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

    const rowsByKey = new Map<string, ReportRow>();

    leads.forEach((lead) => {
      const appointment = relatedAppointmentByLeadId.get(lead.id) || null;

      if (statusFilter) {
        const appointmentStatus = appointment?.status || null;
        if (lead.status !== statusFilter && appointmentStatus !== statusFilter) return;
      }

      const attribution = attributionFromLead(lead, referralByPhone.get(lead.phone) || null);
      if (
        !matchesTextFilter(campaignFilter, [
          lead.campaign_code,
          attribution.campaignId,
          attribution.campaignName,
        ]) ||
        !matchesTextFilter(adFilter, [
          attribution.adId,
          attribution.adName,
          attribution.sourceId,
          attribution.sourceUrl,
        ])
      ) {
        return;
      }

      const base = emptyReportRow(attribution);
      const current = rowsByKey.get(base.key) || base;
      current.conversations += 1;

      if (lead.email) current.completed_registrations += 1;

      if (appointment && appointmentStatuses.has(appointment.status || "")) {
        current.scheduled_appointments += 1;
      }
      if (appointment?.status === "asistio" || appointment?.status === "finalizada") {
        current.attended += 1;
      }
      if (appointment?.status === "no_asistio") {
        current.no_show += 1;
      }

      const relatedCases = appointment
        ? [
            ...(commercialByAppointmentId.get(appointment.id) || []),
            ...(appointment.lead_id ? commercialByLeadId.get(appointment.lead_id) || [] : []),
          ]
        : [];
      const uniqueCases = Array.from(new Map(relatedCases.map((item) => [item.id, item])).values());
      const sales = uniqueCases.filter(isSale);

      current.purchases += sales.length;
      current.volume_sold += sales.reduce((total, item) => total + Number(item.volume_amount || item.sale_value || 0), 0);
      current.cash += sales.reduce((total, item) => total + Number(item.cash_amount || 0), 0);
      current.portfolio += sales.reduce((total, item) => total + Number(item.portfolio_amount || 0), 0);

      rowsByKey.set(current.key, current);
    });

    const rows = Array.from(rowsByKey.values())
      .map((row) => ({
        ...row,
        appointment_rate: rate(row.scheduled_appointments, row.conversations),
        attendance_rate: rate(row.attended, row.scheduled_appointments),
        purchase_rate: rate(row.purchases, row.attended || row.scheduled_appointments),
      }))
      .sort((a, b) => b.conversations - a.conversations || b.scheduled_appointments - a.scheduled_appointments);

    const totals = rows.reduce(
      (acc, row) => {
        acc.conversations += row.conversations;
        acc.completed_registrations += row.completed_registrations;
        acc.scheduled_appointments += row.scheduled_appointments;
        acc.attended += row.attended;
        acc.no_show += row.no_show;
        acc.purchases += row.purchases;
        acc.volume_sold += row.volume_sold;
        acc.cash += row.cash;
        acc.portfolio += row.portfolio;
        return acc;
      },
      {
        conversations: 0,
        completed_registrations: 0,
        scheduled_appointments: 0,
        attended: 0,
        no_show: 0,
        purchases: 0,
        volume_sold: 0,
        cash: 0,
        portfolio: 0,
      }
    );

    return NextResponse.json({
      ok: true,
      rows,
      totals: {
        ...totals,
        appointment_rate: rate(totals.scheduled_appointments, totals.conversations),
        attendance_rate: rate(totals.attended, totals.scheduled_appointments),
        purchase_rate: rate(totals.purchases, totals.attended || totals.scheduled_appointments),
      },
      meta: {
        attribution_source:
          "Meta WhatsApp referral; nombres de campana/adset solo aparecen si Meta los envia.",
        sales_source:
          "Compras, volumen, caja y cartera se cruzan con commercial_cases por appointment_id o lead_id de la cita.",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No se pudo cargar el reporte de pauta.") },
      { status: 500 }
    );
  }
}
