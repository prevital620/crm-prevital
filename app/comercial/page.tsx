"use client";

import Image from "next/image";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import StatCard from "@/components/ui/StatCard";
import Field from "@/components/ui/Field";
import InfoItem from "@/components/ui/InfoItem";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  getLeadSourceLabel,
  normalizeCommercialCaseLeadSource,
} from "@/lib/lead-source";
import printPlanInstructions from "@/lib/print/templates/printPlanInstructions";
import { hoyISO, dateToLocalISO, isSameLocalDay } from "@/lib/datetime/dateHelpers";
import { formatDate, formatDateOnly } from "@/lib/datetime/dateFormat";
import { traducirEstadoComercial, commercialStatusClass } from "@/lib/status/commercialStatus";
import { getSectionForService } from "@/lib/agenda/agendaSections";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_CAPACITY,
  getDurationOptions,
} from "@/lib/agenda/agendaDurations";
import {
  buildSlotAvailability,
  formatSlotAvailabilityLabel,
} from "@/lib/agenda/agendaAvailability";
import {
  buildCommercialFollowUpMetadata,
  CommercialFollowUpDraft,
  createEmptyCommercialFollowUp,
  parseCommercialFollowUpFromAppointment,
} from "@/lib/commercial/followUps";
import {
  CommercialTeamKey,
  inferCommercialTeam,
  inferCommercialTeamFromDate,
} from "@/lib/commercial/team";
import {
  buildStoredCommercialNotes,
  parseStoredCommercialNotes,
} from "@/lib/commercial/notes";

type CommercialCase = {
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
  sales_assessment: string | null;
  proposal_text: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  payment_method: string | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  volume_amount: number | null;
  closing_notes: string | null;
  closed_by_user_id: string | null;
  closed_at: string | null;
  next_step_type: string | null;
  next_appointment_date: string | null;
  next_appointment_time: string | null;
  next_specialist_user_id: string | null;
  next_notes: string | null;
  next_appointment_created: boolean;
  next_appointment_id: string | null;
  sale_origin_type: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  call_contact_result: string | null;
  call_user_id: string | null;
  opc_user_id: string | null;
  is_credit_payment: boolean | null;
  credit_provider: string | null;
  credit_discount_amount: number | null;
  admin_discount_amount: number | null;
  net_commission_base: number | null;
  counts_for_commission: boolean | null;
  counts_for_commercial_bonus: boolean | null;
  gross_bonus_base: number | null;
  created_at: string;
};

type SpecialistOption = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};

type ProfileOption = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
  job_title: string | null;
  departments: { name: string | null }[] | null;
  team_key: CommercialTeamKey | null;
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

type LeadInheritance = {
  id: string;
  created_by_user_id: string | null;
  assigned_to_user_id: string | null;
  source: string | null;
  status: string | null;
  commission_source_type: string | null;
};

type AppointmentLookupRow = {
  service_type: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  specialist_user_id: string | null;
  notes: string | null;
  instructions_text: string | null;
};

type AppointmentScheduleRow = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
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

