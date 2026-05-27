"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
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
  appointment_id: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  appointment_status: string | null;
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
  status_updated_at: string | null;
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
    pendiente_agendar: "Pendiente agendar",
    esperando_preferencia_jornada: "Esperando jornada",
    esperando_dia_preferido: "Esperando dia",
    ofreciendo_horarios: "Ofreciendo horarios",
    esperando_confirmacion_horario: "Esperando confirmacion",
    en_gestion_callcenter: "En gestion Call Center",
    agendado: "Agendado",
    agendada: "Agendada",
    confirmada: "Confirmada",
    reagendada: "Reagendada",
    en_espera: "En espera",
    asistio: "Asistio",
    finalizada: "Finalizada",
    no_asistio: "No asistio",
    sin_respuesta: "Sin respuesta",
    requiere_template: "Requiere plantilla",
    requiere_humano: "Requiere humano",
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

function conversationBadge(lead: WhatsappLead) {
  if (lead.status === "agendado") return "Agendado";
  if (lead.status === "requiere_humano") return "Requiere humano";
  if (lead.status === "esperando_confirmacion_horario") return "Esperando confirmacion";
  if (lead.status === "esperando_preferencia_jornada") return "Esperando jornada";
  if (lead.status === "esperando_dia_preferido") return "Esperando dia";
  if (lead.status === "ofreciendo_horarios") return "Ofreciendo horarios";
  if (lead.status === "pendiente_agendar") return "Pendiente agendar";
  if (lead.status === "requiere_template") return "Requiere plantilla";
  if (lead.status === "respondio_para_agendar") return "Respondio para agendar";
  if (isWindowExpiringSoon(lead)) return "Ventana por vencer";
  if (isInboundWithoutAnswer(lead)) return "Pendiente";
  return statusLabel(lead.status);
}

function normalizedStatus(status: string | null | undefined) {
  if (status === "registered") return "registrado";
  if (status === "no_response") return "sin_respuesta";
  return status || "sin_estado";
}

function statusTone(status: string | null | undefined) {
  const tones: Record<string, string> = {
    registrado: "border-[#BFE0CD] bg-[#EAF7EF] text-[#2F6B4E] ring-[#BFE0CD]",
    felicitacion_programada: "border-[#BFD7EA] bg-[#EAF4FB] text-[#315E7D] ring-[#BFD7EA]",
    felicitacion_enviada: "border-[#D8C8EA] bg-[#F1ECFA] text-[#6B4F8E] ring-[#D8C8EA]",
    respondio_para_agendar: "border-[#EEC6B8] bg-[#FFF0E9] text-[#9A4E2E] ring-[#EEC6B8]",
    pendiente_agendar: "border-[#EEC6B8] bg-[#FFF0E9] text-[#9A4E2E] ring-[#EEC6B8]",
    esperando_preferencia_jornada: "border-[#BFD7EA] bg-[#EAF4FB] text-[#315E7D] ring-[#BFD7EA]",
    esperando_dia_preferido: "border-[#E8D49D] bg-[#FFF7D9] text-[#8B6B22] ring-[#E8D49D]",
    ofreciendo_horarios: "border-[#BFD7EA] bg-[#EAF4FB] text-[#315E7D] ring-[#BFD7EA]",
    esperando_confirmacion_horario: "border-[#EEC6B8] bg-[#FFF0E9] text-[#9A4E2E] ring-[#EEC6B8]",
    en_gestion_callcenter: "border-[#BCE1DE] bg-[#E9F8F6] text-[#2B706E] ring-[#BCE1DE]",
    agendado: "border-[#7FA287] bg-[#D9F0E1] text-[#23563C] ring-[#9BC4AF]",
    agendada: "border-[#7FA287] bg-[#D9F0E1] text-[#23563C] ring-[#9BC4AF]",
    confirmada: "border-[#7FA287] bg-[#D9F0E1] text-[#23563C] ring-[#9BC4AF]",
    reagendada: "border-[#BCE1DE] bg-[#E9F8F6] text-[#2B706E] ring-[#BCE1DE]",
    en_espera: "border-[#E8D49D] bg-[#FFF7D9] text-[#8B6B22] ring-[#E8D49D]",
    asistio: "border-[#D8C8EA] bg-[#F1ECFA] text-[#6B4F8E] ring-[#D8C8EA]",
    finalizada: "border-[#D8C8EA] bg-[#F1ECFA] text-[#6B4F8E] ring-[#D8C8EA]",
    no_asistio: "border-[#E8D49D] bg-[#FFF7D9] text-[#8B6B22] ring-[#E8D49D]",
    sin_respuesta: "border-[#D7DDD9] bg-[#F1F4F2] text-[#596660] ring-[#D7DDD9]",
    requiere_template: "border-[#E8D49D] bg-[#FFF7D9] text-[#8B6B22] ring-[#E8D49D]",
    requiere_humano: "border-[#E6C9C5] bg-[#FFF5F3] text-[#9A4E43] ring-[#E6C9C5]",
    cerrado: "border-[#B8C0BD] bg-[#E6EAE8] text-[#3E4945] ring-[#B8C0BD]",
  };

  return tones[normalizedStatus(status)] || "border-[#CFE4D8] bg-[#F4FAF6] text-[#4F6F5B] ring-[#CFE4D8]";
}

