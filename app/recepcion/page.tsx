"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { useSearchParams } from "next/navigation";
import StatCard from "@/components/ui/StatCard";
import Field from "@/components/ui/Field";
import {
  hasPendingDelivery,
  markDeliveryResolved,
  parseDeliveryRecommendation,
} from "@/lib/appointments/receptionDelivery";
import printAppointment from "@/lib/print/templates/printAppointment";
import printPlanInstructions from "@/lib/print/templates/printPlanInstructions";
import printNutritionSummary from "@/lib/print/templates/printNutritionSummary";
import printPhysiotherapySummary from "@/lib/print/templates/printPhysiotherapySummary";
import printReceptionRecord from "@/lib/print/templates/printReceptionRecord";
import { normalizeCommercialCaseLeadSource } from "@/lib/lead-source";
import {
  buildStoredCommercialNotes,
  parseStoredCommercialNotes,
} from "@/lib/commercial/notes";
import { digitsOnly } from "@/lib/users/userLookup";
import {
  getSectionForService,
  getSectionLabel,
  getServiceFieldLabel,
  getServiceOptionsBySection,
} from "@/lib/agenda/agendaSections";
import { specialistMatchesService } from "@/lib/agenda/specialists";
import {
  SLOT_OPTIONS,
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_CAPACITY,
  DEFAULT_SLOT_CAPACITY,
  getDurationOptions,
  getAllowedSlotOptions,
} from "@/lib/agenda/agendaDurations";
import {
  extraerDuracionDesdeNotas,
  buildSlotAvailability,
  formatSlotAvailabilityLabel,
} from "@/lib/agenda/agendaAvailability";

type LeadOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  phone: string;
  city: string | null;
  status: string;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  patient_name: string;
  phone: string | null;
  city: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  specialist_user_id: string | null;
  notes: string | null;
  checked_in_at: string | null;
  attended_at: string | null;
};

type UserRow = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad: string | null;
};

type SpecialistOption = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};


type AgendaDaySetting = {
  agenda_date: string;
  daily_capacity: number | null;
  is_closed: boolean;
};

type AgendaSlotSetting = {
  agenda_date: string;
  slot_time: string;
  capacity: number | null;
  is_blocked: boolean;
};

type SlotOption = {
  value: string;
  label: string;
};

type ReceptionFollowUpDraft = {
  service_type: string;
  specialist_user_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: string;
  notes: string;
};

type ReceptionSection = "agenda" | "especialistas" | "tratamientos" | "impresiones" | "inventario" | "comercial" | "nutricion_entregas";

type DeliveryLog = {
  id: string;
  patient_name: string;
  phone: string;
  product: string;
  quantity: number;
  notes: string;
  created_at: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  updated_at: string;
};

type InventoryMovement = {
  id: string;
  product_id: string;
  product_name: string;
  type: "entrada" | "salida" | "ajuste";
  quantity: number;
  movement_date?: string;
  lot_number?: string;
  notes: string;
  created_at: string;
};

type CommercialCaseRow = {
  id: string;
  lead_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  phone: string | null;
  city: string | null;
  assigned_commercial_user_id: string | null;
  assigned_by_user_id: string | null;
  assigned_at: string | null;
  status: string;
  commercial_notes: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  sales_assessment: string | null;
  proposal_text: string | null;
  payment_method: string | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  volume_amount: number | null;
  closing_notes: string | null;
  next_step_type: string | null;
  next_appointment_date: string | null;
  next_appointment_time: string | null;
  next_notes: string | null;
  closed_at: string | null;
  created_at: string;
};

type SourceUserOption = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};

type CommercialClinicalFlags = {
  hipertenso_descalifica: boolean;
  diabetico_descalifica: boolean;
  cirugias_descalifica: boolean;
  medicamentos_descalifica: boolean;
  enfermedades_descalifica: boolean;
};

type NutritionProfileRow = {
  user_id: string;
  antecedentes_patologicos: string | null;
  cirugias: string | null;
  toxicos: string | null;
  alergicos: string | null;
  medicamentos: string | null;
  familiares: string | null;
  peso: string | null;
  talla: string | null;
  perimetro_brazo: string | null;
  indice_masa_corporal: string | null;
  porcentaje_masa_corporal: string | null;
  dinamometria: string | null;
  masa_muscular: string | null;
  metabolismo_reposo: string | null;
  grasa_visceral: string | null;
  edad_corporal: string | null;
  circunferencia_cintura: string | null;
  perimetro_pantorrilla: string | null;
  clasificacion_nutricional: string | null;
  objetivo_nutricional: string | null;
  recomendaciones_nutricionales: string | null;
  datos_alimentarios: string | null;
  plan_nutricional: string | null;
  observaciones_generales: string | null;
};

type NutritionDeliverySelection = {
  appointment: AppointmentRow;
  userId: string | null;
  document: string;
  profile: NutritionProfileRow | null;
  recommendation: ReturnType<typeof parseDeliveryRecommendation>;
};

type PhysiotherapyProfileRow = {
  user_id: string;
  antecedentes_patologicos: string | null;
  cirugias: string | null;
  toxicos: string | null;
  alergicos: string | null;
  medicamentos: string | null;
  familiares: string | null;
  analisis_comercial: string | null;
  presion_arterial: string | null;
  frecuencia_cardiaca: string | null;
  inspeccion_general: string | null;
  dolor: string | null;
  inflamacion: string | null;
  limitacion_movilidad: string | null;
  prueba_semiologica: string | null;
  flexibilidad: string | null;
  fuerza_muscular: string | null;
  rangos_movimiento_articular: string | null;
  plan_intervencion: string | null;
  observaciones_generales: string | null;
};

type PortfolioFields = {
  installments_count: string;
  installment_value: string;
  first_installment_date: string;
};

type InstallmentPlanItem = {
  number: number;
  date: string;
  value: number;
};

const allowedRoles = [
  "super_user",
  "recepcion",
  "comercial",
  "gerencia_comercial",
  "tmk",
  "confirmador",
  "supervisor_call_center",
];

const appointmentStatusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "en_espera", label: "En espera" },
  { value: "asistio", label: "AsistiÃƒÆ’Ã‚Â³" },
  { value: "no_asistio", label: "No asistiÃƒÆ’Ã‚Â³" },
  { value: "reagendada", label: "Reagendada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "en_atencion", label: "En atenciÃƒÆ’Ã‚Â³n" },
  { value: "finalizada", label: "Finalizada" },
];

const manualSourceOptions = [
  { value: "lead_existente", label: "Lead existente" },
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "redes", label: "Redes" },
  { value: "referido", label: "Referido" },
  { value: "lugar", label: "Lugar" },
  { value: "evento", label: "Evento" },
  { value: "cliente_directo", label: "Cliente directo" },
  { value: "otro", label: "Otro" },
];

