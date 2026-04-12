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
import printPlanInstructions from "@/lib/print/templates/printPlanInstructions";
import { hoyISO, dateToLocalISO, isSameLocalDay } from "@/lib/datetime/dateHelpers";
import { formatDate, formatDateOnly } from "@/lib/datetime/dateFormat";
import { traducirEstadoComercial, commercialStatusClass } from "@/lib/status/commercialStatus";

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
  const map: Record<string, string> = {
    opc: "OPC",
    redes_sociales: "Redes sociales",
    referido: "Referido",
    evento: "Evento",
    punto_fisico: "Punto físico",
    otro: "Otro",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function commissionSourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
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
  if (!item.sale_result || isOutcomeCode(item.sale_result)) return [];
  return item.sale_result
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

export default function ComercialPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      const [casesResult, profilesResult] = await Promise.all([
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
            user_roles!user_roles_user_id_fkey (
              roles (
                name,
                code
              )
            )
          `),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      let casesData = (casesResult.data as CommercialCase[]) || [];
      const profileRows = (profilesResult.data as any[]) || [];

      const isManagementView = currentRoleCode
        ? managementRoles.includes(currentRoleCode)
        : false;

      if (!isManagementView && currentUserId) {
        casesData = casesData.filter(
          (item) => item.assigned_commercial_user_id === currentUserId
        );
      }

      const specialistList: SpecialistOption[] = profileRows
        .map((row) => {
          const role = row.user_roles?.[0]?.roles;
          return {
            id: row.id,
            full_name: row.full_name || "Sin nombre",
            role_name: role?.name || "",
            role_code: role?.code || "",
          };
        })
        .filter((item) =>
          ["nutricionista", "medico_general", "fisioterapeuta"].includes(item.role_code)
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setCases(casesData);
      setSpecialists(specialistList);
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

      setEditingCaseId(item.id);
      setForm({
        status: item.status === "finalizado" ? "finalizado" : "en_atencion_comercial",
        commercial_notes: item.commercial_notes || "",
        sales_assessment: item.sales_assessment || "",
        proposal_text: item.proposal_text || "",
        purchased_service: item.purchased_service || "",
        payment_method: item.payment_method || "",
        cash_amount: item.cash_amount ? String(item.cash_amount) : "",
        portfolio_amount: item.portfolio_amount ? String(item.portfolio_amount) : "",
        volume_amount:
          item.volume_amount || item.sale_value ? String(item.volume_amount || item.sale_value) : "",
        closing_notes: stripPortfolioDetails(item.closing_notes || ""),
        next_step_type: item.next_step_type || "",
        next_appointment_date: item.next_appointment_date || hoyISO(),
        next_appointment_time: item.next_appointment_time
          ? item.next_appointment_time.slice(0, 5)
          : ahoraHora(),
        next_specialist_user_id: item.next_specialist_user_id || "",
        next_notes: item.next_notes || "",
      });
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
      nextStep: nextStepLabel(form.next_step_type),
      receptionSummary: currentReceptionSummary,
      assessment: form.sales_assessment,
      proposal: form.proposal_text,
      closingNotes: form.closing_notes,
      nextAppointmentDate: form.next_appointment_date || null,
      nextAppointmentTime: form.next_appointment_time || null,
      nextNotes: form.next_notes,
      installmentPlan,
    });
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

const updatePayload: any = {
        status: statusFinal,
        commercial_notes: form.commercial_notes.trim() || null,
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
        lead_source_type: leadInheritance?.source || currentCaseFound?.lead_source_type || null,
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
        next_step_type: form.next_step_type || null,
        next_appointment_date: form.next_step_type ? form.next_appointment_date : null,
        next_appointment_time: form.next_step_type ? form.next_appointment_time : null,
        next_specialist_user_id: form.next_specialist_user_id || null,
        next_notes: form.next_notes.trim() || null,
        updated_by_user_id: currentUserId,
      };

      if (statusFinal === "finalizado") {
        updatePayload.closed_by_user_id = currentUserId;
        updatePayload.closed_at = new Date().toISOString();
      }


      if (
        statusFinal === "finalizado" &&
        hayVenta &&
        form.next_step_type &&
        !currentCaseFound?.next_appointment_created
      ) {
        const { data: appointmentData, error: appointmentError } = await supabase
          .from("appointments")
          .insert([
            {
              lead_id: currentCaseFound?.lead_id || null,
              patient_name: currentCaseFound?.customer_name || "Cliente",
              phone: currentCaseFound?.phone || null,
              city: currentCaseFound?.city || null,
              appointment_date: form.next_appointment_date,
              appointment_time: form.next_appointment_time,
              status: "agendada",
              service_type: form.next_step_type,
              treatment_type: form.next_step_type,
              specialist_user_id: form.next_specialist_user_id || null,
              notes: form.next_notes.trim() || null,
              instructions_text: form.next_notes.trim() || null,
              created_by_user_id: currentUserId,
              updated_by_user_id: currentUserId,
            },
          ])
          .select("id")
          .single();

        if (appointmentError) throw appointmentError;

        updatePayload.next_appointment_created = true;
        updatePayload.next_appointment_id = appointmentData.id;
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
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
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
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>
        <section className="relative overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#7FA287]">Comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Gestión comercial</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Atiende solo los casos asignados hoy y registra el cierre comercial del día.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Inicio
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Actualizar
            </button>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard title="Asignados hoy" value={String(resumen.asignadosHoy)} />
          <StatCard title="Activos hoy" value={String(resumen.activosHoy)} />
          <StatCard title="Asistieron hoy" value={String(resumen.asistieronHoy)} />
          <StatCard title="Vendidos hoy" value={String(resumen.vendidosHoy)} />
          <StatCard title="Seguimiento hoy" value={String(resumen.seguimientoHoy)} />
          <StatCard title="No vendidos hoy" value={String(resumen.noVendidosHoy)} />
          <StatCard title="Citas hoy" value={String(resumen.citasHoy)} />
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingCaseId ? "Atender caso" : "Selecciona un caso"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Aquí ves lo registrado en recepción y completas el cierre comercial.
                </p>
              </div>

              {editingCaseId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            {!editingCaseId ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Selecciona un caso de la lista para empezar a atenderlo.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl border border-[#CFE7D6] bg-[#EEF8F1] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-[#2F5E46]">Estado del caso:</span>
                    <StatusBadge
                      label="En atención"
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
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-[#D6E8DA] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-semibold text-[#24312A]">
                        Información básica
                      </h3>
                      <div className="mt-3 grid gap-3 text-sm text-slate-700">
                        <InfoItem label="Cliente" value={currentCase.customer_name} />
                        <InfoItem label="Teléfono" value={currentCase.phone || "Sin teléfono"} />
                        <InfoItem label="Ciudad" value={currentCase.city || "Sin ciudad"} />
                        <InfoItem label="Ingreso comercial" value={formatDate(currentCase.created_at)} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#D6E8DA] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-semibold text-[#24312A]">
                        Información registrada en recepción
                      </h3>

                      {currentReceptionSummary.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm text-slate-700">
                          {currentReceptionSummary.map((line, index) => (
                            <li key={index}>• {line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          Aquí aparecerá todo lo que recepción haya guardado dentro del ingreso comercial.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#D6E8DA] bg-white p-4 shadow-sm">
                      <h3 className="text-lg font-semibold text-[#24312A]">
                        Trazabilidad para admin
                      </h3>

                      {currentCaseCommissionSummary ? (
                        <div className="mt-3 grid gap-3 text-sm text-slate-700">
                          <InfoItem label="Origen de venta" value={currentCaseCommissionSummary.origenVenta === "lead" ? "Lead" : "Directo"} />
                          <InfoItem label="Origen real del lead" value={leadSourceLabel(currentCaseCommissionSummary.origenLead)} />
                          <InfoItem label="Fuente para comisión" value={commissionSourceLabel(currentCaseCommissionSummary.fuenteComision)} />
                          <InfoItem label="Resultado Call" value={callContactResultLabel(currentCaseCommissionSummary.resultadoCall)} />
                          <InfoItem label="Proveedor crédito" value={currentCaseCommissionSummary.proveedorCredito || "No aplica"} />
                          <InfoItem label="Descuento crédito" value={currentCaseCommissionSummary.descuentoCredito > 0 ? `$${currentCaseCommissionSummary.descuentoCredito.toLocaleString("es-CO")}` : "$0"} />
                          <InfoItem label="Descuento admin" value={`$${currentCaseCommissionSummary.descuentoAdmin.toLocaleString("es-CO")}`} />
                          <InfoItem label="Base neta comisionable" value={`$${currentCaseCommissionSummary.baseNeta.toLocaleString("es-CO")}`} />
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          La trazabilidad administrativa se completará cuando guardes avances o finalices el caso.
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
                        <input
                          className={inputClass}
                          type="time"
                          value={form.next_appointment_time}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              next_appointment_time: e.target.value,
                            }))
                          }
                        />
                      }
                    />
                  </div>

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
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void guardarCaso(false)}
                    disabled={saving}
                    className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar avances"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void guardarCaso(true)}
                    disabled={saving}
                    className="rounded-2xl bg-[#5F7D66] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#4F6F5B] disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Finalizar caso"}
                  </button>

                  <button
                    type="button"
                    onClick={imprimirInstruccionesPlan}
                    disabled={!canPrintPlan}
                    className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Imprimir instrucciones del plan
                  </button>
                </div>

                <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4 text-sm text-slate-600">
                  El botón de impresión se habilita cuando el caso ya tenga servicio adquirido o volumen diligenciado.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Casos visibles</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Solo aparecen los casos asignados hoy y aún activos para trabajar.
                </p>
              </div>

              <button
                onClick={() => void cargarDatos()}
                className="rounded-xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Actualizar
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4 text-sm text-slate-600">
              Los casos finalizados ya no quedan en esta bandeja. Siguen contando en el resumen diario.
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
                placeholder="Buscar por cliente o teléfono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="asignado_comercial">Asignado</option>
                <option value="en_atencion_comercial">En atención</option>
              </select>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                Cargando casos...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                No hay casos activos asignados hoy.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCases.map((item) => {
                  const receptionSummary = getReceptionSummary(item);
                  return (
                    <div
                      key={item.id}
                      className="group rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md"
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

                              <div className="rounded-2xl border border-[#E3ECE5] bg-[#F8F7F4] p-3">
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
                            className="rounded-2xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
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
        </section>
      </div>
    </main>
  );
}


const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
