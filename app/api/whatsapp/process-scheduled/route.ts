import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/server/user-security";
import {
  sendAndStoreImageMessage,
  sendAndStoreTextMessage,
} from "@/lib/whatsapp/outbound";
import { isWithinBogotaBusinessHours } from "@/lib/whatsapp/scheduling";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ScheduledLead = {
  id: string;
  phone: string;
  full_name: string | null;
  profile_name: string | null;
  status: string | null;
  reply_window_expires_at: string | null;
  safe_deadline_at: string | null;
  felicitation_scheduled_for: string | null;
  felicitation_sent_at: string | null;
};

const FELICITATION_MESSAGE = (name: string) =>
  `\u00a1Hola, ${name}! \u2728 Tenemos una gran noticia \ud83d\udc9a\n\nHas sido seleccionado/a para disfrutar una experiencia de Detox I\u00f3nico sin costo en Prevital.\n\nResponde este mensaje para ayudarte a agendar tu cita. \ud83d\udcc5`;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const headerSecret = request.headers.get("x-cron-secret") || "";

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

function displayName(lead: ScheduledLead) {
  return lead.full_name || lead.profile_name || "Hola";
}

async function markRequiresTemplate(id: string) {
  await supabaseAdmin
    .from("whatsapp_leads")
    .update({
      status: "requiere_template",
      priority: "alta",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const now = new Date();

    const { data, error } = await supabaseAdmin
      .from("whatsapp_leads")
      .select(
        "id, phone, full_name, profile_name, status, reply_window_expires_at, safe_deadline_at, felicitation_scheduled_for, felicitation_sent_at"
      )
      .eq("status", "felicitacion_programada")
      .is("felicitation_sent_at", null)
      .lte("felicitation_scheduled_for", now.toISOString())
      .order("felicitation_scheduled_for", { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: error.message || "No se pudieron cargar felicitaciones programadas." },
        { status: 400 }
      );
    }

    const leads = (data || []) as ScheduledLead[];
    const summary = {
      checked: leads.length,
      sent: 0,
      requiresTemplate: 0,
      skippedOutsideBusinessHours: 0,
      failed: 0,
    };

    for (const lead of leads) {
      if (
        lead.status !== "felicitacion_programada" ||
        lead.felicitation_sent_at ||
        !lead.reply_window_expires_at ||
        !lead.safe_deadline_at
      ) {
        continue;
      }

      const replyWindowExpiresAt = new Date(lead.reply_window_expires_at);
      const safeDeadlineAt = new Date(lead.safe_deadline_at);

      if (now >= replyWindowExpiresAt || now > safeDeadlineAt) {
        await markRequiresTemplate(lead.id);
        summary.requiresTemplate += 1;
        continue;
      }

      if (!isWithinBogotaBusinessHours(now)) {
        summary.skippedOutsideBusinessHours += 1;
        continue;
      }

      const textResult = await sendAndStoreTextMessage(
        lead.phone,
        FELICITATION_MESSAGE(displayName(lead))
      );

      if (!textResult.ok) {
        summary.failed += 1;
        continue;
      }

      await sendAndStoreImageMessage(
        lead.phone,
        process.env.WHATSAPP_IMAGE_FELICITACION_URL,
        "Seleccionado/a Detox I\u00f3nico Prevital"
      );

      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("whatsapp_leads")
        .update({
          status: "felicitacion_enviada",
          selected_at: sentAt,
          felicitation_sent_at: sentAt,
          last_outbound_at: sentAt,
          priority: "normal",
          updated_at: sentAt,
        })
        .eq("id", lead.id)
        .eq("status", "felicitacion_programada")
        .is("felicitation_sent_at", null);

      if (updateError) {
        summary.failed += 1;
        continue;
      }

      summary.sent += 1;
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
