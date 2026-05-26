"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

export default function LeadsWhatsappPage() {
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

        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
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
    void loadMessages(lead);
  }

  async function sendManualReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLead || !replyMessage.trim()) {
      setConversationError("Escribe un mensaje antes de enviarlo.");
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#F6FAF7_0%,_#EFF7F1_48%,_#F8FBF8_100%)] px-4 py-8 text-[#10233F] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#C7EEE1]/38 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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
                Consulta de inscripciones recibidas por WhatsApp SaleADS.
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
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Pendientes por agendar</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{counters.pendientesPorAgendar}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Respuestas sin atender</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{counters.respuestasSinAtender}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Ventana por vencer</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{counters.ventanaPorVencer}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Requieren plantilla</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{counters.requierenPlantilla}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Felicitaciones hoy</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{counters.felicitacionesHoy}</p>
          </div>
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

        <section className={panelClass}>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#0E2340]">Registros</h2>
              <p className="mt-1 text-sm text-[#496356]">Selecciona un lead para ver y responder la conversacion.</p>
            </div>
            {loading ? <p className="text-sm text-[#607368]">Cargando...</p> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.22em] text-[#50695C]">
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Nombre</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Telefono</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Correo</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Campana</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Origen</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Estado</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Programada</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Ventana</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Creacion</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Conversacion</th>
                </tr>
              </thead>
              <tbody>
                {!loading && leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="rounded-2xl border border-dashed border-[#CFE4D8] px-4 py-8 text-center text-[#607368]"
                    >
                      No hay leads para esos filtros.
                    </td>
                  </tr>
                ) : null}

                {sortedLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`align-top text-[#10233F] transition ${
                      selectedLead?.id === lead.id ? "bg-[#EAF7EF]" : "hover:bg-[#F7FCF8]"
                    }`}
                  >
                    <td className="border-b border-[#EDF5EF] px-4 py-4 font-semibold">
                      {displayName(lead)}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">{lead.phone}</td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.email || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.campaign_code || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.source || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      <span className="inline-flex rounded-full bg-[#E8F6EE] px-3 py-1 text-xs font-semibold text-[#4F6F5B] ring-1 ring-[#CFE4D8]">
                        {statusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {formatDateTime(lead.felicitation_scheduled_for)}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {formatDateTime(lead.reply_window_expires_at)}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {formatDateTime(lead.created_at)}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      <button
                        type="button"
                        onClick={() => selectLead(lead)}
                        className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                      >
                        Ver conversacion
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedLead ? (
          <section className={panelClass}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
              <div className="rounded-[26px] border border-[#DCEDE3] bg-white/85 p-5">
                <p className="inline-flex rounded-full border border-[#CFE4D8] bg-[#E8F6EE] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#5F7D66]">
                  Lead seleccionado
                </p>
                <h2 className="mt-4 text-2xl font-bold text-[#0E2340]">
                  {displayName(selectedLead)}
                </h2>
                <dl className="mt-4 space-y-3 text-sm text-[#24312A]">
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Telefono</dt>
                    <dd>{selectedLead.phone}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Correo</dt>
                    <dd>{selectedLead.email || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Campana</dt>
                    <dd>{selectedLead.campaign_code || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Origen</dt>
                    <dd>{selectedLead.source || "-"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Estado</dt>
                    <dd>{statusLabel(selectedLead.status)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Creacion</dt>
                    <dd>{formatDateTime(selectedLead.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Felicitacion programada</dt>
                    <dd>{formatDateTime(selectedLead.felicitation_scheduled_for)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#5B6E63]">Ventana 24h vence</dt>
                    <dd>{formatDateTime(selectedLead.reply_window_expires_at)}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-[26px] border border-[#DCEDE3] bg-white/85 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0E2340]">Conversacion</h2>
                    <p className="mt-1 text-sm leading-6 text-[#496356]">
                      Puedes responder libremente dentro de la ventana de 24 horas desde el ultimo mensaje del usuario. Para mensajes posteriores se necesitaran plantillas aprobadas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMessages(selectedLead)}
                    disabled={loadingMessages}
                    className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMessages ? "Actualizando..." : "Actualizar conversacion"}
                  </button>
                </div>

                {conversationError ? (
                  <div className="mt-4 rounded-2xl border border-[#E6C9C5] bg-[#FFF5F3] p-3 text-sm text-[#9A4E43]">
                    {conversationError}
                  </div>
                ) : null}

                {conversationNotice ? (
                  <div className="mt-4 rounded-2xl border border-[#BFE0CD] bg-[#F1FBF5] p-3 text-sm text-[#2D6B4A]">
                    {conversationNotice}
                  </div>
                ) : null}

                <div className="mt-5 max-h-[520px] space-y-3 overflow-y-auto rounded-[24px] border border-[#EDF5EF] bg-[#F8FCF9] p-4">
                  {loadingMessages ? (
                    <p className="text-sm text-[#607368]">Cargando conversacion...</p>
                  ) : messages.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#CFE4D8] bg-white/80 px-4 py-8 text-center text-sm text-[#607368]">
                      No hay mensajes guardados para este telefono.
                    </p>
                  ) : (
                    messages.map((message) => {
                      const isOutbound = message.direction === "outbound";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-[22px] px-4 py-3 shadow-sm ${
                              isOutbound
                                ? "bg-[#456A55] text-white"
                                : "border border-[#DCEDE3] bg-white text-[#10233F]"
                            }`}
                          >
                            {message.message_type === "image" && message.media_url ? (
                              <img
                                src={message.media_url}
                                alt={message.media_caption || "Imagen WhatsApp"}
                                className="mb-3 max-h-64 rounded-2xl object-contain"
                              />
                            ) : null}
                            <p className="whitespace-pre-wrap text-sm leading-6">
                              {message.body || message.media_caption || "-"}
                            </p>
                            {message.error ? (
                              <p className="mt-2 text-[11px] text-[#FBD0C9]">
                                {message.error}
                              </p>
                            ) : null}
                            <p
                              className={`mt-2 text-[11px] ${
                                isOutbound ? "text-white/75" : "text-[#607368]"
                              }`}
                            >
                              {isOutbound ? "Enviado" : "Recibido"} · {formatDateTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendManualReply} className="mt-5 space-y-3">
                  <label className="block text-sm font-semibold text-[#24312A]">
                    Respuesta manual
                  </label>
                  <textarea
                    className={`${inputClass} min-h-28 resize-y`}
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    placeholder="Escribe la respuesta para WhatsApp..."
                    disabled={sendingReply}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingReply ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
