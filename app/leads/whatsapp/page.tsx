"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Paperclip,
  RefreshCcw,
  Send,
  Smile,
  XCircle,
} from "lucide-react";
import SessionBadge from "@/components/session-badge";

type WhatsappLead = {
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

type WhatsappMessage = {
  id: string;
  phone: string;
  direction: "inbound" | "outbound" | string;
  message_id: string | null;
  body: string | null;
  created_at: string | null;
  message_type: string | null;
  media_url: string | null;
  media_caption: string | null;
  meta_message_id: string | null;
  status: string | null;
  error: string | null;
};

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const quickEmojis = ["😊", "💚", "🌿", "👋", "✨", "📅", "🙌", "🎉", "✅", "🙏", "😄"];

const quickReplies = [
  {
    label: "Saludo",
    text: "Hola, gracias por escribirnos a Prevital 💚 ¿Como podemos ayudarte?",
  },
  {
    label: "Agendar",
    text: "Perfecto 😊 Para ayudarte a agendar tu cita, por favor confirmame que horario te queda mejor.",
  },
  {
    label: "Ganador",
    text: "¡Felicitaciones! ✨ Fuiste seleccionado/a para la experiencia de Detox Ionico sin costo. ¿Te gustaria que te ayudemos a agendar?",
  },
  {
    label: "No responde",
    text: "Hola 😊 Quedamos atentos para ayudarte a continuar con tu inscripcion cuando puedas responder.",
  },
  {
    label: "Recordatorio",
    text: "Te recordamos que nuestro equipo de Prevital esta listo para ayudarte a coordinar tu experiencia 🌿",
  },
];

function todayISO() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartISO() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    collecting_name: "Pidiendo nombre",
    collecting_email: "Pidiendo correo",
    registered: "Registrado",
    registrado: "Registrado",
    felicitacion_programada: "Felicitacion programada",
    felicitacion_enviada: "Felicitacion enviada",
    respondio_para_agendar: "Respondio para agendar",
    en_gestion_callcenter: "En gestion Call Center",
    agendado: "Agendado",
    sin_respuesta: "Sin respuesta",
    requiere_template: "Requiere plantilla",
    cerrado: "Cerrado",
  };

  if (!status) return "Sin estado";
  return labels[status] || status;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function displayName(lead: WhatsappLead) {
  return lead.full_name || lead.profile_name || "Sin nombre";
}

function isInboundWithoutAnswer(lead: WhatsappLead) {
  if (!lead.last_inbound_at) return false;
  if (!lead.last_outbound_at) return true;
  return new Date(lead.last_inbound_at).getTime() > new Date(lead.last_outbound_at).getTime();
}

function isWindowExpiringSoon(lead: WhatsappLead) {
  if (!lead.reply_window_expires_at || lead.status === "requiere_template") return false;
  const now = Date.now();
  const expiresAt = new Date(lead.reply_window_expires_at).getTime();
  return expiresAt > now && expiresAt - now <= 2 * 60 * 60 * 1000;
}

function isScheduledToday(lead: WhatsappLead) {
  if (!lead.felicitation_scheduled_for) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const scheduledDay = new Date(lead.felicitation_scheduled_for).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
  return today === scheduledDay;
}

function queuePriority(lead: WhatsappLead) {
  if (lead.status === "respondio_para_agendar") return 1;
  if (isInboundWithoutAnswer(lead)) return 2;
  if (isWindowExpiringSoon(lead)) return 3;
  if (lead.status === "felicitacion_programada") return 4;
  if (lead.status === "registrado" || lead.status === "registered") return 5;
  return 9;
}

function conversationBadge(lead: WhatsappLead) {
  if (lead.status === "agendado") return "Agendado";
  if (lead.status === "requiere_template") return "Requiere plantilla";
  if (lead.status === "respondio_para_agendar") return "Respondio para agendar";
  if (isWindowExpiringSoon(lead)) return "Ventana por vencer";
  if (isInboundWithoutAnswer(lead)) return "Pendiente";
  return statusLabel(lead.status);
}