const allowedRoles = [
  "super_user",
  "comercial",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

const managementRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

const purchasedServiceOptions = [
  { value: "", label: "Selecciona" },
  { value: "valoracion", label: "Valoración" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutrición" },
  { value: "medico", label: "Médico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "tratamiento_integral", label: "Tratamiento integral" },
];

const paymentMethodOptions = [
  { value: "", label: "Selecciona" },
  { value: "contado", label: "Contado" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto" },
  { value: "cartera", label: "Cartera" },
];

const nextStepOptions = [
  { value: "", label: "Sin continuidad todavía" },
  { value: "nutricion", label: "Nutrición" },
  { value: "medico", label: "Médico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
];

const activeCommercialStatuses = [
  "asignado_comercial",
  "en_atencion_comercial",
] as const;

function esVentaReal(item: CommercialCase) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0) ||
    (item.volume_amount && Number(item.volume_amount) > 0)
  );
}


function serviceLabel(value: string) {
  const found = purchasedServiceOptions.find((item) => item.value === value);
  return found?.label || value || "Sin definir";
}

function paymentMethodLabel(value: string) {
  const found = paymentMethodOptions.find((item) => item.value === value);
  return found?.label || value || "Sin definir";
}

function nextStepLabel(value: string) {
  const found = nextStepOptions.find((item) => item.value === value);
  return found?.label || value || "No definida";
}

function leadSourceLabel(value: string | null | undefined) {
  return getLeadSourceLabel(value, "Sin definir");
}

function commissionSourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function saleOriginLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    lead: "Lead",
    directo: "Directo",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function callContactResultLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_contacto: "Pendiente de contacto",
    interesado: "Interesado",
    no_responde: "No responde",
    contactado: "Contactado",
    agendado: "Agendado",
    dato_falso: "Dato falso",
    no_interesa: "No interesa",
    no_asistio: "No asistió",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function ahoraHora() {
  const now = new Date();
  return now.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function normalizeMoneyString(value: string) {
  return value.replace(/[^\d]/g, "");
}

function numberFromString(value: string) {
  const raw = normalizeMoneyString(value);
  if (!raw) return 0;
  return Number(raw);
}

function formatMoneyDisplay(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : numberFromString(value || "");
  if (!numeric) return "";
  return numeric.toLocaleString("es-CO");
}

function isOutcomeCode(value: string | null | undefined) {
  return ["ganada", "perdida", "pendiente"].includes(value || "");
}

function getReceptionSummary(item: CommercialCase) {
  const source =
    item.sale_result && !isOutcomeCode(item.sale_result)
      ? item.sale_result
      : parseStoredCommercialNotes(item.commercial_notes).receptionSummary;

  if (!source) return [];
  return source
    .split("|")
    .map((part) => part.trim())
    .map((part) => part.replace(/\s+/g, " "))
    .filter(Boolean);
}

function parsePortfolioDetails(text: string | null | undefined): PortfolioFields {
  const source = text || "";
  const installments = source.match(/Número de cuotas:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const installmentValue = source.match(/Valor de la cuota:\s*([^\n]+)/i)?.[1]?.trim() || "";
  const firstDate = source.match(/Fecha primera cuota:\s*([^\n]+)/i)?.[1]?.trim() || "";

  return {
    installments_count: installments,
    installment_value: installmentValue,
    first_installment_date: firstDate,
  };
}

function stripPortfolioDetails(text: string | null | undefined) {
  const source = text || "";
  const lines = source
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        !/^Detalle cartera:/i.test(line) &&
        !/^Número de cuotas:/i.test(line) &&
        !/^Valor de la cuota:/i.test(line) &&
        !/^Fecha primera cuota:/i.test(line) &&
        !/^Plan de cuotas:/i.test(line) &&
        !/^\d+\.\s*\d{4}-\d{2}-\d{2}\s*·\s*\$/i.test(line)
    );

  return lines.join("\n").trim();
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

function buildDurationNote(durationMinutes: number) {
  return `Duración: ${durationMinutes} min`;
}

function buildClosingNotes(
  baseText: string,
  portfolio: PortfolioFields,
  portfolioAmount: number,
  autoInstallmentValue: number,
  installmentPlan: InstallmentPlanItem[]
) {
  const lines = [stripPortfolioDetails(baseText)].filter(Boolean);

  if (portfolioAmount > 0) {
    lines.push("Detalle cartera:");
    if (portfolio.installments_count) {
      lines.push(`Número de cuotas: ${portfolio.installments_count}`);
    }
    if (autoInstallmentValue > 0) {
      lines.push(`Valor de la cuota: ${autoInstallmentValue.toLocaleString("es-CO")}`);
    }
    if (portfolio.first_installment_date) {
      lines.push(`Fecha primera cuota: ${portfolio.first_installment_date}`);
    }
    if (installmentPlan.length > 0) {
      lines.push("Plan de cuotas:");
      installmentPlan.forEach((item) => {
        lines.push(
          `${item.number}. ${item.date} · $${item.value.toLocaleString("es-CO")}`
        );
      });
    }
  }

  return lines.join("\n").trim() || null;
}

function inferSaleOriginType(caseItem: CommercialCase) {
  if (caseItem.commission_source_type === "base") return "lead";
  if (caseItem.lead_id) return "lead";
  return "directo";
}

function inferCaseTeamKey(
  item: Pick<CommercialCase, "assigned_commercial_user_id" | "assigned_by_user_id" | "assigned_at" | "created_at">,
  profileMap: Map<string, ProfileOption>
) {
  const assignedTeam = item.assigned_commercial_user_id
    ? profileMap.get(item.assigned_commercial_user_id)?.team_key || null
    : null;

  if (assignedTeam) return assignedTeam;

  const managerTeam = item.assigned_by_user_id
    ? profileMap.get(item.assigned_by_user_id)?.team_key || null
    : null;

  if (managerTeam) return managerTeam;

  return inferCommercialTeamFromDate(item.assigned_at || item.created_at);
}

function getPrimaryFollowUp(
  form: {
    next_step_type: string;
    next_appointment_date: string;
    next_appointment_time: string;
    next_specialist_user_id: string;
    next_notes: string;
  },
  extraFollowUps: CommercialFollowUpDraft[]
) {
  const items: CommercialFollowUpDraft[] = [];

  if (form.next_step_type) {
    items.push({
      service_type: form.next_step_type,
      appointment_date: form.next_appointment_date,
      appointment_time: form.next_appointment_time,
      specialist_user_id: form.next_specialist_user_id,
      notes: form.next_notes,
    });
  }

  extraFollowUps.forEach((item) => {
    const hasAnyValue =
      !!item.service_type ||
      !!item.appointment_date ||
      !!item.appointment_time ||
      !!item.specialist_user_id ||
      !!item.notes.trim();

    if (!hasAnyValue) return;
    items.push(item);
  });

  return items;
}

export default function ComercialPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestedCaseId, setRequestedCaseId] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [currentTeamKey, setCurrentTeamKey] = useState<CommercialTeamKey | null>(null);

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [appointments, setAppointments] = useState<AppointmentScheduleRow[]>([]);
  const [agendaDaySettings, setAgendaDaySettings] = useState<Record<string, AgendaDaySetting>>({});
  const [agendaSlotSettings, setAgendaSlotSettings] = useState<Record<string, AgendaSlotSetting>>({});
  const [nextAppointments, setNextAppointments] = useState<CommercialFollowUpDraft[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  const [newClientForm, setNewClientForm] = useState({
    customer_name: "",
    phone: "",
    city: "",
  });

  const [form, setForm] = useState({
    status: "en_atencion_comercial",
    commercial_notes: "",
    sales_assessment: "",
    proposal_text: "",
    purchased_service: "",
    payment_method: "",
    cash_amount: "",
    portfolio_amount: "",
    volume_amount: "",
    closing_notes: "",
    next_step_type: "",
    next_appointment_date: hoyISO(),
    next_appointment_time: ahoraHora(),
    next_specialist_user_id: "",
    next_notes: "",
  });

  const [portfolioForm, setPortfolioForm] = useState<PortfolioFields>({
    installments_count: "",
    installment_value: "",
    first_installment_date: "",
  });

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const currentCase = useMemo(
    () => cases.find((item) => item.id === editingCaseId) || null,
    [cases, editingCaseId]
  );

  const currentReceptionSummary = useMemo(
    () => (currentCase ? getReceptionSummary(currentCase) : []),
    [currentCase]
  );

  const todayIso = useMemo(() => hoyISO(), []);

  const currentCaseCommissionSummary = useMemo(() => {
    if (!currentCase) return null;

    return {
      origenVenta: currentCase.sale_origin_type || inferSaleOriginType(currentCase),
      origenLead: currentCase.lead_source_type || null,
      fuenteComision: currentCase.commission_source_type || null,
      resultadoCall: currentCase.call_contact_result || null,
      descuentoCredito: Number(currentCase.credit_discount_amount || 0),
      descuentoAdmin: Number(currentCase.admin_discount_amount || 0),
      baseNeta: Number(currentCase.net_commission_base || 0),
      proveedorCredito: currentCase.credit_provider || null,
    };
  }, [currentCase]);

  const calculatedVolume = useMemo(() => numberFromString(form.volume_amount), [form.volume_amount]);
  const calculatedCash = useMemo(() => numberFromString(form.cash_amount), [form.cash_amount]);
  const calculatedPortfolio = useMemo(
    () => Math.max(0, calculatedVolume - calculatedCash),
    [calculatedCash, calculatedVolume]
  );

  const installmentsCountNumber = useMemo(
    () => Number(portfolioForm.installments_count || "0"),
    [portfolioForm.installments_count]
  );

  const automaticInstallmentValue = useMemo(() => {
    if (!calculatedPortfolio || !installmentsCountNumber) return 0;
    return Math.round(calculatedPortfolio / installmentsCountNumber);
  }, [calculatedPortfolio, installmentsCountNumber]);

  const installmentPlan = useMemo(
    () =>
      buildInstallmentPlan(
        portfolioForm.first_installment_date,
        installmentsCountNumber,
        automaticInstallmentValue
      ),
    [portfolioForm.first_installment_date, installmentsCountNumber, automaticInstallmentValue]
  );

  const canPrintPlan = useMemo(() => {
    return !!(currentCase && (form.purchased_service || calculatedVolume > 0));
  }, [currentCase, form.purchased_service, calculatedVolume]);

  const allFollowUpDrafts = useMemo(
    () => getPrimaryFollowUp(form, nextAppointments),
    [form, nextAppointments]
  );

  const primaryFollowUpAvailability = useMemo(
    () =>
      getFollowUpSlotAvailability(
        {
          service_type: form.next_step_type,
          appointment_date: form.next_appointment_date,
          appointment_time: form.next_appointment_time,
          specialist_user_id: form.next_specialist_user_id,
          notes: form.next_notes,
        },
        0,
        allFollowUpDrafts
      ),
    [
      agendaDaySettings,
      agendaSlotSettings,
      allFollowUpDrafts,
      appointments,
      form.next_appointment_date,
      form.next_appointment_time,
      form.next_notes,
      form.next_specialist_user_id,
      form.next_step_type,
    ]
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      portfolio_amount: calculatedPortfolio ? String(calculatedPortfolio) : "",
    }));
  }, [calculatedPortfolio]);

  useEffect(() => {
    setPortfolioForm((prev) => ({
      ...prev,
      installment_value: automaticInstallmentValue ? String(automaticInstallmentValue) : "",
    }));
  }, [automaticInstallmentValue]);

  useEffect(() => {
    if (!form.next_step_type) return;

    const availableSlots = primaryFollowUpAvailability.filter((slot) => !slot.disabled);
    const stillValid = availableSlots.some((slot) => slot.value === form.next_appointment_time);

    if (stillValid) return;

    setForm((prev) => ({
      ...prev,
      next_appointment_time: availableSlots[0]?.value || "",
    }));
  }, [
    form.next_appointment_time,
    form.next_step_type,
    primaryFollowUpAvailability,
  ]);

  useEffect(() => {
    if (nextAppointments.length === 0) return;

    let changed = false;
    const allDrafts = getPrimaryFollowUp(form, nextAppointments);

    const normalized = nextAppointments.map((item, index) => {
      if (!item.service_type) return item;

      const availability = getFollowUpSlotAvailability(item, index + 1, allDrafts);
      const availableSlots = availability.filter((slot) => !slot.disabled);
      const stillValid = availableSlots.some((slot) => slot.value === item.appointment_time);

      if (stillValid) return item;

      changed = true;
      return {
        ...item,
        appointment_time: availableSlots[0]?.value || "",
      };
    });

    if (changed) {
      setNextAppointments(normalized);
    }
  }, [
    agendaDaySettings,
    agendaSlotSettings,
    appointments,
    form,
    nextAppointments,
  ]);

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a este módulo.");
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

  async function cargarDatos() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const [casesResult, profilesResult, appointmentsResult, daySettingsResult, slotSettingsResult] =
        await Promise.all([
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
            commercial_notes,
            sales_assessment,
            proposal_text,
            sale_result,
            purchased_service,
            sale_value,
            payment_method,
            cash_amount,
            portfolio_amount,
            volume_amount,
            closing_notes,
            closed_by_user_id,
            closed_at,
            next_step_type,
            next_appointment_date,
            next_appointment_time,
            next_specialist_user_id,
            next_notes,
            next_appointment_created,
            next_appointment_id,
            sale_origin_type,
            lead_source_type,
            commission_source_type,
            call_contact_result,
            call_user_id,
            opc_user_id,
            is_credit_payment,
            credit_provider,
            credit_discount_amount,
            admin_discount_amount,
            net_commission_base,
            counts_for_commission,
            counts_for_commercial_bonus,
            gross_bonus_base,
            created_at
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            job_title,
            departments (
              name
            ),
            user_roles!user_roles_user_id_fkey (
              roles (
                name,
                code
              )
            )
          `),
        supabase
          .from("appointments")
          .select("id, appointment_date, appointment_time, status, service_type, notes"),
        supabase
          .from("agenda_day_settings")
          .select("agenda_date, daily_capacity, is_closed"),
        supabase
          .from("agenda_slot_settings")
          .select("agenda_date, slot_time, capacity, is_blocked"),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;
      if (daySettingsResult.error) throw daySettingsResult.error;
      if (slotSettingsResult.error) throw slotSettingsResult.error;

      let casesData = (casesResult.data as CommercialCase[]) || [];
      const profileRows = (profilesResult.data as any[]) || [];

      const isManagementView = currentRoleCode
        ? managementRoles.includes(currentRoleCode)
        : false;

      const profiles: ProfileOption[] = profileRows
        .map((row) => {
          const role = row.user_roles?.[0]?.roles;
          return {
            id: row.id,
            full_name: row.full_name || "Sin nombre",
            role_name: role?.name || "",
            role_code: role?.code || "",
            job_title: row.job_title || null,
            departments: Array.isArray(row.departments) ? row.departments : [],
            team_key: inferCommercialTeam({
              job_title: row.job_title || null,
              departments: Array.isArray(row.departments) ? row.departments : [],
            }),
          };
        })
        .filter((item) => item.role_code);

      const profileMap = new Map<string, ProfileOption>();
      profiles.forEach((item) => {
        profileMap.set(item.id, item);
      });

      const currentProfile = currentUserId ? profileMap.get(currentUserId) || null : null;
      const detectedTeam = currentRoleCode === "super_user" ? null : currentProfile?.team_key || null;
      setCurrentTeamKey(detectedTeam);

      if (!isManagementView && currentUserId) {
        casesData = casesData.filter(
          (item) => item.assigned_commercial_user_id === currentUserId
        );
      } else if (isManagementView && currentRoleCode !== "super_user") {
        casesData = casesData.filter((item) => {
          const caseTeam = inferCaseTeamKey(item, profileMap);

          if (detectedTeam) {
            return caseTeam === detectedTeam;
          }

          return (
            item.assigned_by_user_id === currentUserId ||
            item.assigned_commercial_user_id === currentUserId
          );
        });
      }

      const specialistList: SpecialistOption[] = profiles
        .filter((item) =>
          ["nutricionista", "medico_general", "fisioterapeuta"].includes(item.role_code)
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      const appointmentRows = ((appointmentsResult.data as AppointmentScheduleRow[]) || []).map(
        (item) => ({
          ...item,
          appointment_time: item.appointment_time.slice(0, 5),
        })
      );

      const daySettingsMap: Record<string, AgendaDaySetting> = {};
      ((daySettingsResult.data as AgendaDaySetting[]) || []).forEach((item) => {
        daySettingsMap[item.agenda_date] = item;
      });

      const slotSettingsMap: Record<string, AgendaSlotSetting> = {};
      ((slotSettingsResult.data as AgendaSlotSetting[]) || []).forEach((item) => {
        slotSettingsMap[`${item.agenda_date}_${item.slot_time.slice(0, 5)}`] = {
          ...item,
          slot_time: item.slot_time.slice(0, 5),
        };
      });

      setCases(casesData);
      setSpecialists(specialistList);
      setAppointments(appointmentRows);
      setAgendaDaySettings(daySettingsMap);
      setAgendaSlotSettings(slotSettingsMap);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los casos comerciales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      void cargarDatos();
    }
  }, [authorized, currentRoleCode, currentUserId]);

  const dayCases = useMemo(() => {
    return cases.filter((item) => isSameLocalDay(item.assigned_at, todayIso));
  }, [cases, todayIso]);

  const activeDayCases = useMemo(() => {
    return dayCases.filter((item) => activeCommercialStatuses.includes(item.status as any));
  }, [dayCases]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return activeDayCases.filter((item) => {
      const searchOk = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q)
        : true;

      const statusOk = statusFilter ? item.status === statusFilter : true;

      return searchOk && statusOk;
    });
  }, [activeDayCases, search, statusFilter]);

  const resumen = useMemo(() => {
    return {
      asignadosHoy: dayCases.length,
      activosHoy: activeDayCases.length,
      asistieronHoy: dayCases.filter((x) =>
        ["en_atencion_comercial", "seguimiento_comercial", "finalizado"].includes(x.status)
      ).length,
      vendidosHoy: dayCases.filter((x) => x.status === "finalizado" && esVentaReal(x)).length,
      seguimientoHoy: dayCases.filter((x) => x.status === "seguimiento_comercial").length,
      noVendidosHoy: dayCases.filter((x) => x.status === "finalizado" && !esVentaReal(x)).length,
      citasHoy: dayCases.filter((x) => x.next_appointment_created).length,
    };
  }, [dayCases, activeDayCases]);

  useEffect(() => {
    if (!editingCaseId) return;
    const exists = filteredCases.some((item) => item.id === editingCaseId);
    if (!exists) {
      resetForm();
    }
  }, [filteredCases, editingCaseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRequestedCaseId(params.get("caseId"));
  }, []);

  useEffect(() => {
    if (!requestedCaseId || !cases.length) return;
    if (editingCaseId === requestedCaseId) return;

    const found = cases.find((item) => item.id === requestedCaseId);
    if (found) {
      void iniciarAtencion(found);
    }
  }, [requestedCaseId, cases, editingCaseId]);

  function actualizarCitaAdicional(
    index: number,
    field: keyof CommercialFollowUpDraft,
    value: string
  ) {
    setNextAppointments((prev) =>
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
    setNextAppointments((prev) => [
      ...prev,
      createEmptyCommercialFollowUp(hoyISO(), ahoraHora()),
    ]);
  }

  function eliminarCitaAdicional(index: number) {
    setNextAppointments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function getFollowUpDuration(serviceType: string, appointmentDate: string) {
    const section = getSectionForService(serviceType);
    const durationOptions = getDurationOptions(section, serviceType, appointmentDate);
    const firstDuration = durationOptions[0]?.value;
    return Number(firstDuration || "30");
  }

  function getAllFollowUpDraftsSnapshot() {
    return getPrimaryFollowUp(form, nextAppointments);
  }

  function buildDraftAppointmentsForAvailability(
    drafts: CommercialFollowUpDraft[],
    skipIndex: number
  ) {
    return drafts.flatMap((item, index) => {
      if (index === skipIndex) return [];
      if (!item.service_type || !item.appointment_date || !item.appointment_time) return [];

      return [
        {
          id: `draft-${index}`,
          appointment_date: item.appointment_date,
          appointment_time: item.appointment_time,
          status: "agendada",
          service_type: item.service_type,
          notes: buildDurationNote(getFollowUpDuration(item.service_type, item.appointment_date)),
        } satisfies AppointmentScheduleRow,
      ];
    });
  }

  function getFollowUpSlotAvailability(
    draft: CommercialFollowUpDraft,
    draftIndex: number,
    drafts: CommercialFollowUpDraft[]
  ) {
    if (!draft.service_type || !draft.appointment_date) return [];

    const section = getSectionForService(draft.service_type);
    const durationMinutes = getFollowUpDuration(draft.service_type, draft.appointment_date);
    const daySetting = agendaDaySettings[draft.appointment_date];
    const combinedAppointments = [
      ...appointments.filter((item) => ACTIVE_APPOINTMENT_STATUSES.includes(item.status)),
      ...buildDraftAppointmentsForAvailability(drafts, draftIndex),
    ];

    return buildSlotAvailability({
      appointments: combinedAppointments,
      section,
      serviceType: draft.service_type,
      appointmentDate: draft.appointment_date,
      durationMinutes,
      slotSettings: agendaSlotSettings,
      selectedDateClosed: daySetting?.is_closed ?? false,
      selectedDateDailyCapacity: daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY,
      selectedDateActiveTotal: combinedAppointments.filter(
        (item) =>
          item.appointment_date === draft.appointment_date &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
      ).length,
      editingAppointmentId: null,
      getSectionForService,
    });
  }

  async function iniciarAtencion(item: CommercialCase) {
    try {
      setError("");
      setMensaje("");

      if (item.status !== "finalizado" && item.status !== "en_atencion_comercial") {
        const { error } = await supabase
          .from("commercial_cases")
          .update({
            status: "en_atencion_comercial",
            updated_by_user_id: currentUserId,
          })
          .eq("id", item.id);

        if (error) throw error;
      }

      const portfolioData = parsePortfolioDetails(item.closing_notes);
      let loadedFollowUps: CommercialFollowUpDraft[] = [];

      const { data: appointmentRows, error: appointmentsError } = await supabase
        .from("appointments")
        .select("service_type, appointment_date, appointment_time, specialist_user_id, notes, instructions_text")
        .ilike("instructions_text", `%[commercial_case_id:${item.id}]%`)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (appointmentsError) throw appointmentsError;

      loadedFollowUps =
        ((appointmentRows as AppointmentLookupRow[] | null) || [])
          .map((row) => parseCommercialFollowUpFromAppointment(row))
          .filter((row): row is CommercialFollowUpDraft => Boolean(row)) || [];

      if (loadedFollowUps.length === 0 && item.next_step_type) {
        loadedFollowUps = [
          {
            service_type: item.next_step_type || "",
            appointment_date: item.next_appointment_date || hoyISO(),
            appointment_time: item.next_appointment_time
              ? item.next_appointment_time.slice(0, 5)
              : ahoraHora(),
            specialist_user_id: item.next_specialist_user_id || "",
            notes: item.next_notes || "",
          },
        ];
      }

      const primaryFollowUp = loadedFollowUps[0] || null;
      const storedCommercialNotes = parseStoredCommercialNotes(item.commercial_notes);

      setEditingCaseId(item.id);
      setForm({
        status: item.status === "finalizado" ? "finalizado" : "en_atencion_comercial",
        commercial_notes: storedCommercialNotes.commercialNotes,
        sales_assessment: item.sales_assessment || "",
        proposal_text: item.proposal_text || "",
        purchased_service: item.purchased_service || "",
        payment_method: item.payment_method || "",
        cash_amount: item.cash_amount ? String(item.cash_amount) : "",
        portfolio_amount: item.portfolio_amount ? String(item.portfolio_amount) : "",
        volume_amount:
          item.volume_amount || item.sale_value ? String(item.volume_amount || item.sale_value) : "",
        closing_notes: stripPortfolioDetails(item.closing_notes || ""),
        next_step_type: primaryFollowUp?.service_type || "",
        next_appointment_date: primaryFollowUp?.appointment_date || hoyISO(),
        next_appointment_time: primaryFollowUp?.appointment_time || ahoraHora(),
        next_specialist_user_id: primaryFollowUp?.specialist_user_id || "",
        next_notes: primaryFollowUp?.notes || "",
      });
      setNextAppointments(loadedFollowUps.slice(1));
      setPortfolioForm({
        ...portfolioData,
        installment_value: "",
      });

      setCases((prev) =>
        prev.map((caseItem) =>
          caseItem.id === item.id && caseItem.status !== "finalizado"
            ? { ...caseItem, status: "en_atencion_comercial" }
            : caseItem
        )
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err?.message || "No se pudo abrir el caso.");
    }
  }

  function resetForm() {
    setEditingCaseId(null);
    setNextAppointments([]);
    setForm({
      status: "en_atencion_comercial",
      commercial_notes: "",
      sales_assessment: "",
      proposal_text: "",
      purchased_service: "",
      payment_method: "",
      cash_amount: "",
      portfolio_amount: "",
      volume_amount: "",
      closing_notes: "",
      next_step_type: "",
      next_appointment_date: hoyISO(),
      next_appointment_time: ahoraHora(),
      next_specialist_user_id: "",
      next_notes: "",
    });
    setPortfolioForm({
      installments_count: "",
      installment_value: "",
      first_installment_date: "",
    });
  }


  function imprimirInstruccionesPlan() {
    if (!currentCase) return;

    const allFollowUps = getPrimaryFollowUp(form, nextAppointments);

    printPlanInstructions({
      customerName: currentCase.customer_name,
      phone: currentCase.phone,
      city: currentCase.city,
      commercialDate: formatDate(currentCase.created_at),
      serviceName: serviceLabel(form.purchased_service),
      paymentMethod: paymentMethodLabel(form.payment_method),
      volumeAmount: calculatedVolume,
      cashAmount: calculatedCash,
      portfolioAmount: calculatedPortfolio,
      nextStep:
        allFollowUps.length > 1
          ? `${allFollowUps.length} citas agendadas`
          : nextStepLabel(allFollowUps[0]?.service_type || form.next_step_type),
      receptionSummary: currentReceptionSummary,
      assessment: form.sales_assessment,
      proposal: form.proposal_text,
      closingNotes: form.closing_notes,
      nextAppointmentDate: allFollowUps[0]?.appointment_date || form.next_appointment_date || null,
      nextAppointmentTime: allFollowUps[0]?.appointment_time || form.next_appointment_time || null,
      nextNotes: allFollowUps[0]?.notes || form.next_notes,
      nextAppointments: allFollowUps.map((item) => ({
        serviceName: nextStepLabel(item.service_type),
        appointmentDate: item.appointment_date,
        appointmentTime: item.appointment_time,
        specialistName:
          specialists.find((specialist) => specialist.id === item.specialist_user_id)?.full_name ||
          null,
        notes: item.notes,
      })),
      installmentPlan,
    });
  }

  async function crearClienteNuevo() {
    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    if (!newClientForm.customer_name.trim() || !newClientForm.phone.trim()) {
      setError("Debes registrar nombre y teléfono para crear el cliente.");
      return;
    }

    try {
      setCreatingClient(true);
      setError("");
      setMensaje("");

      const assignedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("commercial_cases")
        .insert([
          {
            customer_name: newClientForm.customer_name.trim(),
            phone: newClientForm.phone.trim(),
            city: newClientForm.city.trim() || null,
            status: "asignado_comercial",
            assigned_commercial_user_id: currentUserId,
            assigned_by_user_id: currentUserId,
            assigned_at: assignedAt,
            sale_origin_type: "directo",
            created_by_user_id: currentUserId,
            updated_by_user_id: currentUserId,
          },
        ])
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
          commercial_notes,
          sales_assessment,
          proposal_text,
          sale_result,
          purchased_service,
          sale_value,
          payment_method,
          cash_amount,
          portfolio_amount,
          volume_amount,
          closing_notes,
          closed_by_user_id,
          closed_at,
          next_step_type,
          next_appointment_date,
          next_appointment_time,
          next_specialist_user_id,
          next_notes,
          next_appointment_created,
          next_appointment_id,
          sale_origin_type,
          lead_source_type,
          commission_source_type,
          call_contact_result,
          call_user_id,
          opc_user_id,
          is_credit_payment,
          credit_provider,
          credit_discount_amount,
          admin_discount_amount,
          net_commission_base,
          counts_for_commission,
          counts_for_commercial_bonus,
          gross_bonus_base,
          created_at
        `)
        .single();

      if (error) throw error;

      const createdCase = data as CommercialCase;

      setNewClientForm({
        customer_name: "",
        phone: "",
        city: "",
      });
      setCases((prev) => [createdCase, ...prev]);
      setMensaje("Cliente creado y asignado para atención comercial.");
      await iniciarAtencion(createdCase);
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el cliente nuevo.");
    } finally {
      setCreatingClient(false);
    }
  }

  async function obtenerHerenciaLead(leadId: string | null) {
    if (!leadId) return null;

    const { data, error } = await supabase
      .from("leads")
      .select("id, created_by_user_id, assigned_to_user_id, source, status, commission_source_type")
      .eq("id", leadId)
      .maybeSingle();

    if (error) throw error;
    return (data as LeadInheritance | null) || null;
  }

  async function guardarCaso(finalizar: boolean) {
    if (!editingCaseId || !currentUserId) {
      setError("No se encontró el caso o el usuario actual.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const currentCaseFound = cases.find((item) => item.id === editingCaseId);
      const leadInheritance = await obtenerHerenciaLead(currentCaseFound?.lead_id || null);
      const statusFinal = finalizar ? "finalizado" : "en_atencion_comercial";
      const volumeNumber = numberFromString(form.volume_amount);
      const cashNumber = numberFromString(form.cash_amount);
      const portfolioNumber = Math.max(0, volumeNumber - cashNumber);
      const closingNotes = buildClosingNotes(
        form.closing_notes,
        portfolioForm,
        portfolioNumber,
        automaticInstallmentValue,
        installmentPlan
      );
      const saleOutcome =
        volumeNumber > 0 || form.purchased_service
          ? "ganada"
          : finalizar
          ? "perdida"
          : currentCaseFound?.status === "seguimiento_comercial"
          ? "pendiente"
          : null;

      const preservedReceptionSummary =
        currentCaseFound?.sale_result && !isOutcomeCode(currentCaseFound.sale_result)
          ? currentCaseFound.sale_result
          : saleOutcome;

      const paymentMethod = form.payment_method || null;
const isCreditPayment = ["addi", "welly", "medipay"].includes(paymentMethod || "");
const creditDiscountAmount = isCreditPayment ? Math.round(cashNumber * 0.1) : 0;
const adminDiscountAmount = 200000;
const netCommissionBase = Math.max(0, cashNumber - creditDiscountAmount - adminDiscountAmount);
const grossBonusBase = volumeNumber || 0;
const hayVenta = volumeNumber > 0 || !!form.purchased_service;
      const plannedFollowUps = getPrimaryFollowUp(form, nextAppointments);

      const incompleteFollowUp = plannedFollowUps.find(
        (item) => !item.service_type || !item.appointment_date || !item.appointment_time
      );

      if (incompleteFollowUp) {
        throw new Error("Completa servicio, fecha y hora en cada cita que quieras agendar.");
      }

      const unavailableFollowUp = plannedFollowUps.find((item, index) => {
        const availability = getFollowUpSlotAvailability(item, index, plannedFollowUps);
        const selectedSlot = availability.find((slot) => slot.value === item.appointment_time);
        return !selectedSlot || selectedSlot.disabled;
      });

      if (unavailableFollowUp) {
        throw new Error(
          `La cita de ${nextStepLabel(unavailableFollowUp.service_type)} en ${unavailableFollowUp.appointment_date} ya no tiene ese horario disponible.`
        );
      }

      const receptionSummaryText = currentCaseFound
        ? getReceptionSummary(currentCaseFound).join(" | ")
        : "";

const updatePayload: any = {
        status: statusFinal,
        commercial_notes: buildStoredCommercialNotes(
          receptionSummaryText,
          form.commercial_notes
        ),
        sales_assessment: form.sales_assessment.trim() || null,
        proposal_text: form.proposal_text.trim() || null,
        sale_result: preservedReceptionSummary,
        purchased_service: form.purchased_service || null,
        sale_value: volumeNumber || null,
        payment_method: paymentMethod,
        cash_amount: cashNumber || null,
        portfolio_amount: portfolioNumber || null,
        volume_amount: volumeNumber || null,
        closing_notes: closingNotes,
        sale_origin_type: leadInheritance ? "lead" : "directo",
        lead_source_type: normalizeCommercialCaseLeadSource(
          leadInheritance?.source || currentCaseFound?.lead_source_type || null
        ),
        commission_source_type:
          leadInheritance?.commission_source_type ||
          currentCaseFound?.commission_source_type ||
          null,
        call_contact_result: leadInheritance?.status || currentCaseFound?.call_contact_result || null,
        call_user_id: leadInheritance?.assigned_to_user_id || currentCaseFound?.call_user_id || null,
        opc_user_id: leadInheritance?.created_by_user_id || currentCaseFound?.opc_user_id || null,
        is_credit_payment: isCreditPayment,
        credit_provider: isCreditPayment ? paymentMethod : null,
        credit_discount_amount: creditDiscountAmount,
        admin_discount_amount: adminDiscountAmount,
        net_commission_base: netCommissionBase,
        counts_for_commission: hayVenta,
        counts_for_commercial_bonus: hayVenta,
        gross_bonus_base: grossBonusBase || null,
        next_step_type: plannedFollowUps[0]?.service_type || null,
        next_appointment_date: plannedFollowUps[0]?.appointment_date || null,
        next_appointment_time: plannedFollowUps[0]?.appointment_time || null,
        next_specialist_user_id: plannedFollowUps[0]?.specialist_user_id || null,
        next_notes: plannedFollowUps[0]?.notes.trim() || null,
        updated_by_user_id: currentUserId,
      };

      if (statusFinal === "finalizado") {
        updatePayload.closed_by_user_id = currentUserId;
        updatePayload.closed_at = new Date().toISOString();
      }


      if (
        statusFinal === "finalizado" &&
        hayVenta &&
        plannedFollowUps.length > 0 &&
        !currentCaseFound?.next_appointment_created
      ) {
        const appointmentPayload = plannedFollowUps.map((item, index) => ({
          lead_id: currentCaseFound?.lead_id || null,
          patient_name: currentCaseFound?.customer_name || "Cliente",
          phone: currentCaseFound?.phone || null,
          city: currentCaseFound?.city || null,
          appointment_date: item.appointment_date,
          appointment_time: item.appointment_time,
          status: "agendada",
          service_type: item.service_type,
          treatment_type: item.service_type,
          specialist_user_id: item.specialist_user_id || null,
          notes: item.notes.trim() || null,
          instructions_text: buildCommercialFollowUpMetadata(editingCaseId, index),
          created_by_user_id: currentUserId,
          updated_by_user_id: currentUserId,
        }));

        const { data: appointmentData, error: appointmentError } = await supabase
          .from("appointments")
          .insert(appointmentPayload)
          .select("id")
          .order("id", { ascending: true });

        if (appointmentError) throw appointmentError;

        updatePayload.next_appointment_created = true;
        updatePayload.next_appointment_id = appointmentData?.[0]?.id || null;
      }

      const { error } = await supabase
        .from("commercial_cases")
        .update(updatePayload)
        .eq("id", editingCaseId);

      if (error) throw error;

      setMensaje(
        finalizar
          ? "Caso finalizado correctamente. Ya no aparecerá en la bandeja activa del día."
          : "Avance comercial guardado correctamente."
      );
      resetForm();
      await cargarDatos();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el caso comercial.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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
        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Comercial</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.1rem]">Gestion comercial</h1>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Actualizar
            </button>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-[linear-gradient(135deg,_#FFF5F5_0%,_#FFF0F0_100%)] p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-2xl border border-[#BFE0CD] bg-[linear-gradient(135deg,_#F1FBF5_0%,_#E8F7EF_100%)] p-4 text-sm text-[#2D6B4A] shadow-sm">
            {mensaje}
          </div>
        ) : null}

        {!editingCaseId ? (
          <>
            <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard title="Asignados hoy" value={String(resumen.asignadosHoy)} />
              <StatCard title="Activos hoy" value={String(resumen.activosHoy)} />
              <StatCard title="Atendidos hoy" value={String(resumen.asistieronHoy)} />
              <StatCard title="Vendidos hoy" value={String(resumen.vendidosHoy)} />
              <StatCard title="No vendidos hoy" value={String(resumen.noVendidosHoy)} />
            </section>

            <section className="mb-6 rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Crear cliente</h2>
                <p className="mt-1 text-sm leading-6 text-[#51695C]">
                  Usa el formulario completo para registrar un cliente nuevo y dejarlo listo para comercial.
                </p>

                <div className="mt-4">
                  <a
                    href="/recepcion?view=comercial"
                    className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
                  >
                    Crear cliente
                  </a>
                </div>
              </div>
            </section>
          </>
        ) : null}

        <section className={`mb-6 grid gap-6 ${editingCaseId ? "" : "xl:grid-cols-2"}`}>
          <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingCaseId ? "Atender caso" : "Selecciona un caso"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#51695C]">
                  Aqui ves lo registrado en recepcion y completas el cierre comercial.
                </p>
              </div>

              {editingCaseId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            {!editingCaseId ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                Selecciona un caso de la lista para empezar a atenderlo.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-[#CFE7D6] bg-[#EEF8F1] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-[#2F5E46]">Estado del caso:</span>
                    <StatusBadge
                      label="En atencion"
                      className="bg-emerald-100 text-emerald-700"
                    />
                    {currentCase?.assigned_at ? (
                      <span className="text-sm text-[#2F5E46]">
                        Desde: {formatDate(currentCase.assigned_at)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {currentCase ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_18px_40px_rgba(95,125,102,0.1)]">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Cliente</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">{currentCase.customer_name}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Telefono</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">{currentCase.phone || "Sin telefono"}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Ciudad</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">{currentCase.city || "Sin ciudad"}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Ingreso</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">{formatDate(currentCase.created_at)}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[320px]">
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Estado</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">
                              {traducirEstadoComercial(currentCase.status)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[#E3ECE5] bg-white/85 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C8A78]">Asignado</p>
                            <p className="mt-1 text-sm font-semibold text-[#24312A]">
                              {currentCase.assigned_at ? formatDate(currentCase.assigned_at) : "Sin fecha"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_18px_40px_rgba(95,125,102,0.1)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[#24312A]">
                            Informacion registrada en recepcion
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Este resumen viene desde recepcion y queda separado de tus notas comerciales.
                          </p>
                        </div>
                        <span className="rounded-full border border-[#DCEADF] bg-[#F5FBF7] px-3 py-1 text-xs font-semibold text-[#5B7967]">
                          {currentReceptionSummary.length} datos visibles
                        </span>
                      </div>

                      {currentReceptionSummary.length > 0 ? (
                        <div className="mt-4 grid gap-x-6 gap-y-2 md:grid-cols-2">
                          {currentReceptionSummary.map((line, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-[#E8F1EA] bg-white/85 px-4 py-3 text-sm text-slate-700"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          Aqui aparecera todo lo que recepcion haya guardado dentro del ingreso comercial.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <Field
                  label="Notas comerciales"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      value={form.commercial_notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          commercial_notes: e.target.value,
                        }))
                      }
                    />
                  }
                />

                <Field
                  label="Valoración comercial"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      value={form.sales_assessment}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          sales_assessment: e.target.value,
                        }))
                      }
                    />
                  }
                />

                <Field
                  label="Propuesta comercial"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      value={form.proposal_text}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          proposal_text: e.target.value,
                        }))
                      }
                    />
                  }
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Servicio adquirido"
                    input={
                      <select
                        className={inputClass}
                        value={form.purchased_service}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            purchased_service: e.target.value,
                          }))
                        }
                      >
                        {purchasedServiceOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  <Field
                    label="Forma de pago"
                    input={
                      <select
                        className={inputClass}
                        value={form.payment_method}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            payment_method: e.target.value,
                          }))
                        }
                      >
                        {paymentMethodOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />

                  <Field
                    label="Volumen"
                    input={
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={formatMoneyDisplay(form.volume_amount)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            volume_amount: normalizeMoneyString(e.target.value),
                          }))
                        }
                      />
                    }
                  />

                  <Field
                    label="Caja"
                    input={
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        value={formatMoneyDisplay(form.cash_amount)}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            cash_amount: normalizeMoneyString(e.target.value),
                          }))
                        }
                      />
                    }
                  />

                  <Field
                    label="Valor de cartera"
                    input={
                      <input
                        className={`${inputClass} bg-slate-50`}
                        value={formatMoneyDisplay(calculatedPortfolio)}
                        readOnly
                      />
                    }
                  />
                </div>

                {calculatedPortfolio > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <h3 className="text-lg font-semibold text-amber-900">Detalle de cartera</h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <Field
                        label="Número de cuotas"
                        input={
                          <input
                            className={inputClass}
                            inputMode="numeric"
                            value={portfolioForm.installments_count}
                            onChange={(e) =>
                              setPortfolioForm((prev) => ({
                                ...prev,
                                installments_count: normalizeMoneyString(e.target.value),
                              }))
                            }
                          />
                        }
                      />

                      <Field
                        label="Valor de la cuota"
                        input={
                          <input
                            className={`${inputClass} bg-slate-50`}
                            value={formatMoneyDisplay(automaticInstallmentValue)}
                            readOnly
                          />
                        }
                      />

                      <Field
                        label="Fecha primera cuota"
                        input={
                          <input
                            className={inputClass}
                            type="date"
                            value={portfolioForm.first_installment_date}
                            onChange={(e) =>
                              setPortfolioForm((prev) => ({
                                ...prev,
                                first_installment_date: e.target.value,
                              }))
                            }
                          />
                        }
                      />
                    </div>

                    {installmentPlan.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-4">
                        <p className="text-sm font-semibold text-amber-900">
                          Plan automático de cuotas
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Se generará una cuota mensual con la misma fecha base.
                        </p>
                        <div className="mt-3 max-h-48 overflow-auto rounded-2xl border border-amber-100">
                          <div className="divide-y divide-amber-100">
                            {installmentPlan.map((item) => (
                              <div
                                key={`${item.number}_${item.date}`}
                                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                              >
                                <span className="font-medium text-slate-800">
                                  Cuota {item.number}
                                </span>
                                <span className="text-slate-600">
                                  {formatDateOnly(item.date)}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  ${item.value.toLocaleString("es-CO")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Field
                  label="Observaciones de cierre"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-none`}
                      value={form.closing_notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          closing_notes: e.target.value,
                        }))
                      }
                    />
                  }
                />

                <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4">
                  <h3 className="text-lg font-semibold text-[#24312A]">
                    Siguiente cita o continuidad
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Si cierras la venta, aquí dejas programado el siguiente paso.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Siguiente paso"
                      input={
                        <select
                          className={inputClass}
                          value={form.next_step_type}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_step_type: e.target.value,
                            }))
                          }
                        >
                          {nextStepOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      }
                    />

                    <Field
                      label="Especialista"
                      input={
                        <select
                          className={inputClass}
                          value={form.next_specialist_user_id}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_specialist_user_id: e.target.value,
                            }))
                          }
                        >
                          <option value="">Selecciona</option>
                          {specialists.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.full_name} · {item.role_name}
                            </option>
                          ))}
                        </select>
                      }
                    />

                    <Field
                      label="Fecha siguiente cita"
                      input={
                        <input
                          className={inputClass}
                          type="date"
                          value={form.next_appointment_date}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_appointment_date: e.target.value,
                            }))
                          }
                        />
                      }
                    />

                    <Field
                      label="Hora siguiente cita"
                      input={
                        <select
                          className={inputClass}
                          value={form.next_appointment_time}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_appointment_time: e.target.value,
                            }))
                          }
                          disabled={
                            !!form.next_step_type &&
                            primaryFollowUpAvailability.filter((slot) => !slot.disabled).length === 0
                          }
                        >
                          {!form.next_step_type ? (
                            <option value="">Primero elige el siguiente paso</option>
                          ) : primaryFollowUpAvailability.filter((slot) => !slot.disabled).length === 0 ? (
                            <option value="">Sin cupos disponibles</option>
                          ) : (
                            primaryFollowUpAvailability
                              .filter((slot) => !slot.disabled)
                              .map((slot) => (
                                <option key={slot.value} value={slot.value}>
                                  {formatSlotAvailabilityLabel(slot)}
                                </option>
                              ))
                          )}
                        </select>
                      }
                    />
                  </div>

                  {form.next_step_type &&
                  primaryFollowUpAvailability.filter((slot) => !slot.disabled).length === 0 ? (
                    <p className="mt-2 text-sm text-amber-700">
                      No hay horarios disponibles para ese servicio en la fecha elegida.
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <Field
                      label="Notas de continuidad"
                      input={
                        <textarea
                          className={`${inputClass} min-h-[90px] resize-none`}
                          value={form.next_notes}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_notes: e.target.value,
                            }))
                          }
                        />
                      }
                    />
                  </div>

                  {nextAppointments.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {nextAppointments.map((item, index) => {
                        const followUpAvailability = getFollowUpSlotAvailability(
                          item,
                          index + 1,
                          allFollowUpDrafts
                        );
                        const availableFollowUpSlots = followUpAvailability.filter(
                          (slot) => !slot.disabled
                        );

                        return (
                        <div
                          key={`follow-up-${index}`}
                          className="rounded-2xl border border-[#D7EADF] bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-[#24312A]">
                              Cita adicional {index + (form.next_step_type ? 2 : 1)}
                            </h4>
                            <button
                              type="button"
                              onClick={() => eliminarCitaAdicional(index)}
                              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                              Quitar
                            </button>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field
                              label="Siguiente paso"
                              input={
                                <select
                                  className={inputClass}
                                  value={item.service_type}
                                  onChange={(e) =>
                                    actualizarCitaAdicional(index, "service_type", e.target.value)
                                  }
                                >
                                  {nextStepOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              }
                            />

                            <Field
                              label="Especialista"
                              input={
                                <select
                                  className={inputClass}
                                  value={item.specialist_user_id}
                                  onChange={(e) =>
                                    actualizarCitaAdicional(index, "specialist_user_id", e.target.value)
                                  }
                                >
                                  <option value="">Selecciona</option>
                                  {specialists.map((option) => (
                                    <option key={option.id} value={option.id}>
                                      {option.full_name} Â· {option.role_name}
                                    </option>
                                  ))}
                                </select>
                              }
                            />

                            <Field
                              label="Fecha"
                              input={
                                <input
                                  className={inputClass}
                                  type="date"
                                  value={item.appointment_date}
                                  onChange={(e) =>
                                    actualizarCitaAdicional(index, "appointment_date", e.target.value)
                                  }
                                />
                              }
                            />

                            <Field
                              label="Hora"
                              input={
                                <select
                                  className={inputClass}
                                  value={item.appointment_time}
                                  onChange={(e) =>
                                    actualizarCitaAdicional(index, "appointment_time", e.target.value)
                                  }
                                  disabled={!item.service_type || availableFollowUpSlots.length === 0}
                                >
                                  {!item.service_type ? (
                                    <option value="">Primero elige el siguiente paso</option>
                                  ) : availableFollowUpSlots.length === 0 ? (
                                    <option value="">Sin cupos disponibles</option>
                                  ) : (
                                    availableFollowUpSlots.map((slot) => (
                                      <option key={slot.value} value={slot.value}>
                                        {formatSlotAvailabilityLabel(slot)}
                                      </option>
                                    ))
                                  )}
                                </select>
                              }
                            />
                          </div>

                          {item.service_type && availableFollowUpSlots.length === 0 ? (
                            <p className="mt-3 text-sm text-amber-700">
                              No hay horarios disponibles para esta cita adicional en la fecha elegida.
                            </p>
                          ) : null}

                          <div className="mt-4">
                            <Field
                              label="Notas de continuidad"
                              input={
                                <textarea
                                  className={`${inputClass} min-h-[90px] resize-none`}
                                  value={item.notes}
                                  onChange={(e) =>
                                    actualizarCitaAdicional(index, "notes", e.target.value)
                                  }
                                />
                              }
                            />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={agregarCitaAdicional}
                      className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                    >
                      Agregar otra cita
                    </button>
                    <p className="text-sm text-slate-500">
                      La primera cita queda como continuidad principal y las demás salen como adicionales al finalizar.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void guardarCaso(false)}
                    disabled={saving}
                    className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar avances"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void guardarCaso(true)}
                    disabled={saving}
                    className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Finalizar caso"}
                  </button>

                  <button
                    type="button"
                    onClick={imprimirInstruccionesPlan}
                    disabled={!canPrintPlan}
                    className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Imprimir instrucciones del plan
                  </button>
                </div>

                <div className="rounded-2xl border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 text-sm text-[#51695C] shadow-inner">
                  El botón de impresión se habilita cuando el caso ya tenga servicio adquirido o volumen diligenciado.
                </div>
              </div>
            )}
          </div>

          {!editingCaseId ? (
          <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Casos visibles</h2>
                <p className="mt-1 text-sm leading-6 text-[#51695C]">
                  Solo aparecen los casos asignados hoy y aún activos para trabajar.
                </p>
              </div>

              <button
                onClick={() => void cargarDatos()}
                className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Actualizar
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 text-sm text-[#51695C] shadow-inner">
              Los casos finalizados ya no quedan en esta bandeja. Siguen contando en el resumen diario.
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                placeholder="Buscar por cliente o teléfono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="asignado_comercial">Asignado</option>
                <option value="en_atencion_comercial">En atención</option>
              </select>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                Cargando casos...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                No hay casos activos asignados hoy.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCases.map((item) => {
                  const receptionSummary = getReceptionSummary(item);
                  return (
                    <div
                      key={item.id}
                      className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-[#24312A]">
                                {item.customer_name}
                              </h3>

                              <StatusBadge
                                label={traducirEstadoComercial(item.status)}
                                className={commercialStatusClass(item.status)}
                              />
                            </div>

                            <div className="mt-2 grid gap-3 xl:grid-cols-2">
                              <div>
                                <p className="text-sm text-slate-600">
                                  {item.phone || "Sin teléfono"} · {item.city || "Sin ciudad"}
                                </p>

                                <p className="mt-1 text-sm text-slate-600">
                                  Asignado: {formatDate(item.assigned_at)}
                                </p>
                              </div>

                              <div className="rounded-2xl border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-3 shadow-inner">
                                <p className="text-sm font-semibold text-[#24312A]">
                                  Recepción
                                </p>
                                {receptionSummary.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                    {receptionSummary.map((line, index) => (
                                      <li key={index}>• {line}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 text-sm text-slate-500">
                                    Sin resumen visible de recepción.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void iniciarAtencion(item)}
                            className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                          >
                            Atender
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : null}

        </section>
      </div>
    </main>
  );
}


const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-4 text-base text-slate-900 shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";