function leadCardTone(lead: WhatsappLead, selected: boolean) {
  if (
    lead.status === "respondio_para_agendar" ||
    lead.status === "pendiente_agendar" ||
    lead.status === "esperando_confirmacion_horario" ||
    lead.status === "requiere_humano"
  ) {
    return selected
      ? "border-[#D98D72] bg-[#FFF4EF] shadow-[0_16px_34px_rgba(154,78,46,0.16)]"
      : "border-[#EEC6B8] bg-[#FFF7F3] hover:border-[#D98D72] hover:bg-[#FFF1E9]";
  }

  return selected
    ? "border-[#7FA287] bg-white shadow-[0_16px_34px_rgba(95,125,102,0.16)]"
    : "border-transparent bg-white/70 hover:border-[#CFE4D8] hover:bg-white";
}

function canReplyFreely(lead: WhatsappLead | null) {
  if (!lead?.reply_window_expires_at) return true;
  return new Date(lead.reply_window_expires_at).getTime() > Date.now();
}

function outboundStatusMeta(status: string | null | undefined) {
  if (status === "read") {
    return {
      label: "✓✓ Leído",
      className: "text-[#2274C9]",
    };
  }
  if (status === "delivered") {
    return {
      label: "✓✓",
      className: "text-[#4F7B63]",
    };
  }
  if (status === "failed") {
    return {
      label: "Error",
      className: "font-semibold text-[#9A4E43]",
    };
  }
  return {
    label: "✓",
    className: "text-[#607368]",
  };
}

type KanbanColumn = {
  id: string;
  title: string;
  hint: string;
  items: WhatsappLead[];
  tone: string;
};

const inscritosStatuses = new Set(["registrado", "registered", "felicitacion_programada", "felicitacion_enviada"]);
const porAgendarStatuses = new Set([
  "pendiente_agendar",
  "ofreciendo_horarios",
  "esperando_preferencia_jornada",
  "esperando_dia_preferido",
  "esperando_confirmacion_horario",
  "respondio_para_agendar",
]);
const activeAppointmentStatuses = new Set(["agendada", "confirmada", "reagendada", "en_espera"]);

function leadActivityTime(lead: WhatsappLead) {
  return new Date(lead.last_inbound_at || lead.last_outbound_at || lead.created_at || 0).getTime();
}

function appointmentSortValue(lead: WhatsappLead, fallback = "9999-12-31T23:59:59") {
  return `${lead.appointment_date || fallback.slice(0, 10)}T${lead.appointment_time || fallback.slice(11)}`;
}

function formatAppointmentDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatAppointmentTime(value: string | null | undefined) {
  if (!value) return "Sin hora";
  const [hour = "00", minute = "00"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function leadColumnId(lead: WhatsappLead) {
  if (lead.status === "requiere_humano") return "requiere_humano";
  if (lead.appointment_status === "no_asistio") return "no_asistio";
  if (lead.appointment_status === "asistio" || lead.appointment_status === "finalizada") return "asistio";
  if (lead.status === "agendado" || activeAppointmentStatuses.has(lead.appointment_status || "")) {
    return "agendados";
  }
  if (porAgendarStatuses.has(lead.status || "")) return "por_agendar";
  if (inscritosStatuses.has(lead.status || "")) return "inscritos";
  return "inscritos";
}

function canShowScheduleAction(lead: WhatsappLead) {
  return lead.status === "agendado" || activeAppointmentStatuses.has(lead.appointment_status || "");
}

function sortColumnItems(columnId: string, items: WhatsappLead[]) {
  const copy = [...items];

  if (columnId === "por_agendar") {
    return copy.sort((a, b) => {
      const pendingDiff = Number(isInboundWithoutAnswer(b)) - Number(isInboundWithoutAnswer(a));
      if (pendingDiff !== 0) return pendingDiff;
      return leadActivityTime(b) - leadActivityTime(a);
    });
  }

  if (columnId === "agendados") {
    return copy.sort((a, b) => appointmentSortValue(a).localeCompare(appointmentSortValue(b)));
  }

  if (columnId === "asistio" || columnId === "no_asistio") {
    return copy.sort((a, b) =>
      appointmentSortValue(b, "0000-01-01T00:00:00").localeCompare(
        appointmentSortValue(a, "0000-01-01T00:00:00")
      )
    );
  }

  return copy.sort((a, b) => leadActivityTime(b) - leadActivityTime(a));
}

function buildKanbanColumns(leads: WhatsappLead[]): KanbanColumn[] {
  const columns: KanbanColumn[] = [
    {
      id: "inscritos",
      title: "Inscritos",
      hint: "Registro y felicitacion",
      items: [],
      tone: "border-[#BFD7EA] bg-[#F5FAFE]",
    },
    {
      id: "por_agendar",
      title: "Ganadores / Por agendar",
      hint: "Prioridad alta",
      items: [],
      tone: "border-[#EEC6B8] bg-[#FFF7F3]",
    },
    {
      id: "agendados",
      title: "Agendados",
      hint: "Orden por cita",
      items: [],
      tone: "border-[#BFE0CD] bg-[#F4FBF7]",
    },
    {
      id: "asistio",
      title: "Asistio",
      hint: "Citas atendidas",
      items: [],
      tone: "border-[#D8C8EA] bg-[#FAF7FE]",
    },
    {
      id: "no_asistio",
      title: "No asistio",
      hint: "Recuperacion",
      items: [],
      tone: "border-[#E8D49D] bg-[#FFFDF4]",
    },
    {
      id: "requiere_humano",
      title: "Requiere humano",
      hint: "Alerta operativa",
      items: [],
      tone: "border-[#E6C9C5] bg-[#FFF7F5]",
    },
  ];
  const byId = new Map(columns.map((column) => [column.id, column]));

  leads.forEach((lead) => {
    byId.get(leadColumnId(lead))?.items.push(lead);
  });

  return columns.map((column) => ({
    ...column,
    items: sortColumnItems(column.id, column.items),
  }));
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
  const [activeColumnId, setActiveColumnId] = useState("inscritos");

  const kanbanColumns = useMemo(() => buildKanbanColumns(leads), [leads]);
  const totalLeads = useMemo(
    () => kanbanColumns.reduce((total, column) => total + column.items.length, 0),
    [kanbanColumns]
  );
  const activeColumn = useMemo(
    () => kanbanColumns.find((column) => column.id === activeColumnId) || kanbanColumns[0],
    [activeColumnId, kanbanColumns]
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

  function returnToList() {
    setSelectedLead(null);
    setMessages([]);
    setReplyMessage("");
    setEmojiOpen(false);
    setConversationError("");
    setConversationNotice("");
    setAttachmentNotice("");
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
    <main className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,_#F6FAF7_0%,_#EFF7F1_48%,_#F8FBF8_100%)] px-3 py-4 text-[#10233F] sm:px-6 sm:py-8 lg:px-8">
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

      <div className="relative mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <section className={`relative overflow-hidden rounded-[28px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-4 shadow-[0_24px_60px_rgba(95,125,102,0.16)] sm:rounded-[34px] sm:p-6 ${selectedLead ? "hidden lg:block" : ""}`}>
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

        <section className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${selectedLead ? "hidden lg:grid" : ""}`}>
          {kanbanColumns.map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={() => setActiveColumnId(column.id)}
              className={`overflow-hidden rounded-[24px] border p-4 text-left shadow-[0_14px_32px_rgba(95,125,102,0.1)] transition hover:-translate-y-0.5 ${
                activeColumnId === column.id
                  ? "border-[#6C9C88] bg-white ring-2 ring-[#BFE0CD]"
                  : `${column.tone} hover:border-[#9BC4AF]`
              }`}
            >
              <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-[#24312A]">{column.title}</p>
                  <p className="mt-1 text-xs text-[#607368]">{column.hint}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-sm font-bold text-[#4F6F5B] shadow-sm ring-1 ring-[#DCEDE3]">
                  {column.items.length}
                </span>
              </div>
            </button>
          ))}
        </section>

        <section className={`${panelClass} ${selectedLead ? "hidden lg:block" : ""}`}>
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
                <option value="pendiente_agendar">Pendiente agendar</option>
                <option value="esperando_preferencia_jornada">Esperando jornada</option>
                <option value="esperando_dia_preferido">Esperando dia</option>
                <option value="ofreciendo_horarios">Ofreciendo horarios</option>
                <option value="esperando_confirmacion_horario">Esperando confirmacion</option>
                <option value="requiere_template">Requiere plantilla</option>
                <option value="requiere_humano">Requiere humano</option>
                <option value="agendado">Agendados</option>
                <option value="asistio">Asistio</option>
                <option value="finalizada">Finalizada</option>
                <option value="no_asistio">No asistio</option>
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

        <section className={`overflow-hidden border border-[#CFE4D8] bg-white/95 shadow-[0_24px_60px_rgba(95,125,102,0.12)] ${selectedLead ? "fixed inset-0 z-50 rounded-none lg:relative lg:inset-auto lg:z-auto lg:rounded-[32px]" : "rounded-[28px] sm:rounded-[32px]"}`}>
          <div className={`grid lg:min-h-[720px] lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.25fr)] ${selectedLead ? "h-[100dvh] lg:h-auto" : "min-h-[620px]"}`}>
            <aside className={`border-b border-[#DCEDE3] bg-[#F7FCF8] lg:border-b-0 lg:border-r ${selectedLead ? "hidden lg:block" : "block"}`}>
              <div className="sticky top-0 z-10 border-b border-[#DCEDE3] bg-[#F7FCF8]/95 p-4 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#0E2340]">Conversaciones</h2>
                    <p className="text-xs text-[#607368]">
                      {loading
                        ? "Cargando..."
                        : `${activeColumn?.title || "Lista"} (${activeColumn?.items.length || 0}) de ${totalLeads}`}
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

              <div className="max-h-[calc(100dvh-92px)] overflow-y-auto p-2 sm:p-3 lg:max-h-[640px]">
                {!loading && totalLeads === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-white/80 px-4 py-8 text-center text-sm text-[#607368]">
                    No hay conversaciones para esos filtros.
                  </div>
                ) : null}

                <div className="space-y-3">
                  {!loading && activeColumn?.items.length === 0 && totalLeads > 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-white/80 px-4 py-8 text-center text-sm text-[#607368]">
                      No hay leads en {activeColumn.title.toLowerCase()} con estos filtros.
                    </div>
                  ) : null}

                  {activeColumn?.items.map((lead) => {
                    const needsAnswer = isInboundWithoutAnswer(lead);
                    const needsHuman = lead.status === "requiere_humano";

                    return (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => selectLead(lead)}
                        className={`w-full rounded-[24px] border p-4 text-left transition ${leadCardTone(lead, selectedLead?.id === lead.id)} ${
                          needsAnswer ? "ring-2 ring-[#F1C1AA]" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#C7EEE1,_#6C9C88)] text-base font-bold text-[#1F3128]">
                            {displayName(lead).slice(0, 1).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-[#10233F]">
                                  {displayName(lead)}
                                </p>
                                <p className="mt-1 truncate text-sm text-[#607368]">{lead.phone}</p>
                              </div>

                              <span className="shrink-0 text-xs text-[#789084]">
                                {formatDateTime(lead.last_inbound_at || lead.created_at)}
                              </span>
                            </div>

                            {lead.appointment_date || lead.appointment_time ? (
                              <div className="mt-3 rounded-2xl border border-[#CFE4D8] bg-white/80 px-3 py-2 text-sm font-semibold text-[#4F6F5B]">
                                Cita: {formatAppointmentDate(lead.appointment_date)} · {formatAppointmentTime(lead.appointment_time)}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(lead.appointment_status || lead.status)}`}>
                                {lead.appointment_status ? statusLabel(lead.appointment_status) : conversationBadge(lead)}
                              </span>
                              {lead.campaign_code ? (
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#607368] ring-1 ring-[#DCEDE3]">
                                  {lead.campaign_code}
                                </span>
                              ) : null}
                              {needsAnswer ? (
                                <span className="rounded-full bg-[#FFF0E9] px-2.5 py-1 text-[11px] font-bold text-[#9A4E2E] ring-1 ring-[#EEC6B8]">
                                  Mensaje sin responder
                                </span>
                              ) : null}
                              {needsHuman ? (
                                <span className="rounded-full bg-[#FFF5F3] px-2.5 py-1 text-[11px] font-bold text-[#9A4E43] ring-1 ring-[#E6C9C5]">
                                  Alerta
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden">
                  {kanbanColumns.map((column) => (
                    <div
                      key={column.id}
                      className={`min-h-[260px] rounded-[26px] border p-3 ${column.tone}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-[#0E2340]">{column.title}</h3>
                          <p className="mt-0.5 text-[11px] text-[#607368]">{column.hint}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#4F6F5B] shadow-sm">
                          {column.items.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {column.items.length === 0 ? (
                          <div className="rounded-[20px] border border-dashed border-[#D6E8DA] bg-white/65 px-3 py-6 text-center text-xs text-[#607368]">
                            Sin registros
                          </div>
                        ) : null}

                        {column.items.map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => selectLead(lead)}
                            className={`w-full rounded-[22px] border p-3 text-left transition ${leadCardTone(lead, selectedLead?.id === lead.id)}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#C7EEE1,_#6C9C88)] text-sm font-bold text-[#1F3128]">
                                {displayName(lead).slice(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate text-sm font-semibold text-[#10233F]">
                                    {displayName(lead)}
                                  </p>
                                  {isInboundWithoutAnswer(lead) ? (
                                    <span className="shrink-0 rounded-full bg-[#FFF0E9] px-2 py-0.5 text-[10px] font-bold text-[#9A4E2E] ring-1 ring-[#EEC6B8]">
                                      Sin responder
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 truncate text-xs text-[#607368]">{lead.phone}</p>

                                {lead.appointment_date || lead.appointment_time ? (
                                  <p className="mt-1 text-xs font-semibold text-[#4F6F5B]">
                                    {formatAppointmentDate(lead.appointment_date)} · {formatAppointmentTime(lead.appointment_time)}
                                  </p>
                                ) : null}

                                <p className="mt-1 text-[11px] text-[#789084]">
                                  Ultimo: {formatDateTime(lead.last_inbound_at || lead.created_at)}
                                </p>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusTone(lead.appointment_status || lead.status)}`}>
                                    {lead.appointment_status ? statusLabel(lead.appointment_status) : conversationBadge(lead)}
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
                  ))}
                </div>
              </div>
            </aside>

            <div className={`min-w-0 flex-col bg-[linear-gradient(180deg,_#F1FAF4_0%,_#EAF5EE_100%)] ${selectedLead ? "flex h-[100dvh] lg:min-h-[720px]" : "hidden min-h-[620px] lg:flex lg:min-h-[720px]"}`}>
              {selectedLead ? (
                <>
                  <header className="shrink-0 border-b border-[#DCEDE3] bg-white/95 p-2.5 shadow-sm sm:p-3">
                    <button
                      type="button"
                      onClick={returnToList}
                      className="mb-2 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#CFE4D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4F6F5B] shadow-sm lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Volver
                    </button>
                    <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#C7EEE1,_#6C9C88)] text-sm font-bold text-[#1F3128]">
                          {displayName(selectedLead).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-[#0E2340] sm:text-lg">
                            {displayName(selectedLead)}
                          </h2>
                          <p className="mt-0.5 break-words text-xs text-[#607368]">
                            {selectedLead.phone} / {selectedLead.campaign_code || "-"}
                          </p>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(selectedLead.status)}`}>
                              {statusLabel(selectedLead.status)}
                            </span>
                          </div>
                          <div className="mt-1 grid gap-x-3 gap-y-0.5 text-[11px] text-[#607368] md:grid-cols-2">
                            <span>Correo: {selectedLead.email || "-"}</span>
                            <span>Origen: {selectedLead.source || "-"}</span>
                            <span>Creado: {formatDateTime(selectedLead.created_at)}</span>
                            <span>Ventana: {formatDateTime(selectedLead.reply_window_expires_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1.5 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
                        <button
                          type="button"
                          onClick={() => void loadMessages(selectedLead)}
                          disabled={loadingMessages}
                          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#CFE4D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {loadingMessages ? "Actualizando" : "Actualizar"}
                        </button>
                        {canShowScheduleAction(selectedLead) ? (
                          <button
                            type="button"
                            onClick={() => showActionPendingNotice("Gestionar cita")}
                            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#CFE4D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                          >
                            <CalendarCheck className="h-4 w-4" />
                            Gestionar cita
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => showActionPendingNotice("Marcar no responde")}
                          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#CFE4D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                        >
                          <Clock3 className="h-4 w-4" />
                          No responde
                        </button>
                        <button
                          type="button"
                          onClick={() => showActionPendingNotice("Cerrar conversacion")}
                          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#E6C9C5] bg-white px-3 py-1.5 text-xs font-semibold text-[#9A4E43] shadow-sm transition hover:-translate-y-0.5"
                        >
                          <XCircle className="h-4 w-4" />
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </header>

                  <div className="shrink-0 border-b border-[#DCEDE3] bg-[#F8FCF9]/95 px-3 py-1.5 sm:px-4">
                    <p className="rounded-xl border border-[#CFE4D8] bg-white/85 px-3 py-1.5 text-xs leading-5 text-[#496356]">
                      Ventana activa: puedes responder libremente dentro de 24h. Luego se requieren plantillas.
                    </p>
                  </div>

                  {conversationError || conversationNotice || attachmentNotice || !canReplyFreely(selectedLead) ? (
                    <div className="shrink-0 space-y-2 border-b border-[#DCEDE3] bg-white/75 px-3 py-2 sm:px-4 sm:py-3">
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

                  <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                    <div className="mx-auto max-w-4xl space-y-2.5">
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
                          const outboundMeta = outboundStatusMeta(message.status);

                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[88%] break-words rounded-[20px] px-3 py-2 shadow-sm sm:max-w-[78%] sm:px-3.5 sm:py-2.5 ${
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
                                <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
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
                                    <span className={outboundMeta.className}>{outboundMeta.label}</span>
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
                    className="shrink-0 border-t border-[#CFE4D8] bg-white/95 p-2 shadow-[0_-18px_40px_rgba(95,125,102,0.08)] backdrop-blur sm:p-3"
                  >
                    <div className="mx-auto max-w-4xl space-y-2">
                      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                        {quickReplies.map((reply) => (
                          <button
                            key={reply.label}
                            type="button"
                            onClick={() => insertQuickReply(reply.text)}
                            disabled={sendingReply || !canReplyFreely(selectedLead)}
                            className="shrink-0 rounded-full border border-[#CFE4D8] bg-[#F7FCF8] px-2.5 py-1 text-[11px] font-semibold text-[#4F6F5B] transition hover:-translate-y-0.5 hover:bg-[#EAF7EF] disabled:cursor-not-allowed disabled:opacity-60"
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

                      <div className="flex items-end gap-1.5 rounded-[20px] border border-[#CFE4D8] bg-[#F7FCF8] p-1.5">
                        <button
                          type="button"
                          onClick={() => setEmojiOpen((current) => !current)}
                          disabled={sendingReply || !canReplyFreely(selectedLead)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Emojis"
                        >
                          <Smile className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={showAttachmentBlockedNotice}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5"
                          title="Adjuntar imagen"
                        >
                          <Paperclip className="h-5 w-5" />
                        </button>
                        <textarea
                          ref={textareaRef}
                          className="max-h-28 min-h-9 min-w-0 flex-1 resize-none rounded-2xl border border-transparent bg-white px-3 py-2 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
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
                          className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
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