function canReplyFreely(lead: WhatsappLead | null) {
  if (!lead?.reply_window_expires_at) return true;
  return new Date(lead.reply_window_expires_at).getTime() > Date.now();
}

export default function LeadsWhatsappPage() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [leads, setLeads] = useState<WhatsappLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<WhatsappLead | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [status, setStatus] = useState("");
  const [campaignCode, setCampaignCode] = useState("PV_DETOX");
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [error, setError] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [conversationNotice, setConversationNotice] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachmentNotice, setAttachmentNotice] = useState("");

  const sortedLeads = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const priorityDiff = queuePriority(a) - queuePriority(b);
        if (priorityDiff !== 0) return priorityDiff;

        const aSchedule = a.felicitation_scheduled_for
          ? new Date(a.felicitation_scheduled_for).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bSchedule = b.felicitation_scheduled_for
          ? new Date(b.felicitation_scheduled_for).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (aSchedule !== bSchedule) return aSchedule - bSchedule;

        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }),
    [leads]
  );

  const counters = useMemo(
    () => ({
      pendientesPorAgendar: leads.filter((lead) => lead.status === "respondio_para_agendar")
        .length,
      respuestasSinAtender: leads.filter(isInboundWithoutAnswer).length,
      ventanaPorVencer: leads.filter(isWindowExpiringSoon).length,
      requierenPlantilla: leads.filter((lead) => lead.status === "requiere_template").length,
      felicitacionesHoy: leads.filter(isScheduledToday).length,
    }),
    [leads]
  );

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (campaignCode.trim()) params.set("campaign_code", campaignCode.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const response = await fetch(`/api/whatsapp/leads?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudieron cargar los leads.");
      }

      const nextLeads = (payload?.leads as WhatsappLead[]) || [];
      setLeads(nextLeads);
      if (selectedLead) {
        const refreshedSelectedLead = nextLeads.find((lead) => lead.id === selectedLead.id);
        if (refreshedSelectedLead) setSelectedLead(refreshedSelectedLead);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los leads.";
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(lead: WhatsappLead) {
    try {
      setLoadingMessages(true);
      setConversationError("");
      setConversationNotice("");
      setAttachmentNotice("");

      const params = new URLSearchParams({ phone: lead.phone });
      const response = await fetch(`/api/whatsapp/messages?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo cargar la conversacion.");
      }

      setMessages((payload?.messages as WhatsappMessage[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la conversacion.";
      setConversationError(message);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  function selectLead(lead: WhatsappLead) {
    setSelectedLead(lead);
    setReplyMessage("");
    setEmojiOpen(false);
    setAttachmentNotice("");
    void loadMessages(lead);
  }

  function insertTextAtCursor(text: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setReplyMessage((current) => `${current}${text}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${replyMessage.slice(0, start)}${text}${replyMessage.slice(end)}`;
    setReplyMessage(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + text.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function insertQuickReply(text: string) {
    insertTextAtCursor(replyMessage.trim() ? `\n${text}` : text);
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function showAttachmentBlockedNotice() {
    setAttachmentNotice(
      "El envio de imagenes manuales estara disponible cuando se configure storage."
    );
  }

  function showActionPendingNotice(action: string) {
    setConversationNotice(`${action} quedara disponible cuando habilitemos actualizacion de estado.`);
  }

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead || !replyMessage.trim()) {
      setConversationError("Escribe un mensaje antes de enviarlo.");
      return;
    }

    if (!canReplyFreely(selectedLead)) {
      setConversationError(
        "La ventana de 24 horas vencio. Para responder se necesita una plantilla aprobada."
      );
      return;
    }

    try {
      setSendingReply(true);
      setConversationError("");
      setConversationNotice("");

      const response = await fetch("/api/whatsapp/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: selectedLead.phone,
          message: replyMessage.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo enviar el mensaje.");
      }

      setReplyMessage("");
      setConversationNotice("Mensaje enviado y guardado en el historial.");
      await loadMessages(selectedLead);
      await loadLeads();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo enviar el mensaje.";
      setConversationError(message);
    } finally {
      setSendingReply(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLeads();
  }

  function clearFilters() {
    setStatus("");
    setCampaignCode("PV_DETOX");
    setDateFrom(monthStartISO());
    setDateTo(todayISO());
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, selectedLead?.id]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#F6FAF7_0%,_#EFF7F1_48%,_#F8FBF8_100%)] px-4 py-8 text-[#10233F] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
          <Image
            src="/prevital-logo-vivo.png"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                WhatsApp
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">
                Leads WhatsApp
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Bandeja operativa para responder inscripciones de WhatsApp SaleADS desde el CRM.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/leads"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Volver a consultas
            </a>

            <button
              type="button"
              onClick={() => void loadLeads()}
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Pendientes por agendar", counters.pendientesPorAgendar],
            ["Respuestas sin atender", counters.respuestasSinAtender],
            ["Ventana por vencer", counters.ventanaPorVencer],
            ["Requieren plantilla", counters.requierenPlantilla],
            ["Felicitaciones hoy", counters.felicitacionesHoy],
          ].map(([label, value]) => (
            <div
              key={label}
              className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"
            >
              <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
              <p className="text-sm font-medium text-[#5B6E63]">{label}</p>
              <p className="mt-2 text-3xl font-bold text-[#24312A]">{value}</p>
            </div>
          ))}
        </section>

        <section className={panelClass}>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Estado</label>
              <select
                className={inputClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="collecting_name">Pidiendo nombre</option>
                <option value="collecting_email">Pidiendo correo</option>
                <option value="registrado">Registrados</option>
                <option value="felicitacion_programada">Felicitacion programada</option>
                <option value="felicitacion_enviada">Felicitacion enviada</option>
                <option value="respondio_para_agendar">Respondio para agendar</option>
                <option value="requiere_template">Requiere plantilla</option>
                <option value="agendado">Agendados</option>
                <option value="cerrado">Cerrados</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Campana</label>
              <input
                className={inputClass}
                value={campaignCode}
                onChange={(event) => setCampaignCode(event.target.value)}
                placeholder="PV_DETOX"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
              <input
                className={inputClass}
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                className={inputClass}
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Filtrar
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Limpiar
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[32px] border border-[#CFE4D8] bg-white/95 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
          <div className="grid min-h-[720px] lg:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="border-b border-[#DCEDE3] bg-[#F7FCF8] lg:border-b-0 lg:border-r">
              <div className="sticky top-0 z-10 border-b border-[#DCEDE3] bg-[#F7FCF8]/95 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#0E2340]">Conversaciones</h2>
                    <p className="text-xs text-[#607368]">
                      {loading ? "Cargando..." : `${sortedLeads.length} leads filtrados`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadLeads()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#CFE4D8] bg-white text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#EFF8F2]"
                    title="Actualizar lista"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[640px] overflow-y-auto p-3">
                {!loading && sortedLeads.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-white/80 px-4 py-8 text-center text-sm text-[#607368]">
                    No hay conversaciones para esos filtros.
                  </div>
                ) : null}

                <div className="space-y-2">
                  {sortedLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => selectLead(lead)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        selectedLead?.id === lead.id
                          ? "border-[#7FA287] bg-white shadow-[0_16px_34px_rgba(95,125,102,0.16)]"
                          : "border-transparent bg-white/70 hover:border-[#CFE4D8] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#C7EEE1,_#6C9C88)] text-sm font-bold text-[#1F3128]">
                          {displayName(lead).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-semibold text-[#10233F]">
                              {displayName(lead)}
                            </p>
                            <span className="shrink-0 text-[11px] text-[#789084]">
                              {formatDateTime(lead.last_inbound_at || lead.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-[#607368]">{lead.phone}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-[#E8F6EE] px-2.5 py-1 text-[11px] font-semibold text-[#4F6F5B] ring-1 ring-[#CFE4D8]">
                              {conversationBadge(lead)}
                            </span>
                            {lead.campaign_code ? (
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#607368] ring-1 ring-[#DCEDE3]">
                                {lead.campaign_code}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="flex min-h-[720px] flex-col bg-[linear-gradient(180deg,_#F1FAF4_0%,_#EAF5EE_100%)]">
              {selectedLead ? (
                <>
                  <header className="border-b border-[#DCEDE3] bg-white/95 p-4 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#C7EEE1,_#6C9C88)] text-base font-bold text-[#1F3128]">
                          {displayName(selectedLead).slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[#0E2340]">
                            {displayName(selectedLead)}
                          </h2>
                          <p className="mt-1 text-sm text-[#607368]">
                            {selectedLead.phone} · {selectedLead.campaign_code || "-"} ·{" "}
                            {statusLabel(selectedLead.status)}
                          </p>
                          <div className="mt-2 grid gap-1 text-xs text-[#607368] md:grid-cols-2">
                            <span>Correo: {selectedLead.email || "-"}</span>
                            <span>Origen: {selectedLead.source || "-"}</span>
                            <span>Creado: {formatDateTime(selectedLead.created_at)}</span>
                            <span>Ventana: {formatDateTime(selectedLead.reply_window_expires_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void loadMessages(selectedLead)}
                          disabled={loadingMessages}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFE4D8] bg-white px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {loadingMessages ? "Actualizando" : "Actualizar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => showActionPendingNotice("Marcar agendado")}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFE4D8] bg-white px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                        >
                          <CalendarCheck className="h-4 w-4" />
                          Agendado
                        </button>
                        <button
                          type="button"
                          onClick={() => showActionPendingNotice("Marcar no responde")}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFE4D8] bg-white px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                        >
                          <Clock3 className="h-4 w-4" />
                          No responde
                        </button>
                        <button
                          type="button"
                          onClick={() => showActionPendingNotice("Cerrar conversacion")}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#E6C9C5] bg-white px-3 py-2 text-xs font-semibold text-[#9A4E43] shadow-sm transition hover:-translate-y-0.5"
                        >
                          <XCircle className="h-4 w-4" />
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </header>

                  <div className="border-b border-[#DCEDE3] bg-[#F8FCF9]/95 px-4 py-3">
                    <p className="rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-3 text-sm leading-6 text-[#496356]">
                      Puedes responder libremente dentro de la ventana de 24 horas desde el ultimo mensaje del usuario. Para mensajes posteriores se necesitaran plantillas aprobadas.
                    </p>
                  </div>

                  {conversationError || conversationNotice || attachmentNotice || !canReplyFreely(selectedLead) ? (
                    <div className="space-y-2 border-b border-[#DCEDE3] bg-white/75 px-4 py-3">
                      {!canReplyFreely(selectedLead) ? (
                        <div className="rounded-2xl border border-[#E6C9C5] bg-[#FFF5F3] p-3 text-sm text-[#9A4E43]">
                          La ventana de 24 horas vencio. Para responder se necesita una plantilla aprobada.
                        </div>
                      ) : null}
                      {conversationError ? (
                        <div className="rounded-2xl border border-[#E6C9C5] bg-[#FFF5F3] p-3 text-sm text-[#9A4E43]">
                          {conversationError}
                        </div>
                      ) : null}
                      {conversationNotice ? (
                        <div className="rounded-2xl border border-[#BFE0CD] bg-[#F1FBF5] p-3 text-sm text-[#2D6B4A]">
                          {conversationNotice}
                        </div>
                      ) : null}
                      {attachmentNotice ? (
                        <div className="rounded-2xl border border-[#D9E6C5] bg-[#FCFFF3] p-3 text-sm text-[#6A6F36]">
                          {attachmentNotice}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex-1 overflow-y-auto px-4 py-5">
                    <div className="mx-auto max-w-4xl space-y-3">
                      {loadingMessages ? (
                        <p className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-[#607368] shadow-sm">
                          Cargando conversacion...
                        </p>
                      ) : messages.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-white/80 px-4 py-10 text-center text-sm text-[#607368]">
                          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-[#7FA287]" />
                          No hay mensajes guardados para este telefono.
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isOutbound = message.direction === "outbound";

                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[78%] rounded-[22px] px-4 py-3 shadow-sm ${
                                  isOutbound
                                    ? "rounded-br-md bg-[#DCF8C6] text-[#10233F]"
                                    : "rounded-bl-md border border-[#DCEDE3] bg-white text-[#10233F]"
                                }`}
                              >
                                {message.message_type === "image" && message.media_url ? (
                                  <img
                                    src={message.media_url}
                                    alt={message.media_caption || "Imagen WhatsApp"}
                                    className="mb-3 max-h-72 rounded-2xl object-contain"
                                  />
                                ) : null}
                                <p className="whitespace-pre-wrap text-sm leading-6">
                                  {message.body || message.media_caption || "-"}
                                </p>
                                {message.error ? (
                                  <p className="mt-2 text-[11px] text-[#9A4E43]">
                                    {message.error}
                                  </p>
                                ) : null}
                                <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#607368]">
                                  {formatDateTime(message.created_at)}
                                  {isOutbound ? (
                                    <CheckCircle2 className="h-3 w-3 text-[#4F7B63]" />
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <form
                    onSubmit={sendManualReply}
                    className="sticky bottom-0 border-t border-[#CFE4D8] bg-white/95 p-4 shadow-[0_-18px_40px_rgba(95,125,102,0.08)] backdrop-blur"
                  >
                    <div className="mx-auto max-w-4xl space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {quickReplies.map((reply) => (
                          <button
                            key={reply.label}
                            type="button"
                            onClick={() => insertQuickReply(reply.text)}
                            disabled={sendingReply || !canReplyFreely(selectedLead)}
                            className="rounded-full border border-[#CFE4D8] bg-[#F7FCF8] px-3 py-1.5 text-xs font-semibold text-[#4F6F5B] transition hover:-translate-y-0.5 hover:bg-[#EAF7EF] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {reply.label}
                          </button>
                        ))}
                      </div>

                      {emojiOpen ? (
                        <div className="flex flex-wrap gap-2 rounded-2xl border border-[#CFE4D8] bg-[#F7FCF8] p-2">
                          {quickEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertTextAtCursor(emoji)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm transition hover:-translate-y-0.5"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex items-end gap-2 rounded-[24px] border border-[#CFE4D8] bg-[#F7FCF8] p-2">
                        <button
                          type="button"
                          onClick={() => setEmojiOpen((current) => !current)}
                          disabled={sendingReply || !canReplyFreely(selectedLead)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Emojis"
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={showAttachmentBlockedNotice}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                          title="Adjuntar imagen"
                        >
                          <Paperclip className="h-5 w-5" />
                        </button>
                        <textarea
                          ref={textareaRef}
                          className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-transparent bg-white px-4 py-3 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                          value={replyMessage}
                          onChange={(event) => setReplyMessage(event.target.value)}
                          onKeyDown={handleReplyKeyDown}
                          placeholder={
                            canReplyFreely(selectedLead)
                              ? "Escribe un mensaje..."
                              : "Ventana vencida: se requiere plantilla aprobada"
                          }
                          disabled={sendingReply || !canReplyFreely(selectedLead)}
                        />
                        <button
                          type="submit"
                          disabled={sendingReply || !replyMessage.trim() || !canReplyFreely(selectedLead)}
                          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Enviar"
                        >
                          {sendingReply ? "..." : <Send className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-8">
                  <div className="max-w-sm rounded-[28px] border border-[#CFE4D8] bg-white/80 p-8 text-center shadow-sm">
                    <MessageCircle className="mx-auto h-10 w-10 text-[#6C9C88]" />
                    <h2 className="mt-4 text-2xl font-bold text-[#0E2340]">
                      Selecciona una conversacion
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[#607368]">
                      El historial, respuestas rapidas y barra de envio apareceran aqui.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