const commercialServiceOptions = [
  { value: "", label: "Selecciona" },
  { value: "valoracion", label: "Valoracion" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutricion" },
  { value: "medico", label: "Medico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "tratamiento_integral", label: "Tratamiento integral" },
];

const commercialPaymentOptions = [
  { value: "", label: "Selecciona" },
  { value: "contado", label: "Contado" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto" },
  { value: "cartera", label: "Cartera" },
  { value: "addi", label: "Addi" },
  { value: "welly", label: "Welly" },
  { value: "medipay", label: "MediPay" },
];

const commercialNextStepOptions = [
  { value: "", label: "Sin continuidad todavia" },
  { value: "nutricion", label: "Nutricion" },
  { value: "medico", label: "Medico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
];

type CommercialSourceDetailMeta = {
  label: string;
  placeholder: string;
  noteLabel: string;
  required?: boolean;
};

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isPhysiotherapyService(serviceType: string | null | undefined) {
  return (serviceType || "").toLowerCase().includes("fisio");
}

function hasPendingPhysiotherapyDelivery(notes: string | null | undefined) {
  return hasPendingDelivery(notes, "fisioterapia");
}

function limpiarPendienteFisioterapiaDeNotas(notes: string | null | undefined) {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => !/^Entrega fisioterapia pendiente:/i.test(line.trim()))
    .join("\n")
    .trim();
}

function marcarEntregaFisioterapiaResuelta(notes: string | null | undefined) {
  return markDeliveryResolved(notes, "fisioterapia");
}

function fullLeadName(lead: LeadOption) {
  return (
    lead.full_name?.trim() ||
    `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
    "Sin nombre"
  );
}

function normalizarFuenteManual(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";

  const found = manualSourceOptions.find(
    (item) => item.value.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  );

  return found?.value || normalized;
}

function traducirFuenteManual(value: string) {
  const normalized = normalizarFuenteManual(value);
  const found = manualSourceOptions.find((item) => item.value === normalized);
  return found?.label || value || "Sin fuente";
}

function serviceLabelComercial(value: string | null | undefined) {
  const found = commercialServiceOptions.find((item) => item.value === (value || ""));
  return found?.label || value || "Sin definir";
}

function paymentMethodLabelComercial(value: string | null | undefined) {
  const found = commercialPaymentOptions.find((item) => item.value === (value || ""));
  return found?.label || value || "Sin definir";
}

function nextStepLabelComercial(value: string | null | undefined) {
  const found = commercialNextStepOptions.find((item) => item.value === (value || ""));
  return found?.label || value || "No definida";
}

function isCommercialOutcomeCode(value: string | null | undefined) {
  return ["ganada", "perdida", "pendiente"].includes(value || "");
}

function getCommercialReceptionSummary(item: CommercialCaseRow) {
  const source =
    item.sale_result && !isCommercialOutcomeCode(item.sale_result)
      ? item.sale_result
      : parseStoredCommercialNotes(item.commercial_notes).receptionSummary;

  if (!source) return [];
  return source
    .split("|")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function numberFromMoneyText(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  const raw = String(value || "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function parsePortfolioDetails(text: string | null | undefined): PortfolioFields {
  const source = text || "";
  const installments = source.match(/N[ÃƒÆ’Ã‚Âºu]mero de cuotas:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const installmentValue = source.match(/Valor de la cuota:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const firstDate = source.match(/Fecha primera cuota:\s*([^\n]+)/i)?.[1]?.trim() || "";

  return {
    installments_count: installments,
    installment_value: installmentValue,
    first_installment_date: firstDate,
  };
}

function stripPortfolioDetails(text: string | null | undefined) {
  return (text || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        !/^Detalle cartera:/i.test(line) &&
        !/^N[ÃƒÆ’Ã‚Âºu]mero de cuotas:/i.test(line) &&
        !/^Valor de la cuota:/i.test(line) &&
        !/^Fecha primera cuota:/i.test(line) &&
        !/^Plan de cuotas:/i.test(line) &&
        !/^\d+\.\s*\d{4}-\d{2}-\d{2}\s*[Ãƒâ€šÃ‚Â·-]\s*\$/i.test(line)
    )
    .join("\n")
    .trim();
}

function addMonthsKeepingDay(isoDate: string, monthOffset: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(y, m - 1 + monthOffset, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(d, lastDay);
  const result = new Date(base.getFullYear(), base.getMonth(), safeDay);
  const yy = result.getFullYear();
  const mm = String(result.getMonth() + 1).padStart(2, "0");
  const dd = String(result.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function buildInstallmentPlan(firstDate: string, count: number, value: number): InstallmentPlanItem[] {
  if (!firstDate || !count || count < 1 || !value) return [];
  return Array.from({ length: count }).map((_, index) => ({
    number: index + 1,
    date: addMonthsKeepingDay(firstDate, index),
    value,
  }));
}

function hasCommercialSale(item: CommercialCaseRow) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0) ||
    (item.volume_amount && Number(item.volume_amount) > 0)
  );
}

function extraerFuenteManualDesdeNotas(notes: string | null | undefined) {
  if (!notes) return "";
  const match = notes.match(/^Fuente:\s*(.+)$/im);
  if (!match?.[1]) return "";
  return normalizarFuenteManual(match[1]);
}

function getCommercialSourceDetailMeta(value: string): CommercialSourceDetailMeta | null {
  switch (normalizarFuenteManual(value)) {
    case "opc":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã‚Â© OPC fue?",
        placeholder: "Ej: OPC Centro",
        noteLabel: "Detalle OPC",
        required: true,
      };
    case "tmk":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã‚Â© TMK fue?",
        placeholder: "Ej: TMK campaÃƒÆ’Ã‚Â±a abril",
        noteLabel: "Detalle TMK",
        required: true,
      };
    case "redes":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã‚Â© red fue?",
        placeholder: "Ej: Facebook, Instagram",
        noteLabel: "Detalle red",
        required: true,
      };
    case "referido":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuiÃƒÆ’Ã‚Â©n lo refiriÃƒÆ’Ã‚Â³?",
        placeholder: "Escribe quiÃƒÆ’Ã‚Â©n refiriÃƒÆ’Ã‚Â³",
        noteLabel: "Referido por",
        required: true,
      };
    case "lugar":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã‚Â© lugar fue?",
        placeholder: "Ej: Centro comercial, clÃƒÆ’Ã‚Â­nica",
        noteLabel: "Detalle lugar",
        required: true,
      };
    case "evento":
      return {
        label: "Ãƒâ€šÃ‚Â¿QuÃƒÆ’Ã‚Â© evento fue?",
        placeholder: "Ej: Feria de salud",
        noteLabel: "Detalle evento",
        required: true,
      };
    case "cliente_directo":
      return {
        label: "Detalle del cliente directo",
        placeholder: "Opcional",
        noteLabel: "Detalle cliente directo",
      };
    case "otro":
      return {
        label: "Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã‚Â¡l fue la fuente?",
        placeholder: "Describe la fuente",
        noteLabel: "Detalle fuente",
        required: true,
      };
    default:
      return null;
  }
}

function limpiarFuenteManualDeNotas(notes: string | null | undefined) {
  if (!notes) return "";

  return notes
    .split("\n")
    .filter((line) => !/^Fuente:\s*/i.test(line.trim()))
    .join("\n")
    .trim();
}

function construirNotasConFuente(notes: string, manualSource: string) {
  const cleanNotes = limpiarFuenteManualDeNotas(notes);
  const sourceLabel = traducirFuenteManual(manualSource);

  if (!manualSource) return cleanNotes;
  if (!cleanNotes) return `Fuente: ${sourceLabel}`;

  return `Fuente: ${sourceLabel}\n${cleanNotes}`;
}

function limpiarMetadatosAgenda(notes: string | null | undefined) {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !/^Fuente:\s*/i.test(trimmed) && !/^DuraciÃƒÆ’Ã‚Â³n:\s*/i.test(trimmed);
    })
    .join("\n")
    .trim();
}

function construirNotasAgenda({
  notes,
  manualSource,
  durationMinutes,
}: {
  notes: string;
  manualSource: string;
  durationMinutes: number;
}) {
  const lines: string[] = [];

  if (manualSource) {
    lines.push(`Fuente: ${traducirFuenteManual(manualSource)}`);
  }

  lines.push(`DuraciÃƒÆ’Ã‚Â³n: ${durationMinutes} min`);

  const cleanNotes = limpiarMetadatosAgenda(notes);
  if (cleanNotes) {
    lines.push(cleanNotes);
  }

  return lines.join("\n").trim();
}

function badgeEstado(status: string) {
  switch (status) {
    case "agendada":
      return "bg-slate-100 text-slate-700";
    case "confirmada":
      return "bg-blue-100 text-blue-700";
    case "en_espera":
      return "bg-amber-100 text-amber-700";
    case "asistio":
      return "bg-emerald-100 text-emerald-700";
    case "no_asistio":
      return "bg-rose-100 text-rose-700";
    case "reagendada":
      return "bg-violet-100 text-violet-700";
    case "cancelada":
      return "bg-red-100 text-red-700";
    case "en_atencion":
      return "bg-cyan-100 text-cyan-700";
    case "finalizada":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function traducirEstado(status: string) {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    en_espera: "En espera",
    asistio: "AsistiÃƒÆ’Ã‚Â³",
    no_asistio: "No asistiÃƒÆ’Ã‚Â³",
    reagendada: "Reagendada",
    cancelada: "Cancelada",
    en_atencion: "En atenciÃƒÆ’Ã‚Â³n",
    finalizada: "Finalizada",
  };
  return map[status] || status;
}

function traducirEstadoComercial(status: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente de asignaciÃƒÆ’Ã‚Â³n",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atenciÃƒÆ’Ã‚Â³n",
    seguimiento: "Seguimiento",
    finalizado: "Finalizado",
  };
  return map[status || ""] || status || "Sin estado";
}

function badgeEstadoComercial(status: string | null | undefined) {
  switch (status) {
    case "pendiente_asignacion_comercial":
      return "bg-amber-100 text-amber-700";
    case "asignado_comercial":
      return "bg-blue-100 text-blue-700";
    case "en_atencion_comercial":
      return "bg-cyan-100 text-cyan-700";
    case "seguimiento":
      return "bg-violet-100 text-violet-700";
    case "finalizado":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}


function isNutritionService(serviceType: string | null | undefined) {
  return (serviceType || "").toLowerCase().includes("nutri");
}

function hasPendingNutritionDelivery(notes: string | null | undefined) {
  return hasPendingDelivery(notes, "nutricion");
}

function limpiarPendienteNutricionDeNotas(notes: string | null | undefined) {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => !/^Entrega nutriciÃƒÆ’Ã‚Â³n pendiente:/i.test(line.trim()))
    .join("\n")
    .trim();
}

function marcarEntregaNutricionResuelta(notes: string | null | undefined) {
  return markDeliveryResolved(notes, "nutricion");
}

function imprimirDocumentoNutricional({
  appointment,
  document,
  profile,
}: {
  appointment: AppointmentRow;
  document: string;
  profile: NutritionProfileRow | null;
}) {
  if (typeof window === "undefined") return;

  const nuevaVentana = window.open("", "_blank", "width=900,height=700");
  if (!nuevaVentana) return;

  const texto = (value: string | null | undefined) => value || "";

  nuevaVentana.document.write(`
    <html>
      <head>
        <title>Documento nutricional</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          h1 { margin-bottom: 8px; }
          h2 { margin-top: 28px; margin-bottom: 10px; font-size: 18px; }
          .muted { color: #475569; margin: 4px 0; }
          .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; margin-top: 14px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .item { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
        </style>
      </head>
      <body>
        <h1>Documento nutricional</h1>
        <p class="muted">CRM Prevital Ãƒâ€šÃ‚Â· RecepciÃƒÆ’Ã‚Â³n</p>
        <div class="box">
          <p><strong>Cliente:</strong> ${texto(appointment.patient_name)}</p>
          <p><strong>Documento:</strong> ${texto(document)}</p>
          <p><strong>TelÃƒÆ’Ã‚Â©fono:</strong> ${texto(appointment.phone)}</p>
          <p><strong>Ciudad:</strong> ${texto(appointment.city)}</p>
          <p><strong>Fecha:</strong> ${texto(appointment.appointment_date)}</p>
          <p><strong>Hora:</strong> ${texto(formatHora(appointment.appointment_time))}</p>
        </div>

        <h2>Antecedentes</h2>
        <div class="grid">
          <div class="item"><strong>PatolÃƒÆ’Ã‚Â³gicos</strong><br/>${texto(profile?.antecedentes_patologicos)}</div>
          <div class="item"><strong>CirugÃƒÆ’Ã‚Â­as</strong><br/>${texto(profile?.cirugias)}</div>
          <div class="item"><strong>TÃƒÆ’Ã‚Â³xicos</strong><br/>${texto(profile?.toxicos)}</div>
          <div class="item"><strong>AlÃƒÆ’Ã‚Â©rgicos</strong><br/>${texto(profile?.alergicos)}</div>
          <div class="item"><strong>Medicamentos</strong><br/>${texto(profile?.medicamentos)}</div>
          <div class="item"><strong>Familiares</strong><br/>${texto(profile?.familiares)}</div>
        </div>

        <h2>ValoraciÃƒÆ’Ã‚Â³n nutricional</h2>
        <div class="grid">
          <div class="item"><strong>Peso</strong><br/>${texto(profile?.peso)}</div>
          <div class="item"><strong>Talla</strong><br/>${texto(profile?.talla)}</div>
          <div class="item"><strong>PerÃƒÆ’Ã‚Â­metro brazo</strong><br/>${texto(profile?.perimetro_brazo)}</div>
          <div class="item"><strong>IMC</strong><br/>${texto(profile?.indice_masa_corporal)}</div>
          <div class="item"><strong>Grasa corporal</strong><br/>${texto(profile?.porcentaje_masa_corporal)}</div>
          <div class="item"><strong>DinamometrÃƒÆ’Ã‚Â­a</strong><br/>${texto(profile?.dinamometria)}</div>
          <div class="item"><strong>Masa muscular</strong><br/>${texto(profile?.masa_muscular)}</div>
          <div class="item"><strong>Metabolismo en reposo</strong><br/>${texto(profile?.metabolismo_reposo)}</div>
          <div class="item"><strong>Grasa visceral</strong><br/>${texto(profile?.grasa_visceral)}</div>
          <div class="item"><strong>Edad corporal</strong><br/>${texto(profile?.edad_corporal)}</div>
          <div class="item"><strong>Circunferencia cintura</strong><br/>${texto(profile?.circunferencia_cintura)}</div>
          <div class="item"><strong>PerÃƒÆ’Ã‚Â­metro pantorrilla</strong><br/>${texto(profile?.perimetro_pantorrilla)}</div>
          <div class="item"><strong>ClasificaciÃƒÆ’Ã‚Â³n</strong><br/>${texto(profile?.clasificacion_nutricional)}</div>
        </div>

        <h2>Plan</h2>
        <div class="box">
          <p><strong>Objetivo nutricional:</strong><br/>${texto(profile?.objetivo_nutricional)}</p>
          <p><strong>Recomendaciones nutricionales:</strong><br/>${texto(profile?.recomendaciones_nutricionales)}</p>
          <p><strong>Datos alimentarios:</strong><br/>${texto(profile?.datos_alimentarios)}</p>
          <p><strong>Plan nutricional:</strong><br/>${texto(profile?.plan_nutricional)}</p>
          <p><strong>Observaciones:</strong><br/>${texto(profile?.observaciones_generales)}</p>
        </div>
      </body>
    </html>
  `);
  nuevaVentana.document.close();
  nuevaVentana.focus();
  nuevaVentana.print();
}



function emptyCommercialClinicalFlags(): CommercialClinicalFlags {
  return {
    hipertenso_descalifica: false,
    diabetico_descalifica: false,
    cirugias_descalifica: false,
    medicamentos_descalifica: false,
    enfermedades_descalifica: false,
  };
}



const commercialOccupationOptions = [
  { value: "empleado", label: "Empleado" },
  { value: "independiente", label: "Independiente" },
  { value: "pensionado", label: "Pensionado" },
  { value: "otro", label: "Otro" },
] as const;


const commercialOccupationDisqualifyingValues = new Set<string>([
  "desempleado",
  "estudiante",
  "empleado_salud",
]);

const commercialOccupationOtherDisqualifyingTerms = [
  "desempleado",
  "estudiante",
  "empleado de la salud",
  "salud",
];

function shouldAskOccupationDetail(ocupacion: string) {
  return ["empleado", "independiente", "otro"].includes(ocupacion);
}

function getOccupationDetailLabel(ocupacion: string) {
  if (ocupacion === "empleado") return "Cual empleo?";
  if (ocupacion === "independiente") return "Cual actividad independiente?";
  return "Cual ocupacion?";
}

function calcularClasificacionInicial(values: {
  edad: string;
  tiene_eps: string;
  afiliacion: string;
  trae_cedula: string;
  celular_inteligente: string;
  ocupacion: string;
  ocupacion_otro?: string;
  hipertenso: string;
  diabetico: string;
  cirugias: string;
  cirugias_cual?: string;
  medicamentos: string;
  medicamentos_cual?: string;
  enfermedades: string;
  enfermedades_cual?: string;
  clinical_flags: CommercialClinicalFlags;
}) {
  const motivos: string[] = [];
  const edad = Number(values.edad || "0");
  const ocupacionOtroNormalizada = (values.ocupacion_otro || "").trim().toLowerCase();
  const ocupacionDescalificante =
    commercialOccupationDisqualifyingValues.has(values.ocupacion) ||
    (shouldAskOccupationDetail(values.ocupacion) &&
      commercialOccupationOtherDisqualifyingTerms.some((term) =>
        ocupacionOtroNormalizada.includes(term)
      ));

  if (!edad || Number.isNaN(edad) || edad < 40 || edad > 69) {
    motivos.push("edad fuera del rango de 40 a 69 aÃƒÆ’Ã‚Â±os");
  }

  if (values.tiene_eps !== "si") {
    motivos.push("no tiene EPS");
  }

  if (values.afiliacion !== "cotizante") {
    motivos.push("no es cotizante");
  }

  if (values.trae_cedula !== "si") {
    motivos.push("no asiste con cÃƒÆ’Ã‚Â©dula");
  }

  if (values.celular_inteligente !== "si") {
    motivos.push("no tiene celular inteligente");
  }

  if (ocupacionDescalificante) {
    motivos.push("ocupaciÃƒÆ’Ã‚Â³n descalificante");
  }

  if (values.hipertenso === "si" && values.clinical_flags.hipertenso_descalifica) {
    motivos.push("hipertensiÃƒÆ’Ã‚Â³n descalificante");
  }

  if (values.diabetico === "si" && values.clinical_flags.diabetico_descalifica) {
    motivos.push("diabetes descalificante");
  }

  if (values.cirugias === "si" && values.clinical_flags.cirugias_descalifica) {
    motivos.push("cirugÃƒÆ’Ã‚Â­a descalificante");
  }

  if (values.medicamentos === "si" && values.clinical_flags.medicamentos_descalifica) {
    motivos.push("medicamento descalificante");
  }

  if (values.enfermedades === "si" && values.clinical_flags.enfermedades_descalifica) {
    motivos.push("enfermedad descalificante");
  }

  return {
    clasificacion: motivos.length === 0 ? "Q" : "No Q",
    motivo:
      motivos.length === 0
        ? "Q inicial: cumple todos los criterios base."
        : `No Q por ${motivos.join(", ")}.`,
  };
}

function getCommercialDisqualifyingConditions(values: {
  hipertenso: string;
  diabetico: string;
  cirugias: string;
  medicamentos: string;
  enfermedades: string;
  clinical_flags: CommercialClinicalFlags;
}) {
  return [
    values.hipertenso === "si" && values.clinical_flags.hipertenso_descalifica
      ? "HipertensiÃƒÆ’Ã‚Â³n descalificante"
      : "",
    values.diabetico === "si" && values.clinical_flags.diabetico_descalifica
      ? "Diabetes descalificante"
      : "",
    values.cirugias === "si" && values.clinical_flags.cirugias_descalifica
      ? "CirugÃƒÆ’Ã‚Â­a descalificante"
      : "",
    values.medicamentos === "si" && values.clinical_flags.medicamentos_descalifica
      ? "Medicamento descalificante"
      : "",
    values.enfermedades === "si" && values.clinical_flags.enfermedades_descalifica
      ? "Enfermedad descalificante"
      : "",
  ].filter(Boolean);
}

function normalizarHora(value: string) {
  return value.slice(0, 5);
}

function startOfWeekISO(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setDate(date.getDate() + offset);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysToISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekdayShort(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function buildMonthCalendarDates(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  const firstDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeekISO(firstDate);
  return Array.from({ length: 42 }, (_, index) => addDaysToISO(start, index));
}

function isSameMonthISO(firstDate: string, secondDate: string) {
  return firstDate.slice(0, 7) === secondDate.slice(0, 7);
}

function createEmptyReceptionFollowUp(defaultDate: string, defaultTime: string): ReceptionFollowUpDraft {
  return {
    service_type: "",
    specialist_user_id: "",
    appointment_date: defaultDate,
    appointment_time: defaultTime,
    duration_minutes: "30",
    notes: "",
  };
}

function RecepcionContent() {
  const searchParams = useSearchParams();
  const leadIdFromUrl = searchParams.get("leadId");
  const receptionView = searchParams.get("view");
  const lookupFromUrl =
    searchParams.get("documento") ||
    searchParams.get("cedula") ||
    searchParams.get("buscar") ||
    "";

  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [queueActionId, setQueueActionId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);

  const [fechaFiltro, setFechaFiltro] = useState(hoyISO());
  const [busquedaAgenda, setBusquedaAgenda] = useState("");
  const [agendaViewMode, setAgendaViewMode] = useState<"dia" | "semana" | "mes">("dia");
  const [busquedaLead, setBusquedaLead] = useState("");
  const [manualClientLookup, setManualClientLookup] = useState("");
  const [loadingManualClientLookup, setLoadingManualClientLookup] = useState(false);
  const [loadingCommercialClientLookup, setLoadingCommercialClientLookup] = useState(false);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const [daySettings, setDaySettings] = useState<Record<string, AgendaDaySetting>>({});
  const [slotSettings, setSlotSettings] = useState<Record<string, AgendaSlotSetting>>({});
  const [dailyCapacityInput, setDailyCapacityInput] = useState(String(DEFAULT_DAILY_CAPACITY));
  const [dailyClosedInput, setDailyClosedInput] = useState(false);
  const [slotCapacityInputs, setSlotCapacityInputs] = useState<Record<string, string>>({});
  const [slotBlockedInputs, setSlotBlockedInputs] = useState<Record<string, boolean>>({});

  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedQuickAppointmentId, setSelectedQuickAppointmentId] = useState<string | null>(null);
  const [selectedCommercialAppointmentId, setSelectedCommercialAppointmentId] = useState<string | null>(null);
  const [extraAppointments, setExtraAppointments] = useState<ReceptionFollowUpDraft[]>([]);
  const [activeSection, setActiveSection] = useState<ReceptionSection>("agenda");
  const [lastSavedAppointmentPrint, setLastSavedAppointmentPrint] = useState<AppointmentRow | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [printSearch, setPrintSearch] = useState("");
  const [deliveryProduct, setDeliveryProduct] = useState("");
  const [deliveryQuantity, setDeliveryQuantity] = useState("1");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryProductId, setInventoryProductId] = useState("");
  const [inventoryNewProduct, setInventoryNewProduct] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("nutraceutico");
  const [inventoryMovementType, setInventoryMovementType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [inventoryMovementDate, setInventoryMovementDate] = useState(hoyISO());
  const [inventoryLotNumber, setInventoryLotNumber] = useState("");
  const [inventoryMinStock, setInventoryMinStock] = useState("5");
  const [inventoryMovementNotes, setInventoryMovementNotes] = useState("");
  const [selectedNutritionDeliveryId, setSelectedNutritionDeliveryId] = useState<string | null>(null);
  const [nutritionDeliverySearch, setNutritionDeliverySearch] = useState("");
  const [nutritionDeliveryProductId, setNutritionDeliveryProductId] = useState("");
  const [nutritionDeliveryQuantity, setNutritionDeliveryQuantity] = useState("1");
  const [nutritionDeliveryNotes, setNutritionDeliveryNotes] = useState("");
  const [nutritionSelection, setNutritionSelection] = useState<NutritionDeliverySelection | null>(null);
  const [lastNutritionPrintSelection, setLastNutritionPrintSelection] =
    useState<NutritionDeliverySelection | null>(null);
  const [loadingNutritionSelection, setLoadingNutritionSelection] = useState(false);
  const [savingNutritionDelivery, setSavingNutritionDelivery] = useState(false);
  const [commercialCases, setCommercialCases] = useState<CommercialCaseRow[]>([]);
  const [savingCommercialIntake, setSavingCommercialIntake] = useState(false);
  const [commercialSearch, setCommercialSearch] = useState("");
  const [sourceUsers, setSourceUsers] = useState<SourceUserOption[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [lastCommercialPrintData, setLastCommercialPrintData] =
    useState<Parameters<typeof printReceptionRecord>[0] | null>(null);
  const [commercialForm, setCommercialForm] = useState({
    customer_name: "",
    phone: "",
    city: "",
    documento: "",
    fuente: "",
    fuente_detalle: "",
    fuente_usuario_id: "",
    observaciones: "",
    acompanante_nombre: "",
    acompanante_parentesco: "",
    tiene_eps: "si",
    afiliacion: "",
    ocupacion: "",
    ocupacion_otro: "",
    edad: "",
    trae_cedula: "si",
    celular_inteligente: "si",
    hipertenso: "no",
    diabetico: "no",
    cirugias: "no",
    cirugias_cual: "",
    medicamentos: "no",
    medicamentos_cual: "",
    enfermedades: "no",
    enfermedades_cual: "",
    tiempo_detox_30_min: "",
    clinical_flags: emptyCommercialClinicalFlags(),
    clasificacion_inicial: "No Q",
    clasificacion_motivo: "",
    referido_por: "",
  });

  const [form, setForm] = useState({
    mode: leadIdFromUrl ? "lead" : "lead",
    lead_id: "",
    patient_name: "",
    phone: "",
    city: "",
    manual_source: "",
    appointment_date: hoyISO(),
    appointment_time: "08:00",
    duration_minutes: "30",
    status: "agendada",
    service_type: "",
    specialist_user_id: "",
    notes: "",
  });

  const isReadOnlyAgendaForCall =
    currentRoleCode === "tmk" || currentRoleCode === "confirmador";

  const isCommercialReceptionOnly =
    currentRoleCode === "comercial" || currentRoleCode === "gerencia_comercial";

  const isEmbeddedCommercialCreationView =
    receptionView === "comercial" && isCommercialReceptionOnly;

  const isLimitedReceptionForCall =
    currentRoleCode === "tmk" ||
    currentRoleCode === "confirmador" ||
    currentRoleCode === "supervisor_call_center";

  const commercialBackHref =
    currentRoleCode === "gerencia_comercial" ? "/gerencia/comercial" : "/comercial";

  const serviceOptions = useMemo(() => activeSection === "nutricion_entregas" ? [] : getServiceOptionsBySection(activeSection), [activeSection]);
  const serviceFieldLabel = useMemo(() => activeSection === "nutricion_entregas" ? "Servicio" : getServiceFieldLabel(activeSection), [activeSection]);
  const sectionLabel = useMemo(() => activeSection === "nutricion_entregas" ? "Entregas nutriciÃƒÆ’Ã‚Â³n" : getSectionLabel(activeSection), [activeSection]);
  const canShowWeeklyAgenda =
    activeSection === "especialistas" || activeSection === "tratamientos";
  const agendaVisibleTitle = useMemo(() => {
    if (activeSection === "especialistas") return "Agenda visible de especialistas";
    if (activeSection === "tratamientos") return "Agenda visible de tratamientos";
    return "Agenda visible del dÃƒÂ­a";
  }, [activeSection]);
  const agendaVisibleDescription = useMemo(() => {
    if (activeSection === "especialistas") {
      return "Vista diaria de especialistas por nombre, telÃƒÂ©fono y fecha.";
    }

    if (activeSection === "tratamientos") {
      return "Vista diaria de tratamientos por nombre, telÃƒÂ©fono y fecha.";
    }

    return `Vista diaria de ${sectionLabel.toLowerCase()} por nombre, telÃƒÂ©fono y fecha.`;
  }, [activeSection, sectionLabel]);
  const normalizedAgendaVisibleTitle = useMemo(
    () =>
      agendaVisibleTitle
        .replaceAll("dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a", "d\u00EDa")
        .replaceAll("dÃƒÂ­a", "d\u00EDa"),
    [agendaVisibleTitle]
  );
  const normalizedAgendaVisibleDescription = useMemo(
    () =>
      agendaVisibleDescription
        .replaceAll("telÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©fono", "tel\u00E9fono")
        .replaceAll("telÃƒÂ©fono", "tel\u00E9fono"),
    [agendaVisibleDescription]
  );
  const weeklyAgendaTitle = useMemo(() => {
    if (activeSection === "especialistas") return "Calendario semanal de especialistas";
    if (activeSection === "tratamientos") return "Calendario semanal de tratamientos";
    return "Agenda semanal";
  }, [activeSection]);
  const durationOptions = useMemo(
    () => activeSection === "nutricion_entregas" ? [] : getDurationOptions(activeSection, form.service_type, form.appointment_date),
    [activeSection, form.service_type, form.appointment_date]
  );

  const filteredSpecialists = useMemo(() => {
    if (activeSection !== "especialistas" && activeSection !== "tratamientos") {
      return [];
    }

    return specialists.filter((item) => specialistMatchesService(form.service_type, item.role_code));
  }, [activeSection, form.service_type, specialists]);

  const specialistNameById = useMemo(
    () =>
      new Map(
        specialists.map((item) => [
          item.id,
          `${item.full_name}${item.role_name ? ` Ãƒâ€šÃ‚Â· ${item.role_name}` : ""}`,
        ])
      ),
    [specialists]
  );

  const canManageAgendaConfig =
    currentRoleCode === "super_user" || currentRoleCode === "supervisor_call_center";
  const commercialSourceDetailMeta = getCommercialSourceDetailMeta(commercialForm.fuente);
  const normalizedCommercialSource = normalizarFuenteManual(commercialForm.fuente);
  const sourceNeedsUserSelection =
    normalizedCommercialSource === "opc" || normalizedCommercialSource === "tmk";
  const availableSourceUsers = useMemo(() => {
    if (normalizedCommercialSource === "opc") {
      return sourceUsers.filter((item) =>
        ["promotor_opc", "supervisor_opc"].includes(item.role_code)
      );
    }

    if (normalizedCommercialSource === "tmk") {
      return sourceUsers.filter((item) =>
        ["tmk", "confirmador", "supervisor_call_center"].includes(item.role_code)
      );
    }

    return [];
  }, [normalizedCommercialSource, sourceUsers]);
  const selectedSourceUser = useMemo(
    () => sourceUsers.find((item) => item.id === commercialForm.fuente_usuario_id) || null,
    [sourceUsers, commercialForm.fuente_usuario_id]
  );
  const occupationNeedsDetail = shouldAskOccupationDetail(commercialForm.ocupacion);

  useEffect(() => {
    if (!form.specialist_user_id) return;
    if (filteredSpecialists.some((item) => item.id === form.specialist_user_id)) return;

    setForm((prev) => ({
      ...prev,
      specialist_user_id: "",
    }));
  }, [filteredSpecialists, form.specialist_user_id]);

  useEffect(() => {
    setExtraAppointments((prev) =>
      prev.map((item) =>
        item.specialist_user_id &&
        !specialists.some(
          (specialist) =>
            specialist.id === item.specialist_user_id &&
            specialistMatchesService(item.service_type, specialist.role_code)
        )
          ? { ...item, specialist_user_id: "" }
          : item
      )
    );
  }, [specialists]);

  async function findExistingUserByLookup(rawLookup: string) {
    const normalizedLookup = rawLookup.trim();
    const lookupDigits = digitsOnly(rawLookup);

    if (!normalizedLookup && !lookupDigits) return null;

    if (lookupDigits) {
      const { data: byDocument, error: documentError } = await supabase
        .from("users")
        .select("id, nombre, documento, telefono, ciudad")
        .eq("documento", lookupDigits)
        .limit(1);

      if (documentError) throw documentError;
      if (byDocument && byDocument.length > 0) {
        return byDocument[0] as UserRow;
      }

      const { data: byPhone, error: phoneError } = await supabase
        .from("users")
        .select("id, nombre, documento, telefono, ciudad")
        .eq("telefono", lookupDigits)
        .limit(1);

      if (phoneError) throw phoneError;
      if (byPhone && byPhone.length > 0) {
        return byPhone[0] as UserRow;
      }
    }

    const { data: byName, error: nameError } = await supabase
      .from("users")
      .select("id, nombre, documento, telefono, ciudad")
      .ilike("nombre", normalizedLookup)
      .limit(1);

    if (nameError) throw nameError;
    if (byName && byName.length > 0) {
      return byName[0] as UserRow;
    }

    return null;
  }

  function applyExistingUserToAppointment(user: UserRow) {
    setForm((prev) => ({
      ...prev,
      patient_name: user.nombre || prev.patient_name,
      phone: user.telefono || prev.phone,
      city: user.ciudad || prev.city,
    }));
  }

  function applyExistingUserToCommercial(user: UserRow) {
    setCommercialForm((prev) => ({
      ...prev,
      customer_name: user.nombre || prev.customer_name,
      phone: user.telefono || prev.phone,
      city: user.ciudad || prev.city,
      documento: user.documento || prev.documento,
    }));
  }

  useEffect(() => {
    if (
      receptionView === "comercial" ||
      currentRoleCode === "comercial" ||
      currentRoleCode === "gerencia_comercial"
    ) {
      setActiveSection("comercial");
    }
  }, [receptionView, currentRoleCode]);

  useEffect(() => {
    if (!lookupFromUrl.trim()) return;

    if (receptionView === "comercial") {
      setCommercialForm((prev) => ({
        ...prev,
        documento: lookupFromUrl.trim(),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      mode: "manual",
    }));
    setManualClientLookup(lookupFromUrl.trim());
  }, [lookupFromUrl, receptionView]);

  useEffect(() => {
    if (form.mode !== "manual") return;
    const lookup = manualClientLookup.trim();
    if (lookup.length < 5) return;

    const timeout = setTimeout(async () => {
      try {
        setLoadingManualClientLookup(true);
        const foundUser = await findExistingUserByLookup(lookup);
        if (!foundUser) return;
        applyExistingUserToAppointment(foundUser);
      } catch (err) {
        console.error("No se pudo autocompletar el cliente en recepcion:", err);
      } finally {
        setLoadingManualClientLookup(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [form.mode, manualClientLookup]);

  useEffect(() => {
    const lookup = commercialForm.documento.trim();
    if (lookup.length < 5) return;

    const timeout = setTimeout(async () => {
      try {
        setLoadingCommercialClientLookup(true);
        const foundUser = await findExistingUserByLookup(lookup);
        if (!foundUser) return;
        applyExistingUserToCommercial(foundUser);
      } catch (err) {
        console.error("No se pudo autocompletar el ingreso comercial:", err);
      } finally {
        setLoadingCommercialClientLookup(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [commercialForm.documento]);

  useEffect(() => {
    if (activeSection === "nutricion_entregas") return;
    const options = getDurationOptions(activeSection, form.service_type, form.appointment_date);
    if (options.length === 0) return;

    const currentDurationIsValid = options.some((item) => item.value === form.duration_minutes);
    if (!currentDurationIsValid) {
      setForm((prev) => ({
        ...prev,
        duration_minutes: options[0].value,
      }));
      return;
    }

    const allowedSlots = getAllowedSlotOptions(
      activeSection,
      form.service_type,
      form.appointment_date,
      Number(form.duration_minutes || "30")
    );

    if (allowedSlots.length > 0 && !allowedSlots.some((slot) => slot.value === form.appointment_time)) {
      setForm((prev) => ({
        ...prev,
        appointment_time: allowedSlots[0].value,
      }));
    }
  }, [activeSection, form.service_type, form.appointment_date, form.duration_minutes]);

  useEffect(() => {
    const resultado = calcularClasificacionInicial({
      edad: commercialForm.edad,
      tiene_eps: commercialForm.tiene_eps,
      afiliacion: commercialForm.afiliacion,
      trae_cedula: commercialForm.trae_cedula,
      celular_inteligente: commercialForm.celular_inteligente,
      ocupacion: commercialForm.ocupacion,
      ocupacion_otro: commercialForm.ocupacion_otro,
      hipertenso: commercialForm.hipertenso,
      diabetico: commercialForm.diabetico,
      cirugias: commercialForm.cirugias,
      cirugias_cual: commercialForm.cirugias_cual,
      medicamentos: commercialForm.medicamentos,
      medicamentos_cual: commercialForm.medicamentos_cual,
      enfermedades: commercialForm.enfermedades,
      enfermedades_cual: commercialForm.enfermedades_cual,
      clinical_flags: commercialForm.clinical_flags,
    });

    setCommercialForm((prev) =>
      prev.clasificacion_inicial === resultado.clasificacion &&
      prev.clasificacion_motivo === resultado.motivo
        ? prev
        : {
            ...prev,
            clasificacion_inicial: resultado.clasificacion,
            clasificacion_motivo: resultado.motivo,
          }
    );
  }, [
    commercialForm.edad,
    commercialForm.tiene_eps,
    commercialForm.afiliacion,
    commercialForm.trae_cedula,
    commercialForm.celular_inteligente,
    commercialForm.ocupacion,
    commercialForm.ocupacion_otro,
    commercialForm.hipertenso,
    commercialForm.diabetico,
    commercialForm.cirugias,
    commercialForm.cirugias_cual,
    commercialForm.medicamentos,
    commercialForm.medicamentos_cual,
    commercialForm.enfermedades,
    commercialForm.enfermedades_cual,
    commercialForm.clinical_flags,
  ]);

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesiÃƒÆ’Ã‚Â³n para usar este mÃƒÆ’Ã‚Â³dulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a RecepciÃƒÆ’Ã‚Â³n.");
        return;
      }

      setAuthorized(true);
      setCurrentUserId(auth.user.id);
      setCurrentRoleCode(auth.roleCode);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const [
        appointmentsResult,
        leadsResult,
        daySettingsResult,
        slotSettingsResult,
        commercialCasesResult,
        sourceUsersResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            id,
            lead_id,
            patient_name,
            phone,
            city,
            appointment_date,
            appointment_time,
            status,
            service_type,
            specialist_user_id,
            notes,
            checked_in_at,
            attended_at
          `)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true }),

        supabase
          .from("leads")
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            phone,
            city,
            status
          `)
          .order("created_at", { ascending: false })
          .limit(300),

        supabase
          .from("agenda_day_settings")
          .select("agenda_date, daily_capacity, is_closed"),

        supabase
          .from("agenda_slot_settings")
          .select("agenda_date, slot_time, capacity, is_blocked"),

        supabase
          .from("commercial_cases")
          .select(`
            id,
            lead_id,
            appointment_id,
            customer_name,
            phone,
            city,
            assigned_commercial_user_id,
            assigned_by_user_id,
            assigned_at,
            status,
            sale_result,
            purchased_service,
            sale_value,
            sales_assessment,
            proposal_text,
            payment_method,
            cash_amount,
            portfolio_amount,
            volume_amount,
            closing_notes,
            next_step_type,
            next_appointment_date,
            next_appointment_time,
            next_notes,
            closed_at,
            created_at
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_roles")
          .select(`
            user_id,
            profiles!user_roles_user_id_fkey (
              id,
              full_name
            ),
            roles!user_roles_role_id_fkey (
              name,
              code
            )
          `),
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (daySettingsResult.error) throw daySettingsResult.error;
      if (slotSettingsResult.error) throw slotSettingsResult.error;
      if (commercialCasesResult.error) throw commercialCasesResult.error;
      if (sourceUsersResult.error) throw sourceUsersResult.error;

      const appointmentsData = (appointmentsResult.data as AppointmentRow[]) || [];
      const leadsData = (leadsResult.data as LeadOption[]) || [];
      const dayRows = (daySettingsResult.data as AgendaDaySetting[]) || [];
      const slotRows = (slotSettingsResult.data as AgendaSlotSetting[]) || [];
      const commercialCasesData = (commercialCasesResult.data as CommercialCaseRow[]) || [];
      const sourceUserRows = (sourceUsersResult.data as any[]) || [];
      const sourceUserMap = new Map<string, SourceUserOption>();
      const specialistMap = new Map<string, SpecialistOption>();
      sourceUserRows.forEach((row) => {
        const roleCode = row.roles?.code || "";
        const id = row.profiles?.id || row.user_id;
        if (!id) return;
        const normalizedRow = {
          id,
          full_name: row.profiles?.full_name || "Sin nombre",
          role_name: row.roles?.name || "",
          role_code: roleCode,
        };

        if (
          ["promotor_opc", "supervisor_opc", "tmk", "confirmador", "supervisor_call_center"].includes(roleCode) &&
          !sourceUserMap.has(id)
        ) {
          sourceUserMap.set(id, normalizedRow);
        }

        if (
          ["nutricionista", "medico_general", "medico", "fisioterapeuta"].includes(roleCode) &&
          !specialistMap.has(id)
        ) {
          specialistMap.set(id, normalizedRow);
        }
      });

      const hoy = hoyISO();
      const staleAppointments = appointmentsData.filter((item) => {
        const hasCommercialRecord = commercialCasesData.some(
          (caseItem) => caseItem.appointment_id === item.id
        );

        return (
          item.appointment_date < hoy &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
          !hasCommercialRecord
        );
      });

      if (staleAppointments.length > 0) {
        const staleIds = staleAppointments.map((item) => item.id);
        const { error: staleError } = await supabase
          .from("appointments")
          .update({
            status: "no_asistio",
            updated_by_user_id: currentUserId,
          })
          .in("id", staleIds);

        if (staleError) throw staleError;

        for (const staleItem of staleAppointments) {
          if (staleItem.lead_id) {
            await actualizarEstadoLeadPorCita(staleItem.lead_id, "no_asistio");
          }
        }

        staleAppointments.forEach((item) => {
          item.status = "no_asistio";
        });
      }

      const nextStatuses: Record<string, string> = {};
      appointmentsData.forEach((item) => {
        nextStatuses[item.id] = item.status;
      });

      const dayMap: Record<string, AgendaDaySetting> = {};
      dayRows.forEach((row) => {
        dayMap[row.agenda_date] = row;
      });

      const slotMap: Record<string, AgendaSlotSetting> = {};
      slotRows.forEach((row) => {
        slotMap[`${row.agenda_date}_${normalizarHora(row.slot_time)}`] = {
          ...row,
          slot_time: normalizarHora(row.slot_time),
        };
      });

      setAppointments(appointmentsData);
      setLeads(leadsData);
      setStatusById(nextStatuses);
      setDaySettings(dayMap);
      setSlotSettings(slotMap);
      setCommercialCases(commercialCasesData);
      setSourceUsers(
        Array.from(sourceUserMap.values()).sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "es")
        )
      );
      setSpecialists(
        Array.from(specialistMap.values()).sort((a, b) =>
          a.full_name.localeCompare(b.full_name, "es")
        )
      );
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de recepciÃƒÆ’Ã‚Â³n.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      cargarTodo();
    }
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void cargarTodo();
      }, 500);
    };

    const channel = supabase
      .channel("recepcion-live-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commercial_cases" },
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [authorized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("recepcion_delivery_logs");
      if (!raw) return;
      const parsed = JSON.parse(raw) as DeliveryLog[];
      if (Array.isArray(parsed)) {
        setDeliveryLogs(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawItems = window.localStorage.getItem("recepcion_inventory_items");
      const rawMovements = window.localStorage.getItem("recepcion_inventory_movements");

      if (rawItems) {
        const parsedItems = JSON.parse(rawItems) as InventoryItem[];
        if (Array.isArray(parsedItems)) {
          setInventoryItems(parsedItems);
        }
      }

      if (rawMovements) {
        const parsedMovements = JSON.parse(rawMovements) as InventoryMovement[];
        if (Array.isArray(parsedMovements)) {
          setInventoryMovements(parsedMovements);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!leadIdFromUrl || leads.length === 0) return;

    const selectedLead = leads.find((item) => item.id === leadIdFromUrl);
    if (!selectedLead) return;

    setForm((prev) => ({
      ...prev,
      mode: "lead",
      lead_id: selectedLead.id,
      patient_name: fullLeadName(selectedLead),
      phone: selectedLead.phone || "",
      city: selectedLead.city || "",
    }));
  }, [leadIdFromUrl, leads]);

  useEffect(() => {
    if (!form.lead_id) return;

    const selectedLead = leads.find((item) => item.id === form.lead_id);
    if (!selectedLead) return;

    setForm((prev) => ({
      ...prev,
      patient_name: fullLeadName(selectedLead),
      phone: selectedLead.phone || "",
      city: selectedLead.city || "",
    }));
  }, [form.lead_id, leads]);

  function cambiarSeccion(section: ReceptionSection) {
    if (isCommercialReceptionOnly && section !== "comercial") return;
    if (isLimitedReceptionForCall && section !== "agenda") return;
    setActiveSection(section);
    setEditingAppointmentId(null);
    setSelectedQuickAppointmentId(null);
    setExtraAppointments([]);
    setLastSavedAppointmentPrint(null);
    setMensaje("");
    setError("");
    setForm((prev) => ({
      ...prev,
      service_type: "",
    }));
  }

  function appointmentMatchesActiveSection(item: AppointmentRow) {
    return getSectionForService(item.service_type) === activeSection;
  }

  useEffect(() => {
    const daySetting = daySettings[form.appointment_date];
    setDailyCapacityInput(
      String(daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY)
    );
    setDailyClosedInput(daySetting?.is_closed ?? false);

    const nextCaps: Record<string, string> = {};
    const nextBlocked: Record<string, boolean> = {};

    SLOT_OPTIONS.forEach((slot) => {
      const key = `${form.appointment_date}_${slot.value}`;
      const row = slotSettings[key];
      nextCaps[slot.value] = String(row?.capacity ?? DEFAULT_SLOT_CAPACITY);
      nextBlocked[slot.value] = row?.is_blocked ?? false;
    });

    setSlotCapacityInputs(nextCaps);
    setSlotBlockedInputs(nextBlocked);
  }, [form.appointment_date, daySettings, slotSettings]);

  const appointmentsForSelectedDate = useMemo(() => {
    return appointments.filter(
      (item) => item.appointment_date === form.appointment_date && appointmentMatchesActiveSection(item)
    );
  }, [appointments, form.appointment_date, activeSection]);

  const activeAppointmentsForSelectedDate = useMemo(() => {
    return appointmentsForSelectedDate.filter((item) =>
      ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
    );
  }, [appointmentsForSelectedDate]);

  const leadsConCitaActiva = useMemo(() => {
    const ids = new Set<string>();
    appointments.forEach((item) => {
      if (
        item.lead_id &&
        ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
        item.id !== editingAppointmentId
      ) {
        ids.add(item.lead_id);
      }
    });
    return ids;
  }, [appointments, editingAppointmentId]);

  const leadsFiltrados = useMemo(() => {
    const q = busquedaLead.trim().toLowerCase();

    const base = leads.filter((lead) => {
      if (editingAppointmentId && lead.id === form.lead_id) return true;
      return !leadsConCitaActiva.has(lead.id);
    });

    if (!q) return base.slice(0, 20);

    return base
      .filter((lead) => {
        const nombre = fullLeadName(lead).toLowerCase();
        const telefono = (lead.phone || "").toLowerCase();
        return nombre.includes(q) || telefono.includes(q);
      })
      .slice(0, 20);
  }, [leads, busquedaLead, leadsConCitaActiva, editingAppointmentId, form.lead_id]);

  const agendaBaseFiltrada = useMemo(() => {
    const q = busquedaAgenda.trim().toLowerCase();

    return appointments
      .filter((item) => {
        const nombre = (item.patient_name || "").toLowerCase();
        const telefono = (item.phone || "").toLowerCase();
        const busquedaOk = q ? nombre.includes(q) || telefono.includes(q) : true;
        return busquedaOk && appointmentMatchesActiveSection(item);
      })
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) {
          return a.appointment_date.localeCompare(b.appointment_date);
        }
        return normalizarHora(a.appointment_time).localeCompare(normalizarHora(b.appointment_time));
      });
  }, [appointments, busquedaAgenda, activeSection]);

  const agendaFiltrada = useMemo(() => {
    return agendaBaseFiltrada.filter((item) =>
      fechaFiltro ? item.appointment_date === fechaFiltro : true
    );
  }, [agendaBaseFiltrada, fechaFiltro]);

  const resumen = useMemo(() => {
    const delDia = appointments.filter((item) => (fechaFiltro ? item.appointment_date === fechaFiltro : true) && appointmentMatchesActiveSection(item));

    return {
      total: delDia.length,
      agendadas: delDia.filter((x) => x.status === "agendada").length,
      espera: delDia.filter((x) => x.status === "en_espera").length,
      asistio: delDia.filter((x) => x.status === "asistio").length,
      noAsistio: delDia.filter((x) => x.status === "no_asistio").length,
    };
  }, [appointments, fechaFiltro, activeSection]);

  const weeklyAnchorDate = fechaFiltro || hoyISO();
  const weeklyAgendaDates = useMemo(() => {
    const start = startOfWeekISO(weeklyAnchorDate);
    return Array.from({ length: 7 }, (_, index) => addDaysToISO(start, index));
  }, [weeklyAnchorDate]);

  const weeklyAgendaByDate = useMemo(() => {
    const grouped = new Map<string, AppointmentRow[]>();

    weeklyAgendaDates.forEach((date) => grouped.set(date, []));

    agendaBaseFiltrada
      .filter((item) => weeklyAgendaDates.includes(item.appointment_date))
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) {
          return a.appointment_date.localeCompare(b.appointment_date);
        }
        return normalizarHora(a.appointment_time).localeCompare(normalizarHora(b.appointment_time));
      })
      .forEach((item) => {
        const bucket = grouped.get(item.appointment_date) || [];
        bucket.push(item);
        grouped.set(item.appointment_date, bucket);
      });

    return grouped;
  }, [agendaBaseFiltrada, weeklyAgendaDates]);

  const monthlyAgendaDates = useMemo(() => {
    return buildMonthCalendarDates(fechaFiltro || hoyISO());
  }, [fechaFiltro]);

  const monthlyAgendaByDate = useMemo(() => {
    const grouped = new Map<string, AppointmentRow[]>();
    monthlyAgendaDates.forEach((date) => grouped.set(date, []));

    agendaBaseFiltrada
      .filter((item) => monthlyAgendaDates.includes(item.appointment_date))
      .forEach((item) => {
        const bucket = grouped.get(item.appointment_date) || [];
        bucket.push(item);
        grouped.set(item.appointment_date, bucket);
      });

    return grouped;
  }, [agendaBaseFiltrada, monthlyAgendaDates]);

  const agendaPeriodLabel = useMemo(() => {
    if (agendaViewMode === "semana") {
      return `${formatWeekdayShort(weeklyAgendaDates[0])} al ${formatWeekdayShort(
        weeklyAgendaDates[weeklyAgendaDates.length - 1]
      )}`;
    }

    if (agendaViewMode === "mes") {
      const [year, month, day] = fechaFiltro.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric",
      });
    }

    return formatWeekdayShort(fechaFiltro);
  }, [agendaViewMode, fechaFiltro, weeklyAgendaDates]);

  function moveAgendaPeriod(step: number) {
    if (agendaViewMode === "mes") {
      setFechaFiltro(addMonthsKeepingDay(fechaFiltro, step));
      return;
    }

    setFechaFiltro(addDaysToISO(fechaFiltro, agendaViewMode === "semana" ? step * 7 : step));
  }

  const selectedDaySetting = daySettings[form.appointment_date];
  const selectedDateDailyCapacity =
    selectedDaySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;
  const selectedDateClosed = selectedDaySetting?.is_closed ?? false;
  const selectedDateActiveTotal = activeAppointmentsForSelectedDate.length;

  const slotAvailability = useMemo(() => {
    const durationMinutes = Number(form.duration_minutes || "30");

    return buildSlotAvailability({
      appointments,
      section: activeSection,
      serviceType: form.service_type,
      appointmentDate: form.appointment_date,
      durationMinutes,
      slotSettings,
      selectedDateClosed,
      selectedDateDailyCapacity,
      selectedDateActiveTotal,
      editingAppointmentId,
      getSectionForService,
    });
  }, [
    appointments,
    activeSection,
    form.service_type,
    form.appointment_date,
    form.duration_minutes,
    slotSettings,
    selectedDateClosed,
    selectedDateDailyCapacity,
    selectedDateActiveTotal,
    editingAppointmentId,
  ]);

  const canAddExtraAppointments =
    !editingAppointmentId &&
    !isReadOnlyAgendaForCall &&
    (activeSection === "especialistas" || activeSection === "tratamientos");

  function buildDraftAppointmentsForAvailability(
    drafts: ReceptionFollowUpDraft[],
    skipIndex: number
  ) {
    return drafts.flatMap((item, index) => {
      if (index === skipIndex) return [];
      if (!item.service_type || !item.appointment_date || !item.appointment_time) return [];

      return [
        {
          id: `draft-${index}`,
          lead_id: form.mode === "lead" ? form.lead_id || null : null,
          patient_name: form.patient_name.trim(),
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          appointment_date: item.appointment_date,
          appointment_time: item.appointment_time,
          status: "agendada",
          service_type: item.service_type,
          specialist_user_id: item.specialist_user_id || null,
          notes: construirNotasAgenda({
            notes: item.notes,
            manualSource: form.mode === "manual" ? form.manual_source : "",
            durationMinutes: Number(item.duration_minutes || "30"),
          }),
          checked_in_at: null,
          attended_at: null,
        } satisfies AppointmentRow,
      ];
    });
  }

  function getExtraAppointmentAvailability(
    draft: ReceptionFollowUpDraft,
    draftIndex: number,
    drafts: ReceptionFollowUpDraft[]
  ) {
    if (!draft.service_type || !draft.appointment_date) return [];

    const daySetting = daySettings[draft.appointment_date];
    const selectedDateDailyCapacity = daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;
    const selectedDateClosed = daySetting?.is_closed ?? false;
    const activeTotalForDate =
      appointments.filter(
        (item) =>
          item.appointment_date === draft.appointment_date &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
      ).length +
      buildDraftAppointmentsForAvailability(drafts, draftIndex).filter(
        (item) =>
          item.appointment_date === draft.appointment_date &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
      ).length;

    return buildSlotAvailability({
      appointments: [
        ...appointments,
        ...buildDraftAppointmentsForAvailability(drafts, draftIndex),
      ],
      section: activeSection,
      serviceType: draft.service_type,
      appointmentDate: draft.appointment_date,
      durationMinutes: Number(draft.duration_minutes || "30"),
      slotSettings,
      selectedDateClosed,
      selectedDateDailyCapacity,
      selectedDateActiveTotal: activeTotalForDate,
      editingAppointmentId: null,
      getSectionForService,
    });
  }

  useEffect(() => {
    if (extraAppointments.length === 0) return;

    let changed = false;
    const normalized = extraAppointments.map((item, index) => {
      if (!item.service_type) return item;

      const durationOptionsForDraft = getDurationOptions(
        activeSection,
        item.service_type,
        item.appointment_date
      );

      const nextDuration = durationOptionsForDraft.some(
        (option) => option.value === item.duration_minutes
      )
        ? item.duration_minutes
        : durationOptionsForDraft[0]?.value || "30";

      const nextDraft =
        nextDuration === item.duration_minutes ? item : { ...item, duration_minutes: nextDuration };

      const availability = getExtraAppointmentAvailability(nextDraft, index, extraAppointments);
      const availableSlots = availability.filter((slot) => !slot.disabled);
      const stillValid = availableSlots.some((slot) => slot.value === nextDraft.appointment_time);

      if (nextDuration !== item.duration_minutes || !stillValid) {
        changed = true;
        return {
          ...nextDraft,
          appointment_time: availableSlots[0]?.value || "",
        };
      }

      return nextDraft;
    });

    if (changed) {
      setExtraAppointments(normalized);
    }
  }, [activeSection, appointments, daySettings, extraAppointments, form.manual_source, form.mode, slotSettings]);

  function actualizarCitaAdicional(
    index: number,
    field: keyof ReceptionFollowUpDraft,
    value: string
  ) {
    setExtraAppointments((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function agregarCitaAdicional() {
    setExtraAppointments((prev) => [
      ...prev,
      createEmptyReceptionFollowUp(form.appointment_date, form.appointment_time),
    ]);
  }

  function eliminarCitaAdicional(index: number) {
    setExtraAppointments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }


  const printCandidates = useMemo(() => {
    const merged = [
      ...appointments.map((item) => ({
        id: `appointment_${item.id}`,
        patient_name: item.patient_name || "Sin nombre",
        phone: item.phone || "",
        city: item.city || "",
        source: item.lead_id ? "Lead existente" : traducirFuenteManual(extraerFuenteManualDesdeNotas(item.notes)),
        detail:
          item.appointment_date && item.appointment_time
            ? `${item.appointment_date} Ãƒâ€šÃ‚Â· ${formatHora(item.appointment_time)}`
            : "Sin cita",
        service_type: item.service_type || "",
        notes: limpiarMetadatosAgenda(item.notes),
      })),
      ...leads.map((lead) => ({
        id: `lead_${lead.id}`,
        patient_name: fullLeadName(lead),
        phone: lead.phone || "",
        city: lead.city || "",
        source: "Lead existente",
        detail: lead.status ? `Lead Ãƒâ€šÃ‚Â· ${lead.status}` : "Lead",
        service_type: "",
        notes: "",
      })),
    ];

    const unique = new Map<string, (typeof merged)[number]>();
    merged.forEach((item) => {
      const key = `${item.patient_name.toLowerCase()}_${item.phone}`;
      if (!unique.has(key)) unique.set(key, item);
    });

    const values = Array.from(unique.values());
    const q = printSearch.trim().toLowerCase();
    if (!q) return values.slice(0, 12);

    return values
      .filter((item) => {
        return (
          item.patient_name.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [appointments, leads, printSearch]);

  const selectedPrintPatient = useMemo(() => {
    return printCandidates[0] || null;
  }, [printCandidates]);

  const commercialCasesToday = useMemo(() => {
    const today = hoyISO();
    return commercialCases.filter((item) => item.created_at?.slice(0, 10) === today);
  }, [commercialCases]);

  const commercialCasesFiltered = useMemo(() => {
    const q = commercialSearch.trim().toLowerCase();
    const base = [...commercialCasesToday].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (!q) return base;

    return base.filter((item) =>
      (item.customer_name || "").toLowerCase().includes(q) ||
      (item.phone || "").toLowerCase().includes(q)
    );
  }, [commercialCasesToday, commercialSearch]);

  const commercialSummary = useMemo(() => {
    return {
      total: commercialCasesToday.length,
      pendientes: commercialCasesToday.filter((item) => item.status === "pendiente_asignacion_comercial").length,
      asignados: commercialCasesToday.filter((item) => item.status === "asignado_comercial").length,
      atencion: commercialCasesToday.filter((item) => item.status === "en_atencion_comercial").length,
      finalizados: commercialCasesToday.filter((item) => item.status === "finalizado").length,
    };
  }, [commercialCasesToday]);

  const nutritionPendingAppointments = useMemo(() => {
    const q = nutritionDeliverySearch.trim().toLowerCase();
    return appointments
      .filter((item) => isNutritionService(item.service_type) && item.status === "finalizada" && hasPendingNutritionDelivery(item.notes))
      .filter((item) => {
        if (!q) return true;
        const text = `${item.patient_name || ""} ${item.phone || ""} ${item.city || ""}`.toLowerCase();
        return text.includes(q);
      })
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) return b.appointment_date.localeCompare(a.appointment_date);
        return b.appointment_time.localeCompare(a.appointment_time);
      });
  }, [appointments, nutritionDeliverySearch]);

  const nutritionPendingSummary = useMemo(() => ({
    total: nutritionPendingAppointments.length,
  }), [nutritionPendingAppointments]);

  const physiotherapyPendingAppointments = useMemo(() => {
    return appointments
      .filter(
        (item) =>
          isPhysiotherapyService(item.service_type) &&
          item.status === "finalizada" &&
          hasPendingPhysiotherapyDelivery(item.notes)
      )
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) {
          return b.appointment_date.localeCompare(a.appointment_date);
        }
        return b.appointment_time.localeCompare(a.appointment_time);
      });
  }, [appointments]);

  const commercialPendingPrintCases = useMemo(() => {
    const today = hoyISO();
    return commercialCases
      .filter(
        (item) =>
          item.status === "finalizado" &&
          hasCommercialSale(item) &&
          ((item.closed_at || item.created_at || "").slice(0, 10) === today)
      )
      .sort((a, b) => {
        const dateA = new Date(a.closed_at || a.created_at || 0).getTime();
        const dateB = new Date(b.closed_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [commercialCases]);

  const receptionLiveSummary = useMemo(
    () => ({
      commercial: commercialPendingPrintCases.length,
      nutrition: nutritionPendingAppointments.length,
      physiotherapy: physiotherapyPendingAppointments.length,
      total:
        commercialPendingPrintCases.length +
        nutritionPendingAppointments.length +
        physiotherapyPendingAppointments.length,
    }),
    [
      commercialPendingPrintCases,
      nutritionPendingAppointments,
      physiotherapyPendingAppointments,
    ]
  );

  const selectedNutritionInventoryItem = useMemo(() => {
    if (nutritionDeliveryProductId) {
      return inventoryItems.find((item) => item.id === nutritionDeliveryProductId) || null;
    }

    const recommendedName = nutritionSelection?.recommendation?.productName;
    if (!recommendedName) return null;

    return (
      inventoryItems.find(
        (item) => normalizeText(item.name) === normalizeText(recommendedName)
      ) || null
    );
  }, [inventoryItems, nutritionDeliveryProductId, nutritionSelection]);

  function imprimirDocumento(tipo: "cita" | "instrucciones") {
    if (typeof window === "undefined") return;

    const nombre = selectedPrintPatient?.patient_name || "Paciente";
    const telefono = selectedPrintPatient?.phone || "Sin telÃƒÂ©fono";
    const ciudad = selectedPrintPatient?.city || "Sin ciudad";
    const detalle = selectedPrintPatient?.detail || "Sin detalle";
    const servicio = selectedPrintPatient?.service_type || "Sin servicio";
    const notas = selectedPrintPatient?.notes || "Sin notas registradas";
    const titulo = tipo === "cita" ? "Comprobante de cita" : "Instrucciones";

    const nuevaVentana = window.open("", "_blank", "width=900,height=700");
    if (!nuevaVentana) return;

    nuevaVentana.document.write(`
      <html>
        <head>
          <title>${titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; margin-top: 20px; }
            .muted { color: #475569; margin: 6px 0; }
          </style>
        </head>
        <body>
          <h1>${titulo}</h1>
          <p class="muted">CRM Prevital Ãƒâ€šÃ‚Â· RecepciÃƒÆ’Ã‚Â³n</p>
          <div class="box">
            <p><strong>Cliente:</strong> ${nombre}</p>
            <p><strong>TelÃƒÆ’Ã‚Â©fono:</strong> ${telefono}</p>
            <p><strong>Ciudad:</strong> ${ciudad}</p>
            <p><strong>Detalle:</strong> ${detalle}</p>
            <p><strong>Servicio:</strong> ${servicio}</p>
            <p><strong>Notas:</strong> ${notas}</p>
          </div>
        </body>
      </html>
    `);
    nuevaVentana.document.close();
    nuevaVentana.focus();
    nuevaVentana.print();
  }

  async function buscarUsuarioClinicoPorCita(item: AppointmentRow) {
    let foundUser: UserRow | null = null;

    if (item.phone) {
      const { data: usersByPhone, error: phoneError } = await supabase
        .from("users")
        .select("id, nombre, documento, telefono, ciudad")
        .eq("telefono", item.phone)
        .limit(1);

      if (phoneError) throw phoneError;
      if (usersByPhone && usersByPhone.length > 0) {
        foundUser = usersByPhone[0] as UserRow;
      }
    }

    if (!foundUser && item.patient_name) {
      const { data: usersByName, error: nameError } = await supabase
        .from("users")
        .select("id, nombre, documento, telefono, ciudad")
        .eq("nombre", item.patient_name)
        .limit(1);

      if (nameError) throw nameError;
      if (usersByName && usersByName.length > 0) {
        foundUser = usersByName[0] as UserRow;
      }
    }

    return foundUser;
  }

  async function imprimirPlanComercialDesdeRecepcion(item: CommercialCaseRow) {
    try {
      setQueueActionId(`commercial-${item.id}`);
      setError("");
      setMensaje("");

      const portfolio = parsePortfolioDetails(item.closing_notes);
      const installmentsCount = Number(portfolio.installments_count || "0");
      const installmentValue = numberFromMoneyText(portfolio.installment_value);
      const installmentPlan = buildInstallmentPlan(
        portfolio.first_installment_date,
        installmentsCount,
        installmentValue
      );

      printPlanInstructions({
        customerName: item.customer_name,
        phone: item.phone,
        city: item.city,
        commercialDate: item.closed_at || item.created_at,
        serviceName: serviceLabelComercial(item.purchased_service),
        paymentMethod: paymentMethodLabelComercial(item.payment_method),
        volumeAmount: Number(item.volume_amount || item.sale_value || 0),
        cashAmount: Number(item.cash_amount || 0),
        portfolioAmount: Number(item.portfolio_amount || 0),
        nextStep: nextStepLabelComercial(item.next_step_type),
        receptionSummary: getCommercialReceptionSummary(item),
        assessment: item.sales_assessment,
        proposal: item.proposal_text,
        closingNotes: stripPortfolioDetails(item.closing_notes),
        nextAppointmentDate: item.next_appointment_date,
        nextAppointmentTime: item.next_appointment_time
          ? formatHora(item.next_appointment_time)
          : null,
        nextNotes: item.next_notes,
        installmentPlan,
      });

      setMensaje("Documento comercial listo para impresion.");
    } catch (err: any) {
      setError(err?.message || "No se pudo preparar la impresion comercial.");
    } finally {
      setQueueActionId(null);
    }
  }

  async function imprimirResumenNutricionDesdeRecepcion(item: AppointmentRow) {
    try {
      setQueueActionId(`nutrition-print-${item.id}`);
      setError("");
      setMensaje("");

      const foundUser = await buscarUsuarioClinicoPorCita(item);
      let profile: NutritionProfileRow | null = null;

      if (foundUser?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("nutrition_profiles")
          .select("*")
          .eq("user_id", foundUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        profile = (profileData as NutritionProfileRow | null) || null;
      }

      printNutritionSummary({
        customerName: item.patient_name,
        document: foundUser?.documento,
        phone: item.phone || foundUser?.telefono,
        city: item.city || foundUser?.ciudad,
        appointmentDate: item.appointment_date,
        appointmentTime: formatHora(item.appointment_time),
        serviceName: item.service_type,
        antecedentesPatologicos: profile?.antecedentes_patologicos,
        cirugias: profile?.cirugias,
        toxicos: profile?.toxicos,
        alergicos: profile?.alergicos,
        medicamentos: profile?.medicamentos,
        familiares: profile?.familiares,
        peso: profile?.peso,
        talla: profile?.talla,
        indiceMasaCorporal: profile?.indice_masa_corporal,
        porcentajeMasaCorporal: profile?.porcentaje_masa_corporal,
        dinamometria: profile?.dinamometria,
        masaMuscular: profile?.masa_muscular,
        metabolismoReposo: profile?.metabolismo_reposo,
        grasaVisceral: profile?.grasa_visceral,
        circunferenciaCintura: profile?.circunferencia_cintura,
        clasificacionNutricional: profile?.clasificacion_nutricional,
        objetivoNutricional: profile?.objetivo_nutricional,
        recomendacionesNutricionales: profile?.recomendaciones_nutricionales,
        datosAlimentarios: profile?.datos_alimentarios,
        planNutricional: profile?.plan_nutricional,
        observacionesGenerales: profile?.observaciones_generales,
      });

      setMensaje("Historia e indicaciones de nutricion listas para impresion.");
    } catch (err: any) {
      setError(err?.message || "No se pudo preparar la impresion de nutricion.");
    } finally {
      setQueueActionId(null);
    }
  }

  async function imprimirResumenFisioterapiaDesdeRecepcion(item: AppointmentRow) {
    try {
      setQueueActionId(`physio-print-${item.id}`);
      setError("");
      setMensaje("");

      const foundUser = await buscarUsuarioClinicoPorCita(item);
      let profile: PhysiotherapyProfileRow | null = null;

      if (foundUser?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("physiotherapy_profiles")
          .select("*")
          .eq("user_id", foundUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        profile = (profileData as PhysiotherapyProfileRow | null) || null;
      }

      printPhysiotherapySummary({
        customerName: item.patient_name,
        document: foundUser?.documento,
        phone: item.phone || foundUser?.telefono,
        city: item.city || foundUser?.ciudad,
        appointmentDate: item.appointment_date,
        appointmentTime: formatHora(item.appointment_time),
        serviceName: item.service_type,
        antecedentesPatologicos: profile?.antecedentes_patologicos,
        cirugias: profile?.cirugias,
        toxicos: profile?.toxicos,
        alergicos: profile?.alergicos,
        medicamentos: profile?.medicamentos,
        familiares: profile?.familiares,
        analisisComercial: profile?.analisis_comercial,
        presionArterial: profile?.presion_arterial,
        frecuenciaCardiaca: profile?.frecuencia_cardiaca,
        inspeccionGeneral: profile?.inspeccion_general,
        dolor: profile?.dolor,
        inflamacion: profile?.inflamacion,
        limitacionMovilidad: profile?.limitacion_movilidad,
        pruebaSemiologica: profile?.prueba_semiologica,
        flexibilidad: profile?.flexibilidad,
        fuerzaMuscular: profile?.fuerza_muscular,
        rangosMovimientoArticular: profile?.rangos_movimiento_articular,
        planIntervencion: profile?.plan_intervencion,
        observacionesGenerales: profile?.observaciones_generales,
      });

      setMensaje("Historia e indicaciones de fisioterapia listas para impresion.");
    } catch (err: any) {
      setError(err?.message || "No se pudo preparar la impresion de fisioterapia.");
    } finally {
      setQueueActionId(null);
    }
  }

  async function abrirPendienteNutricion(item: AppointmentRow) {
    try {
      setQueueActionId(`nutrition-open-${item.id}`);
      cambiarSeccion("nutricion_entregas");
      await abrirEntregaNutricion(item);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setQueueActionId(null);
    }
  }

  async function resolverPendienteFisioterapia(item: AppointmentRow) {
    if (!currentUserId) return;

    try {
      setQueueActionId(`physio-resolve-${item.id}`);
      setError("");
      setMensaje("");

      const nextNotes = marcarEntregaFisioterapiaResuelta(item.notes);
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          notes: nextNotes,
          updated_by_user_id: currentUserId,
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      setAppointments((prev) =>
        prev.map((appointmentItem) =>
          appointmentItem.id === item.id
            ? {
                ...appointmentItem,
                notes: nextNotes,
              }
            : appointmentItem
        )
      );
      setMensaje("Pendiente de fisioterapia marcado como resuelto.");
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el pendiente de fisioterapia.");
    } finally {
      setQueueActionId(null);
    }
  }

  function registrarEntregaLocal() {
    if (!selectedPrintPatient) {
      setError("Debes buscar un cliente para registrar la entrega.");
      return;
    }

    if (!deliveryProduct.trim()) {
      setError("Debes escribir el nutracÃƒÆ’Ã‚Â©utico o producto entregado.");
      return;
    }

    const quantity = Number(deliveryQuantity || "0");
    if (!quantity || quantity < 1) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }

    const nuevo: DeliveryLog = {
      id: `${Date.now()}`,
      patient_name: selectedPrintPatient.patient_name,
      phone: selectedPrintPatient.phone,
      product: deliveryProduct.trim(),
      quantity,
      notes: deliveryNotes.trim(),
      created_at: new Date().toISOString(),
    };

    const next = [nuevo, ...deliveryLogs].slice(0, 30);
    setDeliveryLogs(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("recepcion_delivery_logs", JSON.stringify(next));
    }

    setDeliveryProduct("");
    setDeliveryQuantity("1");
    setDeliveryNotes("");
    setMensaje("Entrega registrada correctamente en este dispositivo.");
    setError("");
  }

  const inventoryFilteredItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const base = [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name));

    if (!q) return base;

    return base.filter((item) =>
      item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [inventoryItems, inventorySearch]);

  const inventoryRecentMovements = useMemo(() => {
    return [...inventoryMovements]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [inventoryMovements]);

  function getInventoryStatus(item: InventoryItem) {
    if (item.stock <= 0) {
      return { label: "Agotado", className: "bg-red-100 text-red-700" };
    }

    if (item.stock <= item.min_stock) {
      return { label: "Bajo", className: "bg-amber-100 text-amber-700" };
    }

    return { label: "Normal", className: "bg-emerald-100 text-emerald-700" };
  }

  function registrarMovimientoInventario() {
    const quantity = Number(inventoryQuantity || "0");
    if (!quantity || quantity < 1) {
      setError("La cantidad del movimiento debe ser mayor que cero.");
      return;
    }

    if (!inventoryMovementDate) {
      setError("Debes seleccionar la fecha del movimiento.");
      return;
    }

    let selectedItem = inventoryItems.find((item) => item.id === inventoryProductId);

    if (!selectedItem && !inventoryNewProduct.trim()) {
      setError("Debes seleccionar un producto existente o escribir uno nuevo.");
      return;
    }

    const now = new Date().toISOString();
    const nextItems = [...inventoryItems];
    let productId = inventoryProductId;
    let productName = selectedItem?.name || inventoryNewProduct.trim();

    if (!selectedItem && inventoryNewProduct.trim()) {
      const nuevoItem: InventoryItem = {
        id: `${Date.now()}`,
        name: inventoryNewProduct.trim(),
        category: inventoryCategory.trim() || "General",
        stock: 0,
        min_stock: Number(inventoryMinStock || "5") || 5,
        updated_at: now,
      };
      nextItems.unshift(nuevoItem);
      selectedItem = nuevoItem;
      productId = nuevoItem.id;
      productName = nuevoItem.name;
    }

    if (!selectedItem) {
      setError("No se pudo identificar el producto.");
      return;
    }

    const updatedItems = nextItems.map((item) => {
      if (item.id !== selectedItem!.id) return item;

      let nextStock = item.stock;
      if (inventoryMovementType === "entrada") nextStock = item.stock + quantity;
      if (inventoryMovementType === "salida") nextStock = Math.max(item.stock - quantity, 0);
      if (inventoryMovementType === "ajuste") nextStock = quantity;

      return {
        ...item,
        stock: nextStock,
        min_stock:
          item.id === selectedItem!.id && inventoryNewProduct.trim()
            ? Number(inventoryMinStock || "5") || 5
            : item.min_stock,
        updated_at: now,
      };
    });

    const nuevoMovimiento: InventoryMovement = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      product_id: productId,
      product_name: productName,
      type: inventoryMovementType,
      quantity,
      movement_date: inventoryMovementDate,
      lot_number: inventoryLotNumber.trim() || undefined,
      notes: inventoryMovementNotes.trim(),
      created_at: now,
    };

    const nextMovements = [nuevoMovimiento, ...inventoryMovements].slice(0, 100);

    setInventoryItems(updatedItems);
    setInventoryMovements(nextMovements);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("recepcion_inventory_items", JSON.stringify(updatedItems));
      window.localStorage.setItem("recepcion_inventory_movements", JSON.stringify(nextMovements));
    }

    setInventoryProductId("");
    setInventoryNewProduct("");
    setInventoryQuantity("1");
    setInventoryMovementDate(hoyISO());
    setInventoryLotNumber("");
    setInventoryMovementNotes("");
    setInventoryCategory("nutraceutico");
    setInventoryMinStock("5");
    setMensaje("Movimiento de inventario registrado correctamente.");
    setError("");
  }


  async function abrirEntregaNutricion(item: AppointmentRow) {
    try {
      setSelectedNutritionDeliveryId(item.id);
      setLoadingNutritionSelection(true);
      setNutritionSelection(null);
      setLastNutritionPrintSelection(null);
      setNutritionDeliveryProductId("");
      setNutritionDeliveryQuantity("1");
      setNutritionDeliveryNotes("");
      setError("");
      setMensaje("");

      let foundUser: UserRow | null = null;

      if (item.phone) {
        const { data: usersByPhone, error: phoneError } = await supabase
          .from("users")
          .select("id, nombre, documento, telefono, ciudad")
          .eq("telefono", item.phone)
          .limit(1);

        if (phoneError) throw phoneError;
        if (usersByPhone && usersByPhone.length > 0) {
          foundUser = usersByPhone[0] as UserRow;
        }
      }

      if (!foundUser && item.patient_name) {
        const { data: usersByName, error: nameError } = await supabase
          .from("users")
          .select("id, nombre, documento, telefono, ciudad")
          .eq("nombre", item.patient_name)
          .limit(1);

        if (nameError) throw nameError;
        if (usersByName && usersByName.length > 0) {
          foundUser = usersByName[0] as UserRow;
        }
      }

      let profile: NutritionProfileRow | null = null;
      const recommendation = parseDeliveryRecommendation(item.notes, "nutricion");
      if (foundUser?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("nutrition_profiles")
          .select("*")
          .eq("user_id", foundUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        profile = (profileData as NutritionProfileRow | null) || null;
      }

      const matchedInventoryItem = recommendation?.productName
        ? inventoryItems.find(
            (inventoryItem) =>
              normalizeText(inventoryItem.name) === normalizeText(recommendation.productName)
          ) || null
        : null;

      setNutritionSelection({
        appointment: item,
        userId: foundUser?.id || null,
        document: foundUser?.documento || "",
        profile,
        recommendation,
      });

      setNutritionDeliveryProductId(matchedInventoryItem?.id || "");
      setNutritionDeliveryQuantity(String(recommendation?.quantity || 1));
      setNutritionDeliveryNotes(recommendation?.instructions || "");
    } catch (err: any) {
      setError(err?.message || "No se pudo abrir la entrega de nutriciÃƒÆ’Ã‚Â³n.");
    } finally {
      setLoadingNutritionSelection(false);
    }
  }

  async function registrarEntregaNutricion() {
    if (!nutritionSelection) {
      setError("Debes seleccionar primero un cliente pendiente de nutriciÃƒÆ’Ã‚Â³n.");
      return;
    }

    const lockedRecommendation = nutritionSelection.recommendation;

    if (!nutritionDeliveryProductId && !selectedNutritionInventoryItem) {
      setError(
        lockedRecommendation?.productName
          ? "El producto recomendado no existe todavÃƒÆ’Ã‚Â­a en inventario. Primero crÃƒÆ’Ã‚Â©alo en recepciÃƒÆ’Ã‚Â³n."
          : "Debes seleccionar el producto entregado."
      );
      return;
    }

    const quantity = Number(nutritionDeliveryQuantity || "0");
    if (!quantity || quantity < 1) {
      setError("La cantidad entregada debe ser mayor que cero.");
      return;
    }

    const selectedItem =
      inventoryItems.find((item) => item.id === nutritionDeliveryProductId) ||
      selectedNutritionInventoryItem;
    if (!selectedItem) {
      setError("Debes seleccionar un producto vÃƒÆ’Ã‚Â¡lido del inventario.");
      return;
    }

    if (selectedItem.stock < quantity) {
      setError("No hay suficiente stock para registrar esta entrega.");
      return;
    }

    try {
      setSavingNutritionDelivery(true);
      setError("");
      setMensaje("");

      const now = new Date().toISOString();

      const updatedItems = inventoryItems.map((item) =>
        item.id === selectedItem.id
          ? { ...item, stock: Math.max(item.stock - quantity, 0), updated_at: now }
          : item
      );

      const newMovement: InventoryMovement = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        product_id: selectedItem.id,
        product_name: selectedItem.name,
        type: "salida",
        movement_date: hoyISO(),
        quantity,
        notes: `Entrega nutriciÃƒÆ’Ã‚Â³n Ãƒâ€šÃ‚Â· ${nutritionSelection.appointment.patient_name}${nutritionDeliveryNotes.trim() ? ` Ãƒâ€šÃ‚Â· ${nutritionDeliveryNotes.trim()}` : ""}`,
        created_at: now,
      };

      const nextMovements = [newMovement, ...inventoryMovements].slice(0, 100);
      setInventoryItems(updatedItems);
      setInventoryMovements(nextMovements);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("recepcion_inventory_items", JSON.stringify(updatedItems));
        window.localStorage.setItem("recepcion_inventory_movements", JSON.stringify(nextMovements));
      }

      if (nutritionSelection.userId) {
        const { error: userError } = await supabase
          .from("users")
          .update({ estado_actual: "entrega_nutricion_completada" })
          .eq("id", nutritionSelection.userId);

        if (userError) throw userError;
      }

      const notesResueltas = marcarEntregaNutricionResuelta(nutritionSelection.appointment.notes);
      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ notes: notesResueltas })
        .eq("id", nutritionSelection.appointment.id);

      if (appointmentError) throw appointmentError;

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === nutritionSelection.appointment.id
            ? { ...item, notes: notesResueltas }
            : item
        )
      );

      setLastNutritionPrintSelection(nutritionSelection);
      setMensaje("Entrega de nutriciÃƒÆ’Ã‚Â³n registrada correctamente. Ya puedes imprimir el documento nutricional.");
      setNutritionDeliveryProductId("");
      setNutritionDeliveryQuantity("1");
      setNutritionDeliveryNotes("");
      setSelectedNutritionDeliveryId(nutritionSelection.appointment.id);
      setNutritionSelection(nutritionSelection);
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar la entrega de nutriciÃƒÆ’Ã‚Â³n.");
    } finally {
      setSavingNutritionDelivery(false);
    }
  }


  function resetCommercialForm(options?: { preserveLastPrintData?: boolean }) {
    setSelectedCommercialAppointmentId(null);
    if (!options?.preserveLastPrintData) {
      setLastCommercialPrintData(null);
    }
    setCommercialForm({
      customer_name: "",
      phone: "",
      city: "",
      documento: "",
      fuente: "",
      fuente_detalle: "",
      fuente_usuario_id: "",
      observaciones: "",
      acompanante_nombre: "",
      acompanante_parentesco: "",
      tiene_eps: "si",
      afiliacion: "",
      ocupacion: "",
      ocupacion_otro: "",
      edad: "",
      trae_cedula: "si",
      celular_inteligente: "si",
      hipertenso: "no",
      diabetico: "no",
      cirugias: "no",
      cirugias_cual: "",
      medicamentos: "no",
      medicamentos_cual: "",
      enfermedades: "no",
      enfermedades_cual: "",
      tiempo_detox_30_min: "",
      clinical_flags: emptyCommercialClinicalFlags(),
      clasificacion_inicial: "No Q",
      clasificacion_motivo: "",
      referido_por: "",
    });
  }


  
