import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireAgendaSchedulingAccess } from "@/lib/server/agenda-access";
import {
  getCommercialAgendaAvailability,
  normalizeAgendaDate,
  normalizeAgendaTime,
  normalizeCommercialServiceType,
} from "@/lib/server/agenda-scheduling";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeRequiredText(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizePhone(value: unknown) {
  const normalized = String(value || "").replace(/[^\d]/g, "");
  return normalized || null;
}

function normalizeOptionalId(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

async function findRelatedLeadId(phone: string) {
  const phoneCandidates = Array.from(
    new Set([phone, phone.startsWith("57") ? phone.slice(2) : ""].filter(Boolean))
  );

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id")
    .in("phone", phoneCandidates)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  return data?.[0]?.id || null;
}

export async function POST(request: Request) {
  try {
    const authCheck = await requireAgendaSchedulingAccess(request);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const body = await request.json().catch(() => null);
    const phone = normalizePhone(body?.phone);
    const fullName = normalizeRequiredText(body?.full_name);
    const email = normalizeRequiredText(body?.email);
    const date = normalizeAgendaDate(body?.date);
    const time = normalizeAgendaTime(body?.time);
    const serviceType = normalizeCommercialServiceType(body?.service_type);
    const source = normalizeRequiredText(body?.source) || "whatsapp_ai";
    const whatsappLeadId = normalizeOptionalId(body?.whatsapp_lead_id);

    if (!phone || !fullName || !date || !time) {
      return NextResponse.json(
        {
          error:
            "Debes indicar phone, full_name, date y time para agendar la cita.",
        },
        { status: 400 }
      );
    }

    if (serviceType !== "valoracion") {
      return NextResponse.json(
        { error: "Por ahora la agenda WhatsApp IA solo permite service_type=valoracion." },
        { status: 400 }
      );
    }

    const availability = await getCommercialAgendaAvailability({
      date,
      serviceType,
    });
    const selectedSlot = availability.slots.find((slot) => slot.time === time);

    if (!selectedSlot || !selectedSlot.available || selectedSlot.remaining <= 0) {
      return NextResponse.json(
        {
          error:
            "Ese horario ya no tiene cupo disponible. Consulta la disponibilidad y elige otro horario.",
        },
        { status: 409 }
      );
    }

    const leadId = await findRelatedLeadId(phone);
    const auditNotes = [
      "Cita agendada desde WhatsApp IA",
      `Origen: ${source}`,
      whatsappLeadId ? `WhatsApp lead ID: ${whatsappLeadId}` : "",
      email ? `Correo: ${email}` : "",
      `Auditoria: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .insert([
        {
          lead_id: leadId,
          patient_name: fullName,
          phone,
          appointment_date: date,
          appointment_time: time,
          status: "agendada",
          service_type: serviceType,
          specialist_user_id: null,
          notes: auditNotes,
          created_by_user_id: authCheck.user?.id || null,
          updated_by_user_id: authCheck.user?.id || null,
        },
      ])
      .select("id, lead_id, patient_name, phone, appointment_date, appointment_time, status, service_type")
      .single();

    if (appointmentError) throw appointmentError;

    if (leadId) {
      await supabaseAdmin
        .from("leads")
        .update({ status: "agendado" })
        .eq("id", leadId);
    }

    if (whatsappLeadId) {
      const { error: whatsappLeadError } = await supabaseAdmin
        .from("whatsapp_leads")
        .update({
          status: "agendado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", whatsappLeadId);

      if (whatsappLeadError) throw whatsappLeadError;
    }

    return NextResponse.json(
      {
        ok: true,
        appointment,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
