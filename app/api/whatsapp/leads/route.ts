import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set([
  "collecting_name",
  "collecting_email",
  "registered",
  "registrado",
  "felicitacion_programada",
  "felicitacion_enviada",
  "respondio_para_agendar",
  "pendiente_agendar",
  "esperando_preferencia_jornada",
  "esperando_dia_preferido",
  "ofreciendo_horarios",
  "esperando_confirmacion_horario",
  "en_gestion_callcenter",
  "agendado",
  "sin_respuesta",
  "requiere_template",
  "requiere_humano",
  "cerrado",
]);

const appointmentStatuses = new Set(["agendada", "confirmada", "reagendada", "en_espera", "asistio", "finalizada", "no_asistio"]);

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
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  reply_window_expires_at: string | null;
  safe_deadline_at: string | null;
  felicitation_scheduled_for: string | null;
  felicitation_sent_at: string | null;
  selected_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  priority: string | null;
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
};

type EnrichedWhatsappLeadRow = WhatsappLeadRow & {
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_status: string | null;
};

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

function appointmentTimestamp(item: Pick<AppointmentRow, "appointment_date" | "appointment_time">) {
  return `${item.appointment_date || "9999-12-31"}T${item.appointment_time || "23:59:59"}`;
}

function matchesAppointmentName(lead: WhatsappLeadRow, appointment: AppointmentRow) {
  const leadName = normalizeLookupText(`${lead.full_name || ""} ${lead.profile_name || ""}`);
  const appointmentName = normalizeLookupText(appointment.patient_name);
  if (!leadName || !appointmentName) return false;

  const appointmentTokens = appointmentName.split(" ").filter((token) => token.length >= 3);
  if (appointmentTokens.length < 3) return false;

  return appointmentTokens.every((token) => leadName.includes(token));
}

function chooseRelatedAppointment(appointments: AppointmentRow[]) {
  const activeStatuses = new Set(["agendada", "confirmada", "reagendada", "en_espera"]);
  const completedStatuses = new Set(["asistio", "finalizada", "no_asistio"]);
  const active = appointments
    .filter((item) => activeStatuses.has(item.status || ""))
    .sort((a, b) => appointmentTimestamp(a).localeCompare(appointmentTimestamp(b)));

  if (active[0]) return active[0];

  return appointments
    .filter((item) => completedStatuses.has(item.status || ""))
    .sort((a, b) => appointmentTimestamp(b).localeCompare(appointmentTimestamp(a)))[0] || null;
}

async function enrichWithAppointments(leads: WhatsappLeadRow[]): Promise<EnrichedWhatsappLeadRow[]> {
  if (!leads.length) return [];

  const leadIds = new Set(leads.map((lead) => lead.id));
  const phoneKeysByLeadId = new Map(
    leads.map((lead) => [lead.id, new Set(phoneLookupKeys(lead.phone))])
  );

  const { data: appointments, error } = await supabaseAdmin
    .from("appointments")
    .select("id, lead_id, patient_name, phone, appointment_date, appointment_time, status, notes, created_at")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(1500);

  if (error) throw error;

  return leads.map((lead) => {
    const phoneKeys = phoneKeysByLeadId.get(lead.id) || new Set<string>();
    const relatedAppointments = ((appointments || []) as AppointmentRow[]).filter((appointment) => {
      const notes = appointment.notes || "";
      const appointmentPhoneKeys = phoneLookupKeys(appointment.phone);
      const matchesPhone = appointmentPhoneKeys.some((key) => phoneKeys.has(key));
      const matchesWhatsappLead = leadIds.has(lead.id) && notes.includes(lead.id);
      const matchesName = matchesAppointmentName(lead, appointment);
      return matchesPhone || matchesWhatsappLead || matchesName;
    });
    const appointment = chooseRelatedAppointment(relatedAppointments);

    return {
      ...lead,
      appointment_id: appointment?.id || null,
      appointment_date: appointment?.appointment_date || null,
      appointment_time: appointment?.appointment_time || null,
      appointment_status: appointment?.status || null,
    };
  });
}

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
        "id, phone, profile_name, full_name, email, campaign_code, source, status, created_at, last_inbound_at, last_outbound_at, reply_window_expires_at, safe_deadline_at, felicitation_scheduled_for, felicitation_sent_at, selected_at, assigned_to, notes, priority"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    const statusFiltersAppointment = status ? appointmentStatuses.has(status) : false;

    if (status && allowedStatuses.has(status) && !statusFiltersAppointment) {
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

    const enrichedLeads = await enrichWithAppointments((data || []) as WhatsappLeadRow[]);
    const filteredLeads = statusFiltersAppointment
      ? enrichedLeads.filter((lead) => lead.appointment_status === status)
      : enrichedLeads;

    return NextResponse.json({
      ok: true,
      leads: filteredLeads,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