function traducirOcupacionComercial(ocupacion: string, ocupacionOtro: string) {
  const detalle = ocupacionOtro?.trim();
  const map: Record<string, string> = {
    empleado: detalle ? `Empleado - ${detalle}` : "Empleado",
    independiente: detalle ? `Independiente - ${detalle}` : "Independiente",
    pensionado: "Pensionado",
    otro: detalle || "Otro",
  };

  return map[ocupacion] || detalle || "Sin definir";
}

function buildCommercialPrintData() {
    const ocupacion = traducirOcupacionComercial(
      commercialForm.ocupacion,
      commercialForm.ocupacion_otro
    );

    return {
      customerName: commercialForm.customer_name || "Sin nombre",
      phone: commercialForm.phone || "Sin telÃƒÂ©fono",
      city: commercialForm.city || "Sin ciudad",
      document: commercialForm.documento || "Sin documento",
      source: traducirFuenteManual(commercialForm.fuente) || "Sin fuente",
      sourceDetailLabel: commercialSourceDetailMeta?.label || null,
      sourceDetail:
        (sourceNeedsUserSelection
          ? selectedSourceUser?.full_name
          : commercialForm.referido_por) || "No aplica",
      hasEps: commercialForm.tiene_eps === "si" ? "SÃƒÆ’Ã‚Â­" : "No",
      affiliation: commercialForm.afiliacion || "Sin definir",
      age: commercialForm.edad || "Sin dato",
      bringsId: commercialForm.trae_cedula === "si" ? "SÃƒÆ’Ã‚Â­" : "No",
      smartphone: commercialForm.celular_inteligente === "si" ? "SÃƒÆ’Ã‚Â­" : "No",
      hasDetoxTime:
        commercialForm.tiempo_detox_30_min === "si"
          ? "Si"
          : commercialForm.tiempo_detox_30_min === "no"
          ? "No"
          : "Sin definir",
      occupation: ocupacion || "Sin definir",
      hypertension: commercialForm.hipertenso === "si" ? "Si" : "No",
      diabetes: commercialForm.diabetico === "si" ? "Si" : "No",
      surgeries: commercialForm.cirugias === "si" ? "Si" : "No",
      surgeriesDetail:
        commercialForm.cirugias === "si"
          ? commercialForm.cirugias_cual || "No registra"
          : "No aplica",
      medications: commercialForm.medicamentos === "si" ? "Si" : "No",
      medicationsDetail:
        commercialForm.medicamentos === "si"
          ? commercialForm.medicamentos_cual || "No registra"
          : "No aplica",
      diseases: commercialForm.enfermedades === "si" ? "Si" : "No",
      diseasesDetail:
        commercialForm.enfermedades === "si"
          ? commercialForm.enfermedades_cual || "No registra"
          : "No aplica",
      companionName: commercialForm.acompanante_nombre || "No aplica",
      companionRelationship: commercialForm.acompanante_parentesco || "No aplica",
      observations: commercialForm.observaciones || "Sin observaciones registradas.",
    };
  }

function imprimirRegistroComercial() {
    if (!lastCommercialPrintData) {
      setError("Registra primero el ingreso comercial para habilitar la impresion.");
      return;
    }

    setError("");
    printReceptionRecord(lastCommercialPrintData);
  }

  function imprimirCitaRecepcion(item: AppointmentRow) {
    const source = item.lead_id
      ? "Lead existente"
      : traducirFuenteManual(extraerFuenteManualDesdeNotas(item.notes));

    printAppointment({
      patientName: item.patient_name || "Sin nombre",
      phone: item.phone || "Sin telÃƒÂ©fono",
      city: item.city || "Sin ciudad",
      source: source || "Sin fuente",
      appointmentDate: item.appointment_date,
      appointmentTime: formatHora(item.appointment_time),
      statusLabel: traducirEstado(item.status),
      serviceType: item.service_type || "ValoraciÃƒÆ’Ã‚Â³n",
      notes: limpiarMetadatosAgenda(item.notes) || "Sin notas registradas.",
    });
  }

  function buscarSiguienteCita(item: AppointmentRow) {
    const currentKey = `${item.appointment_date}T${normalizarHora(item.appointment_time)}`;

    return appointments
      .filter((candidate) => candidate.id !== item.id)
      .filter((candidate) => {
        const samePhone =
          !!item.phone &&
          !!candidate.phone &&
          item.phone.trim() === candidate.phone.trim();
        const sameName =
          !!item.patient_name &&
          !!candidate.patient_name &&
          item.patient_name.trim().toLowerCase() === candidate.patient_name.trim().toLowerCase();

        if (!samePhone && !sameName) return false;

        const candidateKey = `${candidate.appointment_date}T${normalizarHora(candidate.appointment_time)}`;
        return candidateKey > currentKey;
      })
      .sort((a, b) => {
        const keyA = `${a.appointment_date}T${normalizarHora(a.appointment_time)}`;
        const keyB = `${b.appointment_date}T${normalizarHora(b.appointment_time)}`;
        return keyA.localeCompare(keyB);
      })[0] || null;
  }

  function imprimirSiguienteCita(item: AppointmentRow) {
    const nextAppointment = buscarSiguienteCita(item);
    if (!nextAppointment) {
      setError("Este paciente no tiene una siguiente cita agendada todavÃƒÆ’Ã‚Â­a.");
      return;
    }

    imprimirCitaRecepcion(nextAppointment);
    setMensaje("Siguiente cita lista para impresiÃƒÆ’Ã‚Â³n.");
  }

  function buildAppointmentPrintData() {
    return {
      id: editingAppointmentId || "actual",
      lead_id: form.mode === "lead" ? form.lead_id || null : null,
      patient_name: form.patient_name,
      phone: form.phone || null,
      city: form.city || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      status: form.status,
      service_type:
        activeSection === "agenda"
          ? "valoracion"
          : form.service_type || null,
      specialist_user_id:
        activeSection === "especialistas" || activeSection === "tratamientos"
          ? form.specialist_user_id || null
          : null,
      notes: construirNotasAgenda({
        notes: form.notes,
        manualSource: form.mode === "manual" ? form.manual_source : "",
        durationMinutes: Number(form.duration_minutes || "30"),
      }),
      checked_in_at: null,
      attended_at: null,
    };
  }

  function imprimirCitaActualDesdeFormulario() {
    if (!lastSavedAppointmentPrint) {
      setError("Guarda primero la cita para habilitar la impresion.");
      return;
    }

    setError("");
    imprimirCitaRecepcion(lastSavedAppointmentPrint);
  }

  async function registrarIngresoComercial(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;

    setSavingCommercialIntake(true);
    setError("");
    setMensaje("");

    try {
      if (!commercialForm.customer_name.trim()) {
        throw new Error("Debes escribir el nombre del cliente.");
      }

      if (!commercialForm.phone.trim()) {
        throw new Error("Debes escribir el telÃƒÂ©fono del cliente.");
      }

      if (!commercialForm.fuente) {
        throw new Error("Debes seleccionar la fuente del lead.");
      }

      if (sourceNeedsUserSelection && !commercialForm.fuente_usuario_id) {
        throw new Error(`Debes seleccionar ${commercialSourceDetailMeta?.label.toLowerCase() || "el usuario de la fuente"}.`);
      }

      if (!sourceNeedsUserSelection && commercialSourceDetailMeta?.required && !commercialForm.referido_por.trim()) {
        throw new Error(`Debes completar ${commercialSourceDetailMeta.label.toLowerCase()}.`);
      }

      if (!commercialForm.tiempo_detox_30_min) {
        throw new Error("Debes confirmar si cuenta con el tiempo de 30 min para la terapia detox.");
      }

      if (occupationNeedsDetail && !commercialForm.ocupacion_otro.trim()) {
        throw new Error(`Debes completar ${getOccupationDetailLabel(commercialForm.ocupacion).toLowerCase()}.`);
      }

      const yaExiste = commercialCases.find(
        (item) =>
          (
            (selectedCommercialAppointmentId && item.appointment_id === selectedCommercialAppointmentId) ||
            (!selectedCommercialAppointmentId && (item.phone || "").trim() === commercialForm.phone.trim())
          ) &&
          ["pendiente_asignacion_comercial", "asignado_comercial", "en_atencion_comercial"].includes(item.status)
      );

      if (yaExiste) {
        throw new Error("Ese cliente ya tiene un ingreso comercial activo.");
      }

      const clasificacion = commercialForm.clasificacion_inicial || "No Q";
      const ocupacionLabel = traducirOcupacionComercial(commercialForm.ocupacion, commercialForm.ocupacion_otro);
      const fuenteLabel = traducirFuenteManual(commercialForm.fuente);
      const fuenteDetalleLabel = commercialSourceDetailMeta?.noteLabel || "Detalle fuente";
      const fuenteDetalleValor = sourceNeedsUserSelection
        ? selectedSourceUser?.full_name || ""
        : commercialForm.referido_por.trim();
      const commissionSourceType =
        normalizedCommercialSource === "opc"
          ? "opc"
          : normalizedCommercialSource === "redes"
          ? "redes"
          : "otro";

      try {
        const identifier = commercialForm.documento.trim() || commercialForm.phone.trim();
        const { data: existingUsers } = await supabase
          .from("users")
          .select("id")
          .or(`documento.eq.${commercialForm.documento.trim() || "___sin_documento___"},telefono.eq.${commercialForm.phone.trim()}`)
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          await supabase
            .from("users")
            .update({
              nombre: commercialForm.customer_name.trim(),
              documento: commercialForm.documento.trim() || null,
              telefono: commercialForm.phone.trim() || null,
              ciudad: commercialForm.city.trim() || null,
              ocupacion: ocupacionLabel || null,
              estado_actual: "pendiente valoracion",
              clasificacion_inicial: clasificacion,
              clasificacion_final: clasificacion,
              incentivo: fuenteLabel || null,
            })
            .eq("id", existingUsers[0].id);
        } else if (identifier) {
          await supabase.from("users").insert([
            {
              nombre: commercialForm.customer_name.trim(),
              documento: commercialForm.documento.trim() || null,
              telefono: commercialForm.phone.trim() || null,
              ciudad: commercialForm.city.trim() || null,
              ocupacion: ocupacionLabel || null,
              estado_actual: "pendiente valoracion",
              clasificacion_inicial: clasificacion,
              clasificacion_final: clasificacion,
              incentivo: fuenteLabel || null,
            },
          ]);
        }
      } catch (syncErr) {
        console.warn("No se pudo sincronizar ficha base del usuario", syncErr);
      }

      const condicionesInternas = [
        commercialForm.hipertenso === "si" && commercialForm.clinical_flags.hipertenso_descalifica
          ? "HipertensiÃƒÆ’Ã‚Â³n descalificante"
          : "",
        commercialForm.diabetico === "si" && commercialForm.clinical_flags.diabetico_descalifica
          ? "Diabetes descalificante"
          : "",
        commercialForm.cirugias === "si" && commercialForm.clinical_flags.cirugias_descalifica
          ? "CirugÃƒÆ’Ã‚Â­a descalificante"
          : "",
        commercialForm.medicamentos === "si" && commercialForm.clinical_flags.medicamentos_descalifica
          ? "Medicamento descalificante"
          : "",
        commercialForm.enfermedades === "si" && commercialForm.clinical_flags.enfermedades_descalifica
          ? "Enfermedad descalificante"
          : "",
      ]
        .filter(Boolean)
        .join(", ");

      const notesParts = [
        fuenteLabel ? `Fuente: ${fuenteLabel}` : "",
        `ClasificaciÃƒÆ’Ã‚Â³n inicial: ${clasificacion}`,
        commercialForm.clasificacion_motivo ? `Motivo clasificaciÃƒÆ’Ã‚Â³n: ${commercialForm.clasificacion_motivo}` : "",
        `Tiene EPS: ${commercialForm.tiene_eps === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        commercialForm.afiliacion ? `AfiliaciÃƒÆ’Ã‚Â³n: ${commercialForm.afiliacion}` : "",
        `Trae cÃƒÆ’Ã‚Â©dula: ${commercialForm.trae_cedula === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        `Celular inteligente: ${commercialForm.celular_inteligente === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        ocupacionLabel ? `OcupaciÃƒÆ’Ã‚Â³n: ${ocupacionLabel}` : "",
        commercialForm.edad ? `Edad: ${commercialForm.edad}` : "",
        `Hipertenso: ${commercialForm.hipertenso === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        `DiabÃƒÆ’Ã‚Â©tico: ${commercialForm.diabetico === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        `CirugÃƒÆ’Ã‚Â­as: ${commercialForm.cirugias === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        commercialForm.cirugias === "si" && commercialForm.cirugias_cual
          ? `CirugÃƒÆ’Ã‚Â­as cuÃƒÆ’Ã‚Â¡l: ${commercialForm.cirugias_cual}`
          : "",
        `Medicamentos: ${commercialForm.medicamentos === "si" ? "SÃƒÆ’Ã‚Â­" : "No"}`,
        commercialForm.medicamentos === "si" && commercialForm.medicamentos_cual
          ? `Medicamentos cuÃƒÆ’Ã‚Â¡l: ${commercialForm.medicamentos_cual}`
          : "",
        condicionesInternas ? `MarcaciÃƒÆ’Ã‚Â³n interna recepciÃƒÆ’Ã‚Â³n: ${condicionesInternas}` : "",
        commercialForm.acompanante_nombre ? `AcompaÃƒÆ’Ã‚Â±ante: ${commercialForm.acompanante_nombre}` : "",
        commercialForm.acompanante_parentesco ? `Parentesco acompaÃƒÆ’Ã‚Â±ante: ${commercialForm.acompanante_parentesco}` : "",
        `Enfermedades: ${commercialForm.enfermedades === "si" ? "Si" : "No"}`,
        commercialForm.enfermedades === "si" && commercialForm.enfermedades_cual
          ? `Enfermedades cuales: ${commercialForm.enfermedades_cual}`
          : "",
        `Tiempo disponible para terapia detox 30 min: ${commercialForm.tiempo_detox_30_min === "si" ? "Si" : "No"}`,
        fuenteDetalleValor ? `${fuenteDetalleLabel}: ${fuenteDetalleValor}` : "",
        commercialForm.observaciones ? `Observaciones recepciÃƒÆ’Ã‚Â³n: ${commercialForm.observaciones}` : "",
      ].filter(Boolean).join(" | ");

      const appointmentContext = selectedCommercialAppointmentId
        ? appointments.find((item) => item.id === selectedCommercialAppointmentId) || null
        : null;

      if (appointmentContext) {
        const payload: any = {
          status: "asistio",
          attended_at: new Date().toISOString(),
          updated_by_user_id: currentUserId,
        };

        const { error: appointmentError } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", appointmentContext.id);

        if (appointmentError) throw appointmentError;

        if (appointmentContext.lead_id) {
          await actualizarEstadoLeadPorCita(appointmentContext.lead_id, "asistio");
        }
      }

      const { error: insertError } = await supabase.from("commercial_cases").insert([
        {
          lead_id: appointmentContext?.lead_id || null,
          appointment_id: appointmentContext?.id || null,
          customer_name: commercialForm.customer_name.trim(),
          phone: commercialForm.phone.trim(),
          city: commercialForm.city.trim() || null,
          status: "pendiente_asignacion_comercial",
          lead_source_type: normalizeCommercialCaseLeadSource(
            normalizedCommercialSource
          ),
          commission_source_type: commissionSourceType,
          opc_user_id:
            normalizedCommercialSource === "opc"
              ? commercialForm.fuente_usuario_id || null
              : null,
          call_user_id:
            normalizedCommercialSource === "tmk"
              ? commercialForm.fuente_usuario_id || null
              : null,
          commercial_notes: buildStoredCommercialNotes(notesParts, null),
          created_by_user_id: currentUserId,
          updated_by_user_id: currentUserId,
          sale_result: null,
        },
      ]);

      if (insertError) throw insertError;

      setLastCommercialPrintData(buildCommercialPrintData());
      resetCommercialForm({ preserveLastPrintData: true });
      setActiveSection("comercial");
      setMensaje(
        appointmentContext
          ? "Cliente registrado en comercial y la cita quedÃƒÆ’Ã‚Â³ como asistiÃƒÆ’Ã‚Â³. La impresion del registro ya quedÃƒÆ’Ã‚Â³ habilitada."
          : "Ingreso comercial registrado correctamente. La impresion del registro ya quedÃƒÆ’Ã‚Â³ habilitada."
      );
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar el ingreso comercial.");
    } finally {
      setSavingCommercialIntake(false);
    }
  }

  function resetForm(options?: { preserveLastSavedAppointmentPrint?: boolean }) {
    setEditingAppointmentId(null);
    setSelectedQuickAppointmentId(null);
    setExtraAppointments([]);
    setManualClientLookup(lookupFromUrl.trim());
    if (!options?.preserveLastSavedAppointmentPrint) {
      setLastSavedAppointmentPrint(null);
    }
    setForm({
      mode: leadIdFromUrl ? "lead" : lookupFromUrl.trim() ? "manual" : "lead",
      lead_id: leadIdFromUrl || "",
      patient_name: "",
      phone: "",
      city: "",
      manual_source: "",
      appointment_date: hoyISO(),
      appointment_time: "08:00",
      duration_minutes: activeSection === "tratamientos" ? "30" : "30",
      status: "agendada",
      service_type: "",
      specialist_user_id: "",
      notes: "",
    });
    setBusquedaLead("");
  }

  function cargarCitaParaEditar(item: AppointmentRow) {
    if (isReadOnlyAgendaForCall) return;

    setEditingAppointmentId(item.id);
    setSelectedQuickAppointmentId(item.id);
    setLastSavedAppointmentPrint(null);
    setActiveSection(getSectionForService(item.service_type));
    setForm({
      mode: item.lead_id ? "lead" : "manual",
      lead_id: item.lead_id || "",
      patient_name: item.patient_name || "",
      phone: item.phone || "",
      city: item.city || "",
      manual_source: item.lead_id ? "" : extraerFuenteManualDesdeNotas(item.notes),
      appointment_date: item.appointment_date,
      appointment_time: normalizarHora(item.appointment_time),
      duration_minutes: String(extraerDuracionDesdeNotas(item.notes)),
      status: item.status || "agendada",
      service_type: item.service_type || "",
      specialist_user_id: item.specialist_user_id || "",
      notes: limpiarMetadatosAgenda(item.notes),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function seleccionarCitaRapida(item: AppointmentRow) {
    setSelectedQuickAppointmentId(item.id);
    setFechaFiltro(item.appointment_date);
    setBusquedaAgenda(item.patient_name || item.phone || "");
  }

  function abrirIngresoComercialDesdeCita(item: AppointmentRow) {
    setSelectedQuickAppointmentId(item.id);
    setSelectedCommercialAppointmentId(item.id);
    setLastCommercialPrintData(null);
    setFechaFiltro(item.appointment_date);
    setBusquedaAgenda(item.patient_name || item.phone || "");
    setCommercialForm({
      customer_name: item.patient_name || "",
      phone: item.phone || "",
      city: item.city || "",
      documento: "",
      fuente: item.lead_id ? "lead_existente" : extraerFuenteManualDesdeNotas(item.notes),
      fuente_detalle: "",
      fuente_usuario_id: "",
      observaciones: limpiarFuenteManualDeNotas(item.notes),
      acompanante_nombre: "",
      acompanante_parentesco: "",
      tiene_eps: "si",
      afiliacion: "",
      ocupacion: "",
      ocupacion_otro: "",
      edad: "",
      trae_cedula: "si",
      celular_inteligente: "si",
      hipertenso: "no",
      diabetico: "no",
      cirugias: "no",
      cirugias_cual: "",
      medicamentos: "no",
      medicamentos_cual: "",
      enfermedades: "no",
      enfermedades_cual: "",
      tiempo_detox_30_min: "",
      clinical_flags: emptyCommercialClinicalFlags(),
      clasificacion_inicial: "No Q",
      clasificacion_motivo: "",
      referido_por: "",
    });
    setActiveSection("comercial");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function actualizarEstadoLeadPorCita(
    leadId: string | null,
    appointmentStatus: string
  ) {
    if (!leadId) return;

    let leadStatus = "agendado";

    if (appointmentStatus === "no_asistio") {
      leadStatus = "no_asistio";
    }

    if (appointmentStatus === "cancelada" || appointmentStatus === "finalizada") {
      leadStatus = "contactado";
    }

    const { error } = await supabase
      .from("leads")
      .update({ status: leadStatus })
      .eq("id", leadId);

    if (error) throw error;
  }

  async function guardarConfiguracionAgenda() {
    try {
      setSavingConfig(true);
      setMensaje("");
      setError("");

      const agenda_date = form.appointment_date;

      const { error: dayError } = await supabase
        .from("agenda_day_settings")
        .upsert(
          [
            {
              agenda_date,
              daily_capacity: Number(dailyCapacityInput || DEFAULT_DAILY_CAPACITY),
              is_closed: dailyClosedInput,
            },
          ],
          { onConflict: "agenda_date" }
        );

      if (dayError) throw dayError;

      const slotRows = SLOT_OPTIONS.map((slot) => ({
        agenda_date,
        slot_time: slot.value,
        capacity: Number(slotCapacityInputs[slot.value] || DEFAULT_SLOT_CAPACITY),
        is_blocked: slotBlockedInputs[slot.value] || false,
      }));

      const { error: slotError } = await supabase
        .from("agenda_slot_settings")
        .upsert(slotRows, { onConflict: "agenda_date,slot_time" });

      if (slotError) throw slotError;

      setMensaje("ConfiguraciÃƒÆ’Ã‚Â³n de agenda guardada correctamente.");
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la configuraciÃƒÆ’Ã‚Â³n de agenda.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.patient_name.trim()) {
      setError("Debes indicar el nombre del cliente.");
      return;
    }

    if (form.mode === "manual" && !form.manual_source) {
      setError("Debes seleccionar la fuente cuando la cita es manual.");
      return;
    }

    if (!form.appointment_date) {
      setError("Debes seleccionar la fecha.");
      return;
    }

    if (!form.appointment_time) {
      setError("Debes seleccionar la hora.");
      return;
    }

    if (!currentUserId) {
      setError("No se encontrÃƒÆ’Ã‚Â³ el usuario actual.");
      return;
    }

    if ((activeSection === "especialistas" || activeSection === "tratamientos") && !form.service_type.trim()) {
      setError(`Debes seleccionar ${activeSection === "especialistas" ? "un especialista" : "un tratamiento"}.`);
      return;
    }

    if (
      (activeSection === "especialistas" || activeSection === "tratamientos") &&
      !form.specialist_user_id.trim()
    ) {
      setError("Debes seleccionar el profesional asignado para esta cita.");
      return;
    }

    const durationMinutes = Number(form.duration_minutes || "30");
    const durationOptionsForCurrentForm = getDurationOptions(
      activeSection,
      form.service_type,
      form.appointment_date
    );

    if (durationOptionsForCurrentForm.length === 0) {
      setError("Ese servicio no tiene agenda disponible para la fecha seleccionada.");
      return;
    }

    if (!durationOptionsForCurrentForm.some((item) => item.value === String(durationMinutes))) {
      setError("La duraciÃƒÆ’Ã‚Â³n elegida no es vÃƒÆ’Ã‚Â¡lida para ese servicio.");
      return;
    }

    if (selectedDateClosed) {
      setError("Ese dÃƒÆ’Ã‚Â­a estÃƒÆ’Ã‚Â¡ cerrado para agenda.");
      return;
    }

    const selectedSlot = slotAvailability.find(
      (slot) => slot.value === form.appointment_time
    );

    if (!selectedSlot) {
      setError("Debes seleccionar una hora vÃƒÆ’Ã‚Â¡lida.");
      return;
    }

    if (selectedSlot.disabled) {
      setError("Ese horario no estÃƒÆ’Ã‚Â¡ disponible.");
      return;
    }

    if (
      form.mode === "lead" &&
      form.lead_id &&
      appointments.some(
        (item) =>
          item.lead_id === form.lead_id &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
          item.id !== editingAppointmentId
      )
    ) {
      setError("Este lead ya tiene una cita activa. Primero debes cerrar o marcar la cita anterior.");
      return;
    }

    setSavingAppointment(true);

    try {
      const payload = {
        lead_id: form.mode === "lead" ? form.lead_id || null : null,
        patient_name: form.patient_name.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        status: form.status,
        service_type:
          activeSection === "agenda"
            ? "valoracion"
            : form.service_type || null,
        specialist_user_id:
          activeSection === "especialistas" || activeSection === "tratamientos"
            ? form.specialist_user_id || null
            : null,
        notes:
          construirNotasAgenda({
            notes: form.notes,
            manualSource: form.mode === "manual" ? form.manual_source : "",
            durationMinutes: Number(form.duration_minutes || "30"),
          }) || null,
        updated_by_user_id: currentUserId,
      };

      if (editingAppointmentId) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingAppointmentId);

        if (error) throw error;

        if (payload.lead_id) {
          await actualizarEstadoLeadPorCita(payload.lead_id, payload.status);
        }

        setMensaje("Cita actualizada correctamente. La impresion ya quedo habilitada.");
      } else {
        const { error } = await supabase.from("appointments").insert([
          {
            ...payload,
            created_by_user_id: currentUserId,
          },
        ]);

        if (error) throw error;

        if (payload.lead_id) {
          await actualizarEstadoLeadPorCita(payload.lead_id, payload.status);
        }

        setMensaje("Cita creada correctamente. La impresion ya quedo habilitada.");
      }

      setLastSavedAppointmentPrint(buildAppointmentPrintData());
      resetForm({ preserveLastSavedAppointmentPrint: true });
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la cita.");
    } finally {
      setSavingAppointment(false);
    }
  }

  async function crearCasoVentasSiNoExiste(appointment: AppointmentRow) {
    const { data: existente, error: errorBusqueda } = await supabase
      .from("commercial_cases")
      .select("id")
      .eq("appointment_id", appointment.id)
      .limit(1);

    if (errorBusqueda) throw errorBusqueda;
    if (existente && existente.length > 0) return false;

    const { error: errorInsert } = await supabase.from("commercial_cases").insert([
      {
        lead_id: appointment.lead_id,
        appointment_id: appointment.id,
        customer_name: appointment.patient_name,
        phone: appointment.phone || null,
        city: appointment.city || null,
        status: "pendiente_asignacion_comercial",
        created_by_user_id: currentUserId,
        updated_by_user_id: currentUserId,
      },
    ]);

    if (errorInsert) throw errorInsert;
    return true;
  }

  async function actualizarEstadoCita(id: string, forcedStatus?: string) {
    if (isReadOnlyAgendaForCall) return;

    const nuevoEstado = forcedStatus || statusById[id];
    if (!nuevoEstado || !currentUserId) return;

    setSavingStatusId(id);
    setMensaje("");
    setError("");

    const appointmentActual = appointments.find((item) => item.id === id);
    const tieneIngresoComercial = commercialCases.some(
      (item) => item.appointment_id === id
    );

    if (nuevoEstado === "no_asistio" && tieneIngresoComercial) {
      setError("Esta cita ya fue registrada en ingreso comercial, asÃƒÆ’Ã‚Â­ que no puede pasar a No asistiÃƒÆ’Ã‚Â³.");
      setSavingStatusId(null);
      return;
    }

    const payload: any = {
      status: nuevoEstado,
      updated_by_user_id: currentUserId,
    };

    if (nuevoEstado === "en_espera") {
      payload.checked_in_at = new Date().toISOString();
    }

    if (nuevoEstado === "asistio") {
      payload.attended_at = new Date().toISOString();
    }

    const { error } = await supabase.from("appointments").update(payload).eq("id", id);

    if (error) {
      setError("No se pudo actualizar el estado de la cita.");
      setSavingStatusId(null);
      return;
    }

    let mensajeFinal = "Estado actualizado correctamente.";

    try {
      if (appointmentActual?.lead_id) {
        await actualizarEstadoLeadPorCita(appointmentActual.lead_id, nuevoEstado);
      }

      if (nuevoEstado === "asistio" && appointmentActual) {
        const creado = await crearCasoVentasSiNoExiste(appointmentActual);
        if (creado) {
          mensajeFinal =
            "Estado actualizado y se creo automaticamente el caso de ventas. Ya puedes pasar a ingreso comercial para guardar e imprimir el registro si aplica.";
        }
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "La cita se actualizÃƒÆ’Ã‚Â³, pero no se pudo terminar el proceso posterior."
      );
      setSavingStatusId(null);
      await cargarTodo();
      return;
    }

    setAppointments((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nuevoEstado,
              checked_in_at:
                nuevoEstado === "en_espera"
                  ? payload.checked_in_at
                  : item.checked_in_at,
              attended_at:
                nuevoEstado === "asistio"
                  ? payload.attended_at
                  : item.attended_at,
            }
          : item
      )
    );

    setMensaje(mensajeFinal);
    setSavingStatusId(null);
  }

  async function guardarEstado(id: string) {
    return actualizarEstadoCita(id);
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#F1FBF5_0%,_#FAFCF9_48%,_#FFFDF9_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)] backdrop-blur">
          <p className="text-sm font-medium text-[#607368]">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#F1FBF5_0%,_#FAFCF9_48%,_#FFFDF9_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(150,102,95,0.12)] backdrop-blur">
          <p className="text-sm font-medium text-[#9A4E43]">
            {error || "No tienes permiso para entrar a este mÃƒÆ’Ã‚Â³dulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-80 w-80 rounded-full bg-[#8CB88D]/18 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-[20px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#FFFFFF_0%,_#F0FBF5_60%,_#E2F4EA_100%)] shadow-[0_14px_30px_rgba(95,125,102,0.18)]">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>

        {isEmbeddedCommercialCreationView ? (
          <section className="relative mb-6 overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_58%,_rgba(233,246,238,0.94)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.14)]">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                  Comercial
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1F3128] md:text-[2.7rem]">
                  Crear cliente
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                  Usa este formulario para registrar el cliente sin abrir el mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³dulo completo de recepciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n.
                </p>
              </div>

              <SessionBadge />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={commercialBackHref}
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Volver
              </a>
            </div>
          </section>
        ) : (
        <section className="relative mb-6 overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                {isLimitedReceptionForCall ? "Agenda" : "Recepci\u00F3n"}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.1rem]">
                {isLimitedReceptionForCall ? "Agenda visible" : "Agenda y admisi\u00F3n"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                {isLimitedReceptionForCall
                  ? currentRoleCode === "supervisor_call_center"
                    ? "Desde aqu\u00ED puedes ver la agenda, crear citas y organizar los cupos sin entrar a los dem\u00E1s m\u00F3dulos de recepci\u00F3n."
                    : "Desde aqu\u00ED puedes crear una cita para tu lead sin entrar al m\u00F3dulo completo de recepci\u00F3n."
                  : "Crear citas, ubicar clientes, registrar llegada y actualizar estado."}
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </Link>

            {isCommercialReceptionOnly ? (
              <button
                type="button"
                onClick={() => cambiarSeccion("comercial")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "comercial" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
              >
                Ingreso comercial
              </button>
            ) : isLimitedReceptionForCall ? (
              <button
                type="button"
                onClick={() => cambiarSeccion("agenda")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "agenda" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
              >
                Agenda
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("agenda")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "agenda" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("especialistas")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "especialistas" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Especialistas
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("tratamientos")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "tratamientos" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Tratamientos
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("comercial")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "comercial" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Ingreso comercial
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("nutricion_entregas")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "nutricion_entregas" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Entregas nutriciÃƒÆ’Ã‚Â³n
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("inventario")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeSection === "inventario" ? "bg-[#5F7D66] text-white shadow-sm" : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"}`}
                >
                  Inventario
                </button>
              </>
            )}
          </div>
        </section>
        )}

        {error ? (
          <div className="mb-6 rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-[26px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(245,252,247,0.98)_0%,_rgba(237,248,241,0.98)_100%)] p-4 text-sm text-[#4F6F5B] shadow-[0_16px_32px_rgba(95,125,102,0.08)]">
            {mensaje}
          </div>
        ) : null}

        {!isLimitedReceptionForCall && !isEmbeddedCommercialCreationView ? (
          <section className="mb-6 overflow-hidden rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(243,251,246,0.98)_58%,_rgba(231,244,236,0.96)_100%)] p-6 shadow-[0_24px_58px_rgba(95,125,102,0.14)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-[#D7EADF] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                  Recepcion en vivo
                </p>
                <h2 className="mt-3 text-2xl font-bold text-[#1F3128]">
                  Pendientes de impresion y entrega
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607368]">
                  Esta bandeja se actualiza automaticamente cuando comercial finaliza una venta o
                  cuando nutricion y fisioterapia dejan un paciente pendiente para recepcion.
                </p>
              </div>

              <div className="grid min-w-[240px] gap-3 rounded-[26px] border border-[#D6E8DA] bg-white/80 p-4 shadow-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6A8376]">
                    Total
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#1F3128]">
                    {receptionLiveSummary.total}
                  </p>
                </div>
                <div className="space-y-2 text-sm text-[#4F6F5B]">
                  <p>Comercial: {receptionLiveSummary.commercial}</p>
                  <p>Nutricion: {receptionLiveSummary.nutrition}</p>
                  <p>Fisioterapia: {receptionLiveSummary.physiotherapy}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[28px] border border-[#D6E8DA] bg-white/90 p-5 shadow-[0_16px_36px_rgba(95,125,102,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F3128]">Comercial finalizado</h3>
                    <p className="mt-1 text-sm text-[#607368]">
                      Ventas del dia listas para imprimir desde recepcion.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF7F1] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                    {commercialPendingPrintCases.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {commercialPendingPrintCases.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-4 text-sm text-[#607368]">
                      Sin ventas pendientes de impresion por ahora.
                    </div>
                  ) : (
                    commercialPendingPrintCases.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[22px] border border-[#DCEBE1] bg-[#FCFEFC] p-4">
                        <p className="text-sm font-semibold text-slate-900">{item.customer_name}</p>
                        <p className="mt-1 text-sm text-[#607368]">
                          {serviceLabelComercial(item.purchased_service)} Ãƒâ€šÃ‚Â·{" "}
                          {formatHora(item.next_appointment_time) || "Sin hora siguiente"}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7F74]">
                          Cierre: {new Date(item.closed_at || item.created_at).toLocaleString("es-CO")}
                        </p>
                        <button
                          type="button"
                          onClick={() => imprimirPlanComercialDesdeRecepcion(item)}
                          disabled={queueActionId === `commercial-${item.id}`}
                          className="mt-3 w-full rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                        >
                          {queueActionId === `commercial-${item.id}`
                            ? "Preparando..."
                            : "Imprimir plan y cita"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#D6E8DA] bg-white/90 p-5 shadow-[0_16px_36px_rgba(95,125,102,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F3128]">Nutricion pendiente</h3>
                    <p className="mt-1 text-sm text-[#607368]">
                      Historia, indicaciones y entrega listas para recepcion.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF7F1] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                    {nutritionPendingAppointments.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {nutritionPendingAppointments.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-4 text-sm text-[#607368]">
                      Sin entregas de nutricion pendientes.
                    </div>
                  ) : (
                    nutritionPendingAppointments.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-[22px] border border-[#DCEBE1] bg-[#FCFEFC] p-4">
                        <p className="text-sm font-semibold text-slate-900">{item.patient_name}</p>
                        <p className="mt-1 text-sm text-[#607368]">
                          {item.appointment_date} Ãƒâ€šÃ‚Â· {formatHora(item.appointment_time)}
                        </p>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => imprimirResumenNutricionDesdeRecepcion(item)}
                            disabled={queueActionId === `nutrition-print-${item.id}`}
                            className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                          >
                            {queueActionId === `nutrition-print-${item.id}`
                              ? "Preparando..."
                              : "Imprimir historia e indicaciones"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void abrirPendienteNutricion(item)}
                            disabled={queueActionId === `nutrition-open-${item.id}`}
                            className="w-full rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                          >
                            {queueActionId === `nutrition-open-${item.id}`
                              ? "Abriendo..."
                              : "Abrir entrega en recepcion"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#D6E8DA] bg-white/90 p-5 shadow-[0_16px_36px_rgba(95,125,102,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1F3128]">Fisioterapia pendiente</h3>
                    <p className="mt-1 text-sm text-[#607368]">
                      Impresion clinica y cierre del pendiente desde recepcion.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF7F1] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                    {physiotherapyPendingAppointments.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {physiotherapyPendingAppointments.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-4 text-sm text-[#607368]">
                      Sin pendientes de fisioterapia por ahora.
                    </div>
                  ) : (
                    physiotherapyPendingAppointments.slice(0, 4).map((item) => {
                      const nextAppointment = buscarSiguienteCita(item);
                      return (
                      <div key={item.id} className="rounded-[22px] border border-[#DCEBE1] bg-[#FCFEFC] p-4">
                        <p className="text-sm font-semibold text-slate-900">{item.patient_name}</p>
                        <p className="mt-1 text-sm text-[#607368]">
                          {item.appointment_date} Ãƒâ€šÃ‚Â· {formatHora(item.appointment_time)}
                        </p>
                        {nextAppointment ? (
                          <div className="mt-3 rounded-2xl border border-[#D7EADF] bg-white/90 p-3 text-sm text-slate-700">
                            <p>
                              <span className="font-medium">Siguiente cita:</span>{" "}
                              {nextAppointment.appointment_date} Ãƒâ€šÃ‚Â· {formatHora(nextAppointment.appointment_time)}
                            </p>
                            <p className="mt-1">
                              <span className="font-medium">Servicio:</span>{" "}
                              {nextAppointment.service_type || "Sin servicio"}
                            </p>
                          </div>
                        ) : null}
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={() => imprimirResumenFisioterapiaDesdeRecepcion(item)}
                            disabled={queueActionId === `physio-print-${item.id}`}
                            className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                          >
                            {queueActionId === `physio-print-${item.id}`
                              ? "Preparando..."
                              : "Imprimir historia e indicaciones"}
                          </button>
                          {nextAppointment ? (
                            <button
                              type="button"
                              onClick={() => imprimirSiguienteCita(item)}
                              className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                            >
                              Imprimir siguiente cita
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void resolverPendienteFisioterapia(item)}
                            disabled={queueActionId === `physio-resolve-${item.id}`}
                            className="w-full rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                          >
                            {queueActionId === `physio-resolve-${item.id}`
                              ? "Guardando..."
                              : "Marcar pendiente resuelto"}
                          </button>
                        </div>
                      </div>
                    )})
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!isReadOnlyAgendaForCall && !isEmbeddedCommercialCreationView && (
          activeSection === "comercial" ? (
            <section className="mb-6 grid gap-4 md:grid-cols-5">
              <StatCard title="Ingresos comerciales" value={String(commercialSummary.total)} />
              <StatCard title="Pendientes" value={String(commercialSummary.pendientes)} />
              <StatCard title="Asignados" value={String(commercialSummary.asignados)} />
              <StatCard title="En atenciÃƒÆ’Ã‚Â³n" value={String(commercialSummary.atencion)} />
              <StatCard title="Finalizados" value={String(commercialSummary.finalizados)} />
            </section>
          ) : activeSection === "nutricion_entregas" ? (
            <section className="mb-6 grid gap-4 md:grid-cols-3">
              <StatCard title="Pendientes nutriciÃƒÆ’Ã‚Â³n" value={String(nutritionPendingSummary.total)} />
              <StatCard title="Con producto seleccionado" value={nutritionDeliveryProductId ? "1" : "0"} />
              <StatCard title="Cliente abierto" value={nutritionSelection ? "1" : "0"} />
            </section>
          ) : (
            <section className="mb-6 grid gap-4 md:grid-cols-5">
              <StatCard title={`${sectionLabel} del dÃƒÆ’Ã‚Â­a`} value={String(resumen.total)} />
              <StatCard title="Agendadas" value={String(resumen.agendadas)} />
              <StatCard title="En espera" value={String(resumen.espera)} />
              <StatCard title="AsistiÃƒÆ’Ã‚Â³" value={String(resumen.asistio)} />
              <StatCard title="No asistiÃƒÆ’Ã‚Â³" value={String(resumen.noAsistio)} />
            </section>
          )
        )}

        {canManageAgendaConfig && activeSection !== "impresiones" && activeSection !== "inventario" && activeSection !== "comercial" && activeSection !== "nutricion_entregas" ? (
          <section className="mb-6 rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-[#D7EADF] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                  Configuraci&oacute;n
                </p>
                <h2 className="mt-3 text-2xl font-bold text-[#24312A]">
                  ConfiguraciÃƒÆ’Ã‚Â³n de cupos
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#607368]">
                  Define cupos diarios y bloquea horarios por fecha.
                </p>
              </div>

              <button
                type="button"
                onClick={guardarConfiguracionAgenda}
                disabled={savingConfig}
                className="rounded-2xl bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(63,105,82,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
              >
                {savingConfig ? "Guardando..." : "Guardar configuraciÃƒÆ’Ã‚Â³n"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field
                label="Fecha a configurar"
                input={
                  <input
                    className={inputClass}
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appointment_date: e.target.value,
                      }))
                    }
                  />
                }
              />

              <Field
                label="Cupo total del dÃƒÆ’Ã‚Â­a"
                input={
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={dailyCapacityInput}
                    onChange={(e) => setDailyCapacityInput(e.target.value)}
                  />
                }
              />

              <label className="flex items-center gap-3 rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] px-4 py-4">
                <input
                  type="checkbox"
                  checked={dailyClosedInput}
                  onChange={(e) => setDailyClosedInput(e.target.checked)}
                />
                <span className="text-sm font-medium text-slate-700">
                  Cerrar este dÃƒÆ’Ã‚Â­a completo
                </span>
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {SLOT_OPTIONS.map((slot) => (
                <div key={slot.value} className="rounded-2xl border border-[#E3ECE5] bg-[#FBFCFB] p-4">
                  <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Activos:{" "}
                    {
                      appointmentsForSelectedDate.filter(
                        (item) =>
                          normalizarHora(item.appointment_time) === slot.value &&
                          ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
                      ).length
                    }
                    /{slotCapacityInputs[slot.value] || DEFAULT_SLOT_CAPACITY}
                  </p>

                  <div className="mt-3">
                    <label className="text-xs text-slate-500">Cupo</label>
                    <input
                      className={`${inputClass} mt-1 py-3`}
                      type="number"
                      min="0"
                      value={slotCapacityInputs[slot.value] || ""}
                      onChange={(e) =>
                        setSlotCapacityInputs((prev) => ({
                          ...prev,
                          [slot.value]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <label className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={slotBlockedInputs[slot.value] || false}
                      onChange={(e) =>
                        setSlotBlockedInputs((prev) => ({
                          ...prev,
                          [slot.value]: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-slate-700">Bloquear hora</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "comercial" && !isReadOnlyAgendaForCall ? (
          <section className={`mb-6 grid gap-6 ${isEmbeddedCommercialCreationView ? "" : "xl:grid-cols-[1.05fr_0.95fr]"}`}>
            <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ingreso comercial</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Registra la llegada del cliente al ÃƒÆ’Ã‚Â¡rea comercial y dÃƒÆ’Ã‚Â©jalo disponible para asignaciÃƒÆ’Ã‚Â³n del gerente.
                  </p>
                </div>
              </div>

              {selectedCommercialAppointmentId ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Cita seleccionada para ingreso comercial</p>
                  <p className="mt-1">
                    Al guardar este registro, la cita quedarÃƒÆ’Ã‚Â¡ automÃƒÆ’Ã‚Â¡ticamente como <strong>AsistiÃƒÆ’Ã‚Â³</strong>.
                    DespuÃƒÆ’Ã‚Â©s de este paso ya no deberÃƒÆ’Ã‚Â­a marcarse como <strong>No asistiÃƒÆ’Ã‚Â³</strong>, porque el cliente ya quedÃƒÆ’Ã‚Â³ recibido en Comercial.
                  </p>
                </div>
              ) : null}

              <form onSubmit={registrarIngresoComercial} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Cliente"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.customer_name}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="TelÃƒÆ’Ã‚Â©fono"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.phone}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Ciudad"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.city}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Documento"
                    input={
                      <div className="space-y-2">
                        <input
                          className={inputClass}
                          value={commercialForm.documento}
                          onChange={(e) => setCommercialForm((prev) => ({ ...prev, documento: e.target.value }))}
                        />
                        <p className="text-xs text-slate-500">
                          {loadingCommercialClientLookup
                            ? "Buscando cliente existente..."
                            : "Si la cÃƒÆ’Ã‚Â©dula ya existe, se completarÃƒÆ’Ã‚Â¡n nombre, telÃƒÂ©fono y ciudad."}
                        </p>
                      </div>
                    }
                  />
                  <Field
                    label="Fuente"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.fuente}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            fuente: normalizarFuenteManual(e.target.value),
                            fuente_usuario_id: "",
                            referido_por: "",
                          }))
                        }
                      >
                        <option value="">Selecciona</option>
                        {manualSourceOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  {commercialSourceDetailMeta ? (
                    <Field
                      label={commercialSourceDetailMeta.label}
                      input={
                        sourceNeedsUserSelection ? (
                          <select
                            className={inputClass}
                            value={commercialForm.fuente_usuario_id}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                fuente_usuario_id: e.target.value,
                              }))
                            }
                          >
                            <option value="">Selecciona usuario</option>
                            {availableSourceUsers.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.full_name} Ãƒâ€šÃ‚Â· {item.role_name || item.role_code}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={inputClass}
                            placeholder={commercialSourceDetailMeta.placeholder}
                            value={commercialForm.referido_por}
                            onChange={(e) => setCommercialForm((prev) => ({ ...prev, referido_por: e.target.value }))}
                          />
                        )
                      }
                    />
                  ) : (
                    <div />
                  )}
                  <Field
                    label="Ãƒâ€šÃ‚Â¿Tiene EPS?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.tiene_eps}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, tiene_eps: e.target.value }))}
                      >
                        <option value="si">SÃƒÆ’Ã‚Â­</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="AfiliaciÃƒÆ’Ã‚Â³n"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.afiliacion}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, afiliacion: e.target.value }))}
                      >
                        <option value="">Selecciona</option>
                        <option value="cotizante">Cotizante</option>
                        <option value="beneficiario">Beneficiario</option>
                        <option value="subsidiado">Subsidiado</option>
                        <option value="particular">Particular</option>
                      </select>
                    }
                  />
                  <Field
                    label="Edad"
                    input={
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        value={commercialForm.edad}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, edad: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Ãƒâ€šÃ‚Â¿Asiste con cÃƒÆ’Ã‚Â©dula?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.trae_cedula}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, trae_cedula: e.target.value }))}
                      >
                        <option value="si">SÃƒÆ’Ã‚Â­</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="Ãƒâ€šÃ‚Â¿Tiene celular inteligente?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.celular_inteligente}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, celular_inteligente: e.target.value }))}
                      >
                        <option value="si">SÃƒÆ’Ã‚Â­</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="OcupaciÃƒÆ’Ã‚Â³n"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.ocupacion}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            ocupacion: e.target.value,
                            ocupacion_otro: shouldAskOccupationDetail(e.target.value)
                              ? prev.ocupacion_otro
                              : "",
                          }))
                        }
                      >
                        <option value="">Selecciona</option>
                        {commercialOccupationOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  {occupationNeedsDetail ? (
                    <Field
                      label={getOccupationDetailLabel(commercialForm.ocupacion)}
                      input={
                        <input
                          className={inputClass}
                          placeholder="Escribe cual"
                          value={commercialForm.ocupacion_otro}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              ocupacion_otro: e.target.value,
                            }))
                          }
                        />
                      }
                    />
                  ) : null}
                  <Field
                    label="Cuenta con 30 min para terapia detox?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.tiempo_detox_30_min}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            tiempo_detox_30_min: e.target.value,
                          }))
                        }
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Si</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium text-slate-700">ClasificaciÃƒÆ’Ã‚Â³n inicial</p>
                    <span className={`rounded-full px-3 py-1 text-xs ${commercialForm.clasificacion_inicial === "Q" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {commercialForm.clasificacion_inicial}
                    </span>
                    <p className="text-xs text-slate-500">
                      Si entra No Q y compra en Comercial, luego podrÃƒÆ’Ã‚Â¡ pasar automÃƒÆ’Ã‚Â¡ticamente a Q como clasificaciÃƒÆ’Ã‚Â³n final.
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    {commercialForm.clasificacion_motivo || "Completa los datos para calcular la clasificaciÃƒÆ’Ã‚Â³n."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Antecedentes bÃƒÆ’Ã‚Â¡sicos</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Registra lo que el cliente refiere y marca internamente si alguno descalifica.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCommercialForm((prev) => ({
                          ...prev,
                          hipertenso: "no",
                          diabetico: "no",
                          cirugias: "no",
                          cirugias_cual: "",
                          medicamentos: "no",
                          medicamentos_cual: "",
                          enfermedades: "no",
                          enfermedades_cual: "",
                          clinical_flags: emptyCommercialClinicalFlags(),
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                      <Field
                        label="Ãƒâ€šÃ‚Â¿Hipertenso?"
                        input={
                          <select
                            className={inputClass}
                            value={commercialForm.hipertenso}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                hipertenso: e.target.value,
                                clinical_flags: {
                                  ...prev.clinical_flags,
                                  hipertenso_descalifica:
                                    e.target.value === "si" ? prev.clinical_flags.hipertenso_descalifica : false,
                                },
                              }))
                            }
                          >
                            <option value="no">No</option>
                            <option value="si">SÃƒÆ’Ã‚Â­</option>
                          </select>
                        }
                      />
                      <div />
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={commercialForm.clinical_flags.hipertenso_descalifica}
                          disabled={commercialForm.hipertenso !== "si"}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              clinical_flags: {
                                ...prev.clinical_flags,
                                hipertenso_descalifica: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Descalifica</span>
                      </label>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                      <Field
                        label="Ãƒâ€šÃ‚Â¿DiabÃƒÆ’Ã‚Â©tico?"
                        input={
                          <select
                            className={inputClass}
                            value={commercialForm.diabetico}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                diabetico: e.target.value,
                                clinical_flags: {
                                  ...prev.clinical_flags,
                                  diabetico_descalifica:
                                    e.target.value === "si" ? prev.clinical_flags.diabetico_descalifica : false,
                                },
                              }))
                            }
                          >
                            <option value="no">No</option>
                            <option value="si">SÃƒÆ’Ã‚Â­</option>
                          </select>
                        }
                      />
                      <div />
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={commercialForm.clinical_flags.diabetico_descalifica}
                          disabled={commercialForm.diabetico !== "si"}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              clinical_flags: {
                                ...prev.clinical_flags,
                                diabetico_descalifica: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Descalifica</span>
                      </label>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                      <Field
                        label="Ãƒâ€šÃ‚Â¿CirugÃƒÆ’Ã‚Â­as?"
                        input={
                          <select
                            className={inputClass}
                            value={commercialForm.cirugias}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                cirugias: e.target.value,
                                cirugias_cual: e.target.value === "si" ? prev.cirugias_cual : "",
                                clinical_flags: {
                                  ...prev.clinical_flags,
                                  cirugias_descalifica:
                                    e.target.value === "si" ? prev.clinical_flags.cirugias_descalifica : false,
                                },
                              }))
                            }
                          >
                            <option value="no">No</option>
                            <option value="si">SÃƒÆ’Ã‚Â­</option>
                          </select>
                        }
                      />
                      <Field
                        label="Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã‚Â¡l cirugÃƒÆ’Ã‚Â­a?"
                        input={
                          <input
                            className={inputClass}
                            placeholder="Escribe cuÃƒÆ’Ã‚Â¡l"
                            value={commercialForm.cirugias_cual}
                            disabled={commercialForm.cirugias !== "si"}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                cirugias_cual: e.target.value,
                              }))
                            }
                          />
                        }
                      />
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={commercialForm.clinical_flags.cirugias_descalifica}
                          disabled={commercialForm.cirugias !== "si"}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              clinical_flags: {
                                ...prev.clinical_flags,
                                cirugias_descalifica: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Descalifica</span>
                      </label>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                      <Field
                        label="Ãƒâ€šÃ‚Â¿Toma medicamentos?"
                        input={
                          <select
                            className={inputClass}
                            value={commercialForm.medicamentos}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                medicamentos: e.target.value,
                                medicamentos_cual: e.target.value === "si" ? prev.medicamentos_cual : "",
                                clinical_flags: {
                                  ...prev.clinical_flags,
                                  medicamentos_descalifica:
                                    e.target.value === "si" ? prev.clinical_flags.medicamentos_descalifica : false,
                                },
                              }))
                            }
                          >
                            <option value="no">No</option>
                            <option value="si">SÃƒÆ’Ã‚Â­</option>
                          </select>
                        }
                      />
                      <Field
                        label="Ãƒâ€šÃ‚Â¿CuÃƒÆ’Ã‚Â¡les medicamentos?"
                        input={
                          <input
                            className={inputClass}
                            placeholder="Escribe cuÃƒÆ’Ã‚Â¡les"
                            value={commercialForm.medicamentos_cual}
                            disabled={commercialForm.medicamentos !== "si"}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                medicamentos_cual: e.target.value,
                              }))
                            }
                          />
                        }
                      />
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={commercialForm.clinical_flags.medicamentos_descalifica}
                          disabled={commercialForm.medicamentos !== "si"}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              clinical_flags: {
                                ...prev.clinical_flags,
                                medicamentos_descalifica: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Descalifica</span>
                      </label>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_auto]">
                      <Field
                        label="Enfermedades?"
                        input={
                          <select
                            className={inputClass}
                            value={commercialForm.enfermedades}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                enfermedades: e.target.value,
                                enfermedades_cual: e.target.value === "si" ? prev.enfermedades_cual : "",
                                clinical_flags: {
                                  ...prev.clinical_flags,
                                  enfermedades_descalifica:
                                    e.target.value === "si" ? prev.clinical_flags.enfermedades_descalifica : false,
                                },
                              }))
                            }
                          >
                            <option value="no">No</option>
                            <option value="si">Si</option>
                          </select>
                        }
                      />
                      <Field
                        label="Cuales enfermedades?"
                        input={
                          <input
                            className={inputClass}
                            placeholder="Escribe cuales"
                            value={commercialForm.enfermedades_cual}
                            disabled={commercialForm.enfermedades !== "si"}
                            onChange={(e) =>
                              setCommercialForm((prev) => ({
                                ...prev,
                                enfermedades_cual: e.target.value,
                              }))
                            }
                          />
                        }
                      />
                      <label className="flex items-end gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={commercialForm.clinical_flags.enfermedades_descalifica}
                          disabled={commercialForm.enfermedades !== "si"}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              clinical_flags: {
                                ...prev.clinical_flags,
                                enfermedades_descalifica: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Descalifica</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Nombre del acompaÃƒÆ’Ã‚Â±ante"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.acompanante_nombre}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            acompanante_nombre: e.target.value,
                          }))
                        }
                      />
                    }
                  />

                  <Field
                    label="Parentesco"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.acompanante_parentesco}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            acompanante_parentesco: e.target.value,
                          }))
                        }
                      />
                    }
                  />
                </div>

                <Field
                  label="Observaciones de recepciÃƒÆ’Ã‚Â³n"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-none`}
                      value={commercialForm.observaciones}
                      onChange={(e) => setCommercialForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                    />
                  }
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="submit"
                    disabled={savingCommercialIntake}
                    className="w-full rounded-2xl bg-[#5F7D66] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#4F6F5B] disabled:opacity-60"
                  >
                    {savingCommercialIntake ? "Registrando..." : "Registrar ingreso a comercial"}
                  </button>

                  <button
                    type="button"
                    onClick={imprimirRegistroComercial}
                    disabled={!lastCommercialPrintData}
                    className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {lastCommercialPrintData ? "Imprimir registro" : "Imprimir registro (se habilita al guardar)"}
                  </button>
                </div>
              </form>
            </div>

            {!isEmbeddedCommercialCreationView ? (
            <div className="rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(244,251,246,0.96)_100%)] p-6 shadow-[0_24px_52px_rgba(95,125,102,0.14)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ingresos comerciales del dÃƒÆ’Ã‚Â­a</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    AquÃƒÆ’Ã‚Â­ solo aparecen los ingresos comerciales creados el dÃƒÆ’Ã‚Â­a de hoy.
                  </p>
                </div>

                <input
                  className="w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4] md:max-w-xs"
                  placeholder="Buscar por nombre o telÃƒÂ©fono"
                  value={commercialSearch}
                  onChange={(e) => setCommercialSearch(e.target.value)}
                />
              </div>

              <div className="mt-5 space-y-3">
                {commercialCasesFiltered.length === 0 ? (
                  <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                    AÃƒÆ’Ã‚Âºn no hay ingresos comerciales registrados.
                  </div>
                ) : (
                  commercialCasesFiltered.map((item) => (
                    <div key={item.id} className="rounded-[26px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_16px_34px_rgba(95,125,102,0.08)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">{item.customer_name}</p>
                            <span className={`rounded-full px-3 py-1 text-xs ${badgeEstadoComercial(item.status)}`}>
                              {traducirEstadoComercial(item.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.phone || "Sin telÃƒÂ©fono"} Ãƒâ€šÃ‚Â· {item.city || "Sin ciudad"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Ingreso: {new Date(item.created_at).toLocaleString()}
                          </p>
                          {getCommercialReceptionSummary(item).length > 0 ? (
                            <div className="mt-2 text-sm text-slate-700">
                              <span className="font-medium text-slate-800">Resumen:</span>{" "}
                              {getCommercialReceptionSummary(item).join(" | ")}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            ) : null}
          </section>
        ) : activeSection === "nutricion_entregas" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Pendientes nutriciÃƒÆ’Ã‚Â³n</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Clientes cuya cita ya fue finalizada por nutriciÃƒÆ’Ã‚Â³n y estÃƒÆ’Ã‚Â¡n pendientes de impresiÃƒÆ’Ã‚Â³n y entrega.
                  </p>
                </div>

                <input
                  className="w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4] md:max-w-xs"
                  placeholder="Buscar por nombre o telÃƒÂ©fono"
                  value={nutritionDeliverySearch}
                  onChange={(e) => setNutritionDeliverySearch(e.target.value)}
                />
              </div>

              <div className="mt-5 space-y-3">
                {nutritionPendingAppointments.length === 0 ? (
                  <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                    No hay clientes pendientes de entrega nutricional.
                  </div>
                ) : (
                  nutritionPendingAppointments.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-[26px] border p-4 transition ${selectedNutritionDeliveryId === item.id ? "border-[#7FA287] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] shadow-[0_16px_32px_rgba(95,125,102,0.12)]" : "border-[#D6E8DA] bg-white/92 shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F8FCF9]"}`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.patient_name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.phone || "Sin telÃƒÂ©fono"} Ãƒâ€šÃ‚Â· {item.city || "Sin ciudad"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.appointment_date} Ãƒâ€šÃ‚Â· {formatHora(item.appointment_time)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => abrirEntregaNutricion(item)}
                            className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                          >
                            Abrir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <h2 className="text-2xl font-bold text-slate-900">Entrega e impresiÃƒÆ’Ã‚Â³n</h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecciona un cliente pendiente, imprime el documento y descuenta los productos entregados.
              </p>

              {loadingNutritionSelection ? (
                <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                  Cargando informaciÃƒÆ’Ã‚Â³n nutricional...
                </div>
              ) : !nutritionSelection ? (
                <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                  Abre un cliente pendiente para imprimir su documento y registrar los productos.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner">
                    <p className="text-lg font-semibold text-slate-900">{nutritionSelection.appointment.patient_name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {nutritionSelection.document || "Sin documento"} Ãƒâ€šÃ‚Â· {nutritionSelection.appointment.phone || "Sin telÃƒÂ©fono"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {nutritionSelection.appointment.appointment_date} Ãƒâ€šÃ‚Â· {formatHora(nutritionSelection.appointment.appointment_time)}
                    </p>
                    {nutritionSelection.profile?.plan_nutricional ? (
                      <p className="mt-3 text-sm text-slate-700">
                        <span className="font-medium">Plan nutricional:</span> {nutritionSelection.profile.plan_nutricional}
                      </p>
                    ) : null}
                    {nutritionSelection.recommendation ? (
                      <div className="mt-3 rounded-2xl border border-[#CFE4D8] bg-white/90 p-3 text-sm text-slate-700">
                        <p>
                          <span className="font-medium">Producto sugerido:</span> {nutritionSelection.recommendation.productName}
                        </p>
                        <p className="mt-1">
                          <span className="font-medium">Cantidad:</span> {nutritionSelection.recommendation.quantity}
                        </p>
                        {nutritionSelection.recommendation.instructions ? (
                          <p className="mt-1">
                            <span className="font-medium">Indicaciones:</span> {nutritionSelection.recommendation.instructions}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      lastNutritionPrintSelection &&
                      imprimirDocumentoNutricional({
                        appointment: lastNutritionPrintSelection.appointment,
                        document: lastNutritionPrintSelection.document,
                        profile: lastNutritionPrintSelection.profile,
                      })
                    }
                    disabled={!lastNutritionPrintSelection}
                    className="w-full rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {lastNutritionPrintSelection
                      ? "Imprimir documento nutricional"
                      : "Imprimir documento nutricional (se habilita al guardar)"}
                  </button>

                  <Field
                    label="Producto entregado"
                    input={
                      <select
                        className={inputClass}
                        value={nutritionDeliveryProductId}
                        onChange={(e) => setNutritionDeliveryProductId(e.target.value)}
                        disabled={!!nutritionSelection.recommendation}
                      >
                        <option value="">Selecciona</option>
                        {inventoryItems
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} Ãƒâ€šÃ‚Â· stock {item.stock}
                            </option>
                          ))}
                      </select>
                    }
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      label="Cantidad"
                      input={
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          value={nutritionDeliveryQuantity}
                          onChange={(e) => setNutritionDeliveryQuantity(e.target.value)}
                          disabled={!!nutritionSelection.recommendation}
                        />
                      }
                    />

                    <div className="rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] px-4 py-4 shadow-inner">
                      <p className="text-sm font-medium text-slate-700">Stock disponible</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {selectedNutritionInventoryItem ? selectedNutritionInventoryItem.stock : "-"}
                      </p>
                    </div>
                  </div>

                  <Field
                    label="Observaciones de entrega"
                    input={
                      <textarea
                        className={`${inputClass} min-h-[110px] resize-none`}
                        value={nutritionDeliveryNotes}
                        onChange={(e) => setNutritionDeliveryNotes(e.target.value)}
                        disabled={!!nutritionSelection.recommendation?.instructions}
                      />
                    }
                  />

                  <button
                    type="button"
                    onClick={registrarEntregaNutricion}
                    disabled={savingNutritionDelivery}
                    className="w-full rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                  >
                    {savingNutritionDelivery ? "Guardando..." : "Registrar entrega y descontar inventario"}
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : activeSection === "impresiones" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Impresiones y entregas</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Busca un cliente para imprimir su cita, sus instrucciones o registrar la entrega de nutracÃƒÆ’Ã‚Â©uticos.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Buscar cliente"
                  input={
                    <input
                      className={inputClass}
                      placeholder="Nombre o telÃƒÂ©fono"
                      value={printSearch}
                      onChange={(e) => setPrintSearch(e.target.value)}
                    />
                  }
                />

                {selectedPrintPatient ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cliente seleccionado
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {selectedPrintPatient.patient_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPrintPatient.phone || "Sin telÃƒÂ©fono"} Ãƒâ€šÃ‚Â· {selectedPrintPatient.city || "Sin ciudad"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPrintPatient.detail}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Fuente: {selectedPrintPatient.source}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    Escribe un nombre o telÃƒÂ©fono para buscar el cliente.
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => imprimirDocumento("cita")}
                    className="rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white"
                  >
                    Imprimir cita
                  </button>

                  <button
                    type="button"
                    onClick={() => imprimirDocumento("instrucciones")}
                    className="rounded-2xl border border-slate-300 px-4 py-4 text-base font-semibold text-slate-700"
                  >
                    Imprimir instrucciones
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Registrar entrega de nutracÃƒÆ’Ã‚Â©uticos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Este registro queda guardado en este equipo mientras conectamos el inventario completo.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Producto"
                      input={
                        <input
                          className={inputClass}
                          placeholder="Ej: Omega 3"
                          value={deliveryProduct}
                          onChange={(e) => setDeliveryProduct(e.target.value)}
                        />
                      }
                    />

                    <Field
                      label="Cantidad"
                      input={
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          value={deliveryQuantity}
                          onChange={(e) => setDeliveryQuantity(e.target.value)}
                        />
                      }
                    />
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Observaciones"
                      input={
                        <textarea
                          className={`${inputClass} min-h-[110px] resize-none`}
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                        />
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={registrarEntregaLocal}
                    className="mt-4 w-full rounded-[22px] bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_38px_rgba(95,125,102,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(95,125,102,0.24)]"
                  >
                    Registrar entrega
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-[#1F3128]">Entregas recientes</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Vista rÃƒÆ’Ã‚Â¡pida de lo entregado desde este dispositivo.
              </p>

              <div className="mt-5 space-y-3">
                {deliveryLogs.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                    AÃƒÆ’Ã‚Âºn no hay entregas registradas.
                  </div>
                ) : (
                  deliveryLogs.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-[#D8E9DD] bg-white/92 p-4 shadow-[0_12px_28px_rgba(95,125,102,0.08)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.patient_name}</p>
                          <p className="mt-1 text-sm text-[#5F7468]">
                            {item.phone || "Sin telÃƒÂ©fono"}
                          </p>
                          <p className="mt-2 text-sm text-[#496356]">
                            <span className="font-medium">Producto:</span> {item.product}
                          </p>
                          <p className="mt-1 text-sm text-[#496356]">
                            <span className="font-medium">Cantidad:</span> {item.quantity}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-sm text-[#496356]">
                              <span className="font-medium">Observaciones:</span> {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full border border-[#D6E8DA] bg-[#F5FBF7] px-3 py-1 text-xs text-[#4D6356]">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : activeSection === "inventario" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(244,251,246,0.96)_100%)] p-6 shadow-[0_24px_52px_rgba(95,125,102,0.14)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#1F3128]">Inventario</h2>
                  <p className="mt-1 text-sm text-[#607368]">
                    Control bÃƒÆ’Ã‚Â¡sico de nutracÃƒÆ’Ã‚Â©uticos, entradas, salidas y alertas de stock.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Producto existente"
                  input={
                    <select
                      className={inputClass}
                      value={inventoryProductId}
                      onChange={(e) => setInventoryProductId(e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {inventoryItems
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} Ãƒâ€šÃ‚Â· stock {item.stock}
                          </option>
                        ))}
                    </select>
                  }
                />

                <Field
                  label="O crear producto nuevo"
                  input={
                    <input
                      className={inputClass}
                      placeholder="Ej: Magnesio quelado"
                      value={inventoryNewProduct}
                      onChange={(e) => setInventoryNewProduct(e.target.value)}
                    />
                  }
                />

                <Field
                  label="CategorÃƒÆ’Ã‚Â­a"
                  input={
                    <input
                      className={inputClass}
                      value={inventoryCategory}
                      onChange={(e) => setInventoryCategory(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Stock mÃƒÆ’Ã‚Â­nimo"
                  input={
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={inventoryMinStock}
                      onChange={(e) => setInventoryMinStock(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Fecha de ingreso / movimiento"
                  input={
                    <input
                      className={inputClass}
                      type="date"
                      value={inventoryMovementDate}
                      onChange={(e) => setInventoryMovementDate(e.target.value)}
                    />
                  }
                />

                <Field
                  label="NÃƒÆ’Ã‚Âºmero de lote"
                  input={
                    <input
                      className={inputClass}
                      placeholder="Ej: LOTE-0426"
                      value={inventoryLotNumber}
                      onChange={(e) => setInventoryLotNumber(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Tipo de movimiento"
                  input={
                    <select
                      className={inputClass}
                      value={inventoryMovementType}
                      onChange={(e) => setInventoryMovementType(e.target.value as "entrada" | "salida" | "ajuste")}
                    >
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                      <option value="ajuste">Ajuste de stock final</option>
                    </select>
                  }
                />

                <Field
                  label={inventoryMovementType === "ajuste" ? "Stock final" : "Cantidad"}
                  input={
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={inventoryQuantity}
                      onChange={(e) => setInventoryQuantity(e.target.value)}
                    />
                  }
                />
              </div>

              <div className="mt-4">
                <Field
                  label="Observaciones"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-none`}
                      value={inventoryMovementNotes}
                      onChange={(e) => setInventoryMovementNotes(e.target.value)}
                    />
                  }
                />
              </div>

              <button
                type="button"
                onClick={registrarMovimientoInventario}
                className="mt-4 w-full rounded-[22px] bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_38px_rgba(95,125,102,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(95,125,102,0.24)]"
              >
                Registrar movimiento
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(244,251,246,0.96)_100%)] p-6 shadow-[0_24px_52px_rgba(95,125,102,0.14)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[#1F3128]">Stock actual</h2>
                    <p className="mt-1 text-sm text-[#607368]">
                      Vista rÃƒÆ’Ã‚Â¡pida del inventario disponible en este dispositivo.
                    </p>
                  </div>

                  <input
                    className="w-full rounded-[22px] border border-[#CFE4D8] bg-white/92 px-4 py-3 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4] md:max-w-xs"
                    placeholder="Buscar producto o categorÃƒÆ’Ã‚Â­a"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {inventoryFilteredItems.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                      AÃƒÆ’Ã‚Âºn no hay productos registrados en el inventario.
                    </div>
                  ) : (
                    inventoryFilteredItems.map((item) => {
                      const inventoryStatus = getInventoryStatus(item);
                      return (
                        <div key={item.id} className="rounded-[24px] border border-[#D8E9DD] bg-white/92 p-4 shadow-[0_12px_28px_rgba(95,125,102,0.08)]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-sm text-[#5F7468]">{item.category}</p>
                              <p className="mt-2 text-sm text-[#496356]">
                                <span className="font-medium">Stock:</span> {item.stock}
                              </p>
                              <p className="mt-1 text-sm text-[#496356]">
                                <span className="font-medium">MÃƒÆ’Ã‚Â­nimo:</span> {item.min_stock}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs ${inventoryStatus.className}`}>
                              {inventoryStatus.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(244,251,246,0.96)_100%)] p-6 shadow-[0_24px_52px_rgba(95,125,102,0.14)]">
                <h2 className="text-2xl font-bold text-[#1F3128]">Movimientos recientes</h2>
                <p className="mt-1 text-sm text-[#607368]">
                  ÃƒÆ’Ã…Â¡ltimos registros de entrada, salida o ajuste.
                </p>

                <div className="mt-5 space-y-3">
                  {inventoryRecentMovements.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                      AÃƒÆ’Ã‚Âºn no hay movimientos registrados.
                    </div>
                  ) : (
                    inventoryRecentMovements.map((item) => (
                      <div key={item.id} className="rounded-[24px] border border-[#D8E9DD] bg-white/92 p-4 shadow-[0_12px_28px_rgba(95,125,102,0.08)]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{item.product_name}</p>
                            <p className="mt-1 text-sm text-[#496356]">
                              <span className="font-medium">Tipo:</span> {item.type}
                            </p>
                            <p className="mt-1 text-sm text-[#496356]">
                              <span className="font-medium">Cantidad:</span> {item.quantity}
                            </p>
                            {item.movement_date ? (
                              <p className="mt-1 text-sm text-[#496356]">
                                <span className="font-medium">Fecha:</span> {item.movement_date}
                              </p>
                            ) : null}
                            {item.lot_number ? (
                              <p className="mt-1 text-sm text-[#496356]">
                                <span className="font-medium">Lote:</span> {item.lot_number}
                              </p>
                            ) : null}
                            {item.notes ? (
                              <p className="mt-1 text-sm text-[#496356]">
                                <span className="font-medium">Observaciones:</span> {item.notes}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full border border-[#D6E8DA] bg-[#F5FBF7] px-3 py-1 text-xs text-[#4D6356]">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
        <section className={`mb-6 grid gap-6 ${isReadOnlyAgendaForCall ? "" : "xl:grid-cols-2"}`}>
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingAppointmentId ? "Reagendar / editar cita" : "Nueva cita"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {leadIdFromUrl
                    ? "Esta cita se estÃƒÆ’Ã‚Â¡ creando desde un lead especÃƒÆ’Ã‚Â­fico."
                    : "Puedes elegir un lead existente o ingresar el cliente manualmente."}
                </p>
                {!isReadOnlyAgendaForCall ? (
                  <p className="mt-2 inline-flex rounded-full border border-[#E3ECE5] bg-[#F8F7F4] px-3 py-1 text-xs font-medium text-[#4F6F5B]">
                    MÃƒÆ’Ã‚Â³dulo activo: {sectionLabel}
                  </p>
                ) : null}
              </div>

              {editingAppointmentId ? (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="rounded-2xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                >
                  Cancelar ediciÃƒÆ’Ã‚Â³n
                </button>
              ) : null}
            </div>

            <form onSubmit={guardarCita} className="mt-5 space-y-4">
              {!leadIdFromUrl ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                    <div className="mb-2 font-medium text-slate-700">{"Modo de creaci\u00F3n"}</div>
                    <select
                      className="w-full outline-none"
                      value={form.mode}
                      onChange={(e) =>
                        {
                          setManualClientLookup("");
                          setForm((prev) => ({
                            ...prev,
                            mode: e.target.value,
                            lead_id: "",
                            patient_name: "",
                            phone: "",
                            city: "",
                            manual_source: "",
                          }));
                        }
                      }
                    >
                      <option value="lead">Desde lead</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>

                  {form.mode === "lead" ? (
                    <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                      <div className="mb-2 font-medium text-slate-700">Buscar lead</div>
                      <input
                        className="w-full outline-none"
                        placeholder={"Nombre o tel\u00E9fono"}
                        value={busquedaLead}
                        onChange={(e) => setBusquedaLead(e.target.value)}
                      />
                    </label>
                  ) : (
                    <>
                      <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                        <div className="mb-2 font-medium text-slate-700">Fuente</div>
                        <select
                          className="w-full outline-none"
                          value={form.manual_source}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, manual_source: e.target.value }))
                          }
                        >
                          <option value="">Selecciona</option>
                          {manualSourceOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                        <div className="mb-2 font-medium text-slate-700">
                          {"Buscar cliente por c\u00E9dula o tel\u00E9fono"}
                        </div>
                        <input
                          className="w-full outline-none"
                          placeholder={"Escribe c\u00E9dula o tel\u00E9fono"}
                          value={manualClientLookup}
                          onChange={(e) => setManualClientLookup(e.target.value)}
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          {loadingManualClientLookup
                            ? "Buscando cliente existente..."
                            : "Si ya existe en el sistema, se cargar\u00E1 autom\u00E1ticamente."}
                        </p>
                      </label>
                    </>
                  )}
                </div>
              ) : null}

              {form.mode === "lead" && !leadIdFromUrl ? (
                <label className="block rounded-2xl border border-slate-300 p-4 text-sm">
                  <div className="mb-2 font-medium text-slate-700">Seleccionar lead</div>
                  <select
                    className="w-full outline-none"
                    value={form.lead_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lead_id: e.target.value }))
                    }
                  >
                    <option value="">Selecciona</option>
                    {leadsFiltrados.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {fullLeadName(lead)}
                        {" \u00B7 "}
                        {lead.phone}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {leadIdFromUrl ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Lead seleccionado
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {form.patient_name || "Cliente"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {form.phone || "Sin tel\u00E9fono"}
                    {" \u00B7 "}
                    {form.city || "Sin ciudad"}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Cliente"
                  input={
                    <input
                      className={inputClass}
                      value={form.patient_name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, patient_name: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label={"Tel\u00E9fono"}
                  input={
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label="Ciudad"
                  input={
                    <input
                      className={inputClass}
                      value={form.city}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, city: e.target.value }))
                      }
                    />
                  }
                />

                {activeSection !== "agenda" ? (
                  <>
                    <Field
                      label={serviceFieldLabel}
                      input={
                        <select
                          className={inputClass}
                          value={form.service_type}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              service_type: e.target.value,
                              specialist_user_id: "",
                            }))
                          }
                        >
                          <option value="">Selecciona</option>
                          {serviceOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      }
                    />

                    <Field
                      label="DuraciÃƒÆ’Ã‚Â³n"
                      input={
                        <select
                          className={inputClass}
                          value={form.duration_minutes}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))
                          }
                          disabled={durationOptions.length === 0}
                        >
                          {durationOptions.length === 0 ? (
                            <option value="">Sin agenda disponible</option>
                          ) : (
                            durationOptions.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))
                          )}
                        </select>
                      }
                    />
                  </>
                ) : null}

                {activeSection === "especialistas" || activeSection === "tratamientos" ? (
                  <Field
                    label="Especialista"
                    input={
                      <select
                        className={inputClass}
                        value={form.specialist_user_id}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            specialist_user_id: e.target.value,
                          }))
                        }
                        disabled={!form.service_type || filteredSpecialists.length === 0}
                      >
                        {!form.service_type ? (
                          <option value="">Primero elige el servicio</option>
                        ) : filteredSpecialists.length === 0 ? (
                          <option value="">Sin especialistas disponibles</option>
                        ) : (
                          <>
                            <option value="">Selecciona</option>
                            {filteredSpecialists.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.full_name} Ãƒâ€šÃ‚Â· {item.role_name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    }
                  />
                ) : null}

                <Field
                  label="Fecha"
                  input={
                    <input
                      className={inputClass}
                      type="date"
                      value={form.appointment_date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, appointment_date: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label="Hora"
                  input={
                    <select
                      className={inputClass}
                      value={form.appointment_time}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, appointment_time: e.target.value }))
                      }
                    >
                      {slotAvailability.map((slot) => (
                        <option
                          key={slot.value}
                          value={slot.value}
                          disabled={slot.disabled}
                        >
                          {formatSlotAvailabilityLabel(slot)}
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>


              <Field
                label="Notas"
                input={
                  <textarea
                    className={`${inputClass} min-h-[110px] resize-none`}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                }
              />

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="submit"
                  disabled={savingAppointment}
                  className="w-full rounded-[22px] bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_18px_38px_rgba(95,125,102,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(95,125,102,0.24)] disabled:translate-y-0 disabled:opacity-60"
                >
                  {savingAppointment
                    ? "Guardando..."
                    : editingAppointmentId
                    ? "Guardar reagendamiento"
                    : "Guardar cita"}
                </button>

                <button
                  type="button"
                  onClick={imprimirCitaActualDesdeFormulario}
                  disabled={!lastSavedAppointmentPrint}
                  className="w-full rounded-[22px] border border-[#CFE4D8] bg-white/88 px-4 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {lastSavedAppointmentPrint
                    ? "Imprimir cita guardada"
                    : "Imprimir cita (se habilita al guardar)"}
                </button>
              </div>
            </form>
          </div>

          {!isReadOnlyAgendaForCall && !isEmbeddedCommercialCreationView && (
            <div
              className="rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(244,251,246,0.96)_100%)] p-6 shadow-[0_24px_52px_rgba(95,125,102,0.14)]"
              title={normalizedAgendaVisibleDescription}
            >
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="hidden text-2xl font-bold text-[#1F3128]">
                    {agendaVisibleTitle.replace("dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a", "dÃƒÆ’Ã‚Â­a")}
                  </h2>
                  <h2 className="text-2xl font-bold text-[#1F3128]">{normalizedAgendaVisibleTitle}</h2>
                  <p className="mt-1 text-sm text-[#607368]">{normalizedAgendaVisibleDescription}</p>
                  <p className="hidden mt-1 text-sm text-[#607368]">
                    {`Vista de ${sectionLabel.toLowerCase()} por nombre, telÃƒÂ©fono y fecha.`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAgendaViewMode("dia")}
                      className={`relative rounded-2xl px-4 py-2.5 text-[0px] font-medium text-transparent shadow-sm transition ${
                        agendaViewMode === "dia"
                          ? "bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] text-white"
                          : "border border-[#CFE4D8] bg-white/85 text-[#4F6F5B] hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                      }`}
                    >
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
                        {"D\u00EDa"}
                      </span>
                      DÃƒÂ­a
                    </button>
                    {canShowWeeklyAgenda ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setAgendaViewMode("semana")}
                          className={`rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                            agendaViewMode === "semana"
                              ? "bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] text-white"
                              : "border border-[#CFE4D8] bg-white/85 text-[#4F6F5B] hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                          }`}
                        >
                          Semana
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgendaViewMode("mes")}
                          className={`rounded-2xl px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                            agendaViewMode === "mes"
                              ? "bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] text-white"
                              : "border border-[#CFE4D8] bg-white/85 text-[#4F6F5B] hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                          }`}
                        >
                          Mes
                        </button>
                      </>
                    ) : null}
                  </div>
                  <button
                    onClick={cargarTodo}
                    className="rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2.5 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                <input
                  className="w-full rounded-[22px] border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="date"
                  value={fechaFiltro}
                  onChange={(e) => setFechaFiltro(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setFechaFiltro(hoyISO())}
                  className="rounded-[22px] border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                >
                  Hoy
                </button>
                <input
                  className="rounded-[22px] border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="text"
                  placeholder="Buscar por nombre o telÃƒÂ©fono"
                  value={busquedaAgenda}
                  onChange={(e) => setBusquedaAgenda(e.target.value)}
                />
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-2">
                {agendaViewMode !== "dia" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => moveAgendaPeriod(-1)}
                      className="rounded-[18px] border border-[#CFE4D8] bg-white/88 px-3 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:bg-[#F5FCF7]"
                    >
                      {agendaViewMode === "mes" ? "Mes anterior" : "Semana anterior"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFechaFiltro(hoyISO())}
                      className="rounded-[18px] border border-[#CFE4D8] bg-white/88 px-3 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:bg-[#F5FCF7]"
                    >
                      {agendaViewMode === "mes" ? "Mes actual" : "Semana actual"}
                    </button>
                    <button
                      type="button"
                      onClick={() => moveAgendaPeriod(1)}
                      className="rounded-[18px] border border-[#CFE4D8] bg-white/88 px-3 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:bg-[#F5FCF7]"
                    >
                      {agendaViewMode === "mes" ? "Mes siguiente" : "Semana siguiente"}
                    </button>
                  </>
                ) : (
                  <div className="rounded-[18px] border border-[#CFE4D8] bg-white/88 px-3 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm">
                    DÃƒÂ­a seleccionado: {agendaPeriodLabel}
                  </div>
                )}
              </div>

              {agendaViewMode === "semana" && canShowWeeklyAgenda ? (
              <div className="mb-6 rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(180deg,_rgba(248,252,249,0.98)_0%,_rgba(240,248,242,0.98)_100%)] p-4 shadow-inner">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#24312A]">{weeklyAgendaTitle}</h3>
                    <p className="mt-1 text-sm text-[#607368]">
                      Semana organizada desde {formatWeekdayShort(weeklyAgendaDates[0])} hasta{" "}
                      {formatWeekdayShort(weeklyAgendaDates[weeklyAgendaDates.length - 1])}.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-7">
                  {weeklyAgendaDates.map((date) => {
                    const items = weeklyAgendaByDate.get(date) || [];
                    return (
                      <div
                        key={date}
                        className={`rounded-[22px] border p-4 ${
                          date === hoyISO()
                            ? "border-[#9BC4AF] bg-white shadow-sm"
                            : "border-[#E1ECE4] bg-white/82"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#24312A]">
                            {formatWeekdayShort(date)}
                          </p>
                          <span className="rounded-full bg-[#EEF7F1] px-2.5 py-1 text-xs font-semibold text-[#4F6F5B]">
                            {items.length}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-3 text-xs text-[#607368]">
                              Sin citas
                            </div>
                          ) : (
                            items.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => seleccionarCitaRapida(item)}
                                className="w-full rounded-2xl border border-[#DCEBE1] bg-[#FCFEFC] p-3 text-left transition hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                              >
                                <p className="text-xs font-semibold text-[#4F6F5B]">
                                  {formatHora(item.appointment_time)}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-[#24312A]">
                                  {item.patient_name}
                                </p>
                                <p className="mt-1 text-xs text-[#607368]">
                                  {item.service_type || "Sin servicio"}
                                </p>
                                {item.specialist_user_id ? (
                                  <p className="mt-1 text-xs text-[#607368]">
                                    {specialistNameById.get(item.specialist_user_id) || "Sin asignar"}
                                  </p>
                                ) : null}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : agendaViewMode === "mes" && canShowWeeklyAgenda ? (
              <div className="mb-6 rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(180deg,_rgba(248,252,249,0.98)_0%,_rgba(240,248,242,0.98)_100%)] p-4 shadow-inner">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[#24312A]">Calendario mensual</h3>
                  <p className="mt-1 text-sm text-[#607368]">
                    Vista completa del mes para ubicar carga operativa y espacios disponibles.
                  </p>
                </div>

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[980px]">
                    <div className="mb-3 grid grid-cols-7 gap-3">
                      {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((day) => (
                        <div
                          key={day}
                          className="rounded-2xl bg-[#EEF7F1] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[#4F6F5B]"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-3">
                      {monthlyAgendaDates.map((date) => {
                        const items = monthlyAgendaByDate.get(date) || [];
                        return (
                          <div
                            key={date}
                            className={`min-h-[190px] rounded-[24px] border p-3 ${
                              date === fechaFiltro
                                ? "border-[#7FA287] bg-white shadow-[0_18px_36px_rgba(95,125,102,0.14)]"
                                : isSameMonthISO(date, fechaFiltro)
                                ? "border-[#DCEBE1] bg-white/90"
                                : "border-[#E7EFE9] bg-[#F7FAF8]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setFechaFiltro(date)}
                              className="flex w-full items-center justify-between gap-2 text-left"
                            >
                              <p
                                className={`text-sm font-semibold ${
                                  isSameMonthISO(date, fechaFiltro)
                                    ? "text-[#24312A]"
                                    : "text-[#8A998F]"
                                }`}
                              >
                                {date.slice(8, 10)}
                              </p>
                              <span className="rounded-full bg-[#EEF7F1] px-2.5 py-1 text-xs font-semibold text-[#4F6F5B]">
                                {items.length}
                              </span>
                            </button>

                            <div className="mt-3 space-y-2">
                              {items.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8FCF9] p-3 text-xs text-[#607368]">
                                  Libre
                                </div>
                              ) : (
                                items.slice(0, 3).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => seleccionarCitaRapida(item)}
                                    className="w-full rounded-2xl border border-[#DCEBE1] bg-[#FCFEFC] p-3 text-left transition hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                                  >
                                    <p className="text-xs font-semibold text-[#4F6F5B]">
                                      {formatHora(item.appointment_time)}
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-[#24312A]">
                                      {item.patient_name}
                                    </p>
                                    <p className="mt-1 text-xs text-[#607368]">
                                      {item.service_type || "Sin servicio"}
                                    </p>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              ) : null}

              {loading ? (
                <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                  Cargando citas...
                </div>
              ) : agendaFiltrada.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                  No hay citas con esos filtros.
                </div>
              ) : (
                <div className="space-y-4">
                  {agendaFiltrada.map((item) => {
                    const isSelected = selectedQuickAppointmentId === item.id;
                    const hasCommercialRecord = commercialCases.some(
                      (caseItem) => caseItem.appointment_id === item.id
                    );
                    return (
                    <div
                      key={item.id}
                      onDoubleClick={() => abrirIngresoComercialDesdeCita(item)}
                      className={`rounded-[28px] border p-5 shadow-[0_14px_32px_rgba(95,125,102,0.1)] transition duration-200 ${
                            isSelected
                              ? "border-[#7FA287] bg-[linear-gradient(135deg,_rgba(245,252,247,0.98)_0%,_rgba(230,243,233,0.95)_100%)] shadow-[0_20px_44px_rgba(95,125,102,0.18)]"
                              : "border-[#D6E8DA] bg-white/94 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-[0_18px_38px_rgba(95,125,102,0.14)]"
                          }`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {item.patient_name}
                              </h3>

                              <span
                                className={`rounded-full px-3 py-1 text-xs ${badgeEstado(
                                  item.status
                                )}`}
                              >
                                {traducirEstado(item.status)}
                              </span>

                              <span className="rounded-full border border-[#D6E8DA] bg-[#F5FBF7] px-3 py-1 text-xs text-[#4D6356]">
                                {item.appointment_date}
                              </span>

                              <span className="rounded-full border border-[#D6E8DA] bg-[#F5FBF7] px-3 py-1 text-xs text-[#4D6356]">
                                {formatHora(item.appointment_time)}
                              </span>

                              {isSelected ? (
                                <span className="rounded-full bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-3 py-1 text-xs text-white shadow-sm">
                                  Seleccionada
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 text-sm text-[#5F7468]">
                              {item.phone || "Sin telÃƒÂ©fono"} Ãƒâ€šÃ‚Â· {item.city || "Sin ciudad"}
                            </p>

                            <p className="mt-1 text-sm text-[#5F7468]">
                              Fuente: {item.lead_id ? "Lead existente" : traducirFuenteManual(extraerFuenteManualDesdeNotas(item.notes))}
                            </p>

                            <p className="mt-1 text-sm text-[#5F7468]">
                              {getServiceFieldLabel(getSectionForService(item.service_type))}: {item.service_type || "Sin dato"}
                            </p>

                            {item.specialist_user_id ? (
                              <p className="mt-1 text-sm text-[#5F7468]">
                                Profesional:{" "}
                                {specialistNameById.get(item.specialist_user_id) || "Sin asignar"}
                              </p>
                            ) : null}

                            {item.notes ? (
                              <p className="mt-2 text-sm text-[#5F7468]">
                                <span className="font-medium text-[#2E4638]">Notas:</span>{" "}
                                {limpiarFuenteManualDeNotas(item.notes)}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirIngresoComercialDesdeCita(item)}
                              className="rounded-[20px] bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(95,125,102,0.2)]"
                            >
                              Registro comercial
                            </button>

                            {!hasCommercialRecord ? (
                              <button
                                type="button"
                                onClick={() => actualizarEstadoCita(item.id, "no_asistio")}
                                disabled={savingStatusId === item.id}
                                className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                              >
                                No asistiÃƒÆ’Ã‚Â³
                              </button>
                            ) : (
                              <span className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                                Ya registrada en comercial
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => cargarCitaParaEditar(item)}
                              className="rounded-[20px] border border-[#CFE4D8] bg-white/85 px-4 py-2.5 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#A9CCB5] hover:bg-[#F5FCF7]"
                            >
                              Reagendar
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-[#D8E9DD] bg-[linear-gradient(180deg,_rgba(248,252,249,0.98)_0%,_rgba(240,248,242,0.98)_100%)] p-4">
                          <p className="mb-3 text-sm font-medium text-[#496356]">
                            Estado de la cita
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-[22px] border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                              value={statusById[item.id] || item.status}
                              onChange={(e) =>
                                setStatusById((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                            >
                              {appointmentStatusOptions
                                .filter((status) => !(hasCommercialRecord && status.value === "no_asistio"))
                                .map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => guardarEstado(item.id)}
                              disabled={savingStatusId === item.id}
                              className="rounded-[22px] border border-[#A9CCB5] bg-white/90 px-5 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F5FCF7] disabled:translate-y-0 disabled:opacity-60"
                            >
                              {savingStatusId === item.id
                                ? "Guardando..."
                                : "Guardar estado"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}                </div>
              )}
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}

export default function RecepcionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#F1FBF5_0%,_#FAFCF9_48%,_#FFFDF9_100%)] p-6 md:p-8">
          <div className="mx-auto max-w-7xl rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
            <p className="text-sm font-medium text-[#607368]">Cargando recepciÃƒÆ’Ã‚Â³n...</p>
          </div>
        </main>
      }
    >
      <RecepcionContent />
    </Suspense>
  );
}


const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-4 text-base text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";


