"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import SessionBadge from "@/components/session-badge";
import Field from "@/components/ui/Field";
import { getCurrentUserRole } from "@/lib/auth";
import {
  buildStoredCommercialNotes,
  parseStoredCommercialNotes,
} from "@/lib/commercial/notes";
import { supabase } from "@/lib/supabase";

type CommercialCase = {
  id: string;
  lead_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  phone: string | null;
  city: string | null;
  assigned_commercial_user_id: string | null;
  status: string;
  purchased_service: string | null;
  sale_value: number | null;
  payment_method: string | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  volume_amount: number | null;
  closing_notes: string | null;
  commercial_notes: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  call_user_id: string | null;
  opc_user_id: string | null;
  net_commission_base: number | null;
  counts_for_commission: boolean | null;
  counts_for_commercial_bonus: boolean | null;
  gross_bonus_base: number | null;
  created_at: string;
  closed_at: string | null;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  specialist_user_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
};

type UserOption = {
  id: string;
  full_name: string;
};

type AdjustmentType =
  | "retracto_total"
  | "retracto_parcial"
  | "cambio_plan"
  | "renegociacion"
  | "descuento_extraordinario";

type AdjustmentStatus =
  | "ajuste_pendiente"
  | "ajuste_aprobado"
  | "ajuste_rechazado";

type AdjustmentForm = {
  adjustment_type: AdjustmentType;
  adjustment_date: string;
  reason: string;
  internal_notes: string;
  affects_commission: boolean;
  affects_inventory: boolean;
  requires_product_return: boolean;
  requires_new_appointment: boolean;
  new_service: string;
  new_total_value: string;
  new_cash_value: string;
  new_portfolio_value: string;
  inventory_notes: string;
  status: AdjustmentStatus;
};

type StoredDraft = AdjustmentForm & {
  case_id: string;
  saved_at: string;
};

type CaseSnapshot = {
  total: number;
  cash: number;
  portfolio: number;
  commissionBase: number;
  bonusBase: number;
  service: string | null;
};

type AdjustmentAuditEntry = {
  caseId: string;
  caseName: string;
  adjustmentDate: string;
  adjustmentType: string;
  reason: string;
  appliedBy: string;
  originalValue: number;
  adjustedValue: number;
  raw: string;
};

const allowedRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

const cardClass =
  "rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";
const inputClass =
  "w-full rounded-[22px] border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";
const draftStorageKey = "commercial_adjustment_drafts";

const adjustmentTypeOptions: Array<{ value: AdjustmentType; label: string }> = [
  { value: "retracto_total", label: "Retracto total" },
  { value: "retracto_parcial", label: "Retracto parcial" },
  { value: "cambio_plan", label: "Cambio de plan" },
  { value: "renegociacion", label: "Renegociacion" },
  { value: "descuento_extraordinario", label: "Descuento extraordinario" },
];

const serviceOptions = [
  { value: "", label: "Sin cambio de servicio" },
  { value: "valoracion", label: "Valoracion" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutricion" },
  { value: "medico", label: "Medico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "tratamiento_integral", label: "Tratamiento integral" },
];

function hoyISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMoneyString(value: string) {
  return value.replace(/[^\d]/g, "");
}

function numberFromString(value: string) {
  const raw = normalizeMoneyString(value || "");
  if (!raw) return 0;
  return Number(raw);
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function statusLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente de asignacion",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atencion",
    seguimiento_comercial: "Seguimiento",
    finalizado: "Finalizado",
  };

  return map[value || ""] || value || "Sin estado";
}

function sourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };

  return map[value || ""] || value || "Sin definir";
}

function serviceLabel(value: string | null | undefined) {
  return serviceOptions.find((item) => item.value === value)?.label || value || "Sin definir";
}

function buildAdjustmentAuditBlock(input: {
  userName: string;
  selectedCase: CommercialCase;
  form: AdjustmentForm;
  before: CaseSnapshot;
  after: CaseSnapshot;
}) {
  const adjustmentLabel =
    adjustmentTypeOptions.find((item) => item.value === input.form.adjustment_type)?.label ||
    input.form.adjustment_type;

  const lines = [
    "[AJUSTE COMERCIAL]",
    `Fecha del ajuste: ${input.form.adjustment_date}`,
    `Aplicado por: ${input.userName}`,
    `Tipo: ${adjustmentLabel}`,
    `Motivo: ${input.form.reason.trim() || "Sin motivo"}`,
    `Servicio original: ${serviceLabel(input.before.service)}`,
    `Servicio ajustado: ${serviceLabel(input.after.service)}`,
    `Valor original: ${formatMoney(input.before.total)}`,
    `Valor ajustado: ${formatMoney(input.after.total)}`,
    `Contado original: ${formatMoney(input.before.cash)}`,
    `Contado ajustado: ${formatMoney(input.after.cash)}`,
    `Cartera original: ${formatMoney(input.before.portfolio)}`,
    `Cartera ajustada: ${formatMoney(input.after.portfolio)}`,
    `Base comision original: ${formatMoney(input.before.commissionBase)}`,
    `Base comision ajustada: ${formatMoney(input.after.commissionBase)}`,
    `Base bono original: ${formatMoney(input.before.bonusBase)}`,
    `Base bono ajustada: ${formatMoney(input.after.bonusBase)}`,
    `Afecta comision: ${input.form.affects_commission ? "Si" : "No"}`,
    `Afecta inventario: ${input.form.affects_inventory ? "Si" : "No"}`,
    `Requiere devolucion: ${input.form.requires_product_return ? "Si" : "No"}`,
    `Requiere nueva cita: ${input.form.requires_new_appointment ? "Si" : "No"}`,
    input.form.inventory_notes.trim()
      ? `Inventario / devolucion: ${input.form.inventory_notes.trim()}`
      : "",
    input.form.internal_notes.trim()
      ? `Observaciones internas: ${input.form.internal_notes.trim()}`
      : "",
    `Caso original: ${input.selectedCase.id}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function parseAuditLine(block: string, label: string) {
  return (
    block
      .split("\n")
      .find((line) => line.startsWith(`${label}: `))
      ?.replace(`${label}: `, "")
      .trim() || ""
  );
}

function parseCurrencyText(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function extractAdjustmentAuditEntries(item: CommercialCase): AdjustmentAuditEntry[] {
  const commercialNotes = parseStoredCommercialNotes(item.commercial_notes).commercialNotes;
  if (!commercialNotes.includes("[AJUSTE COMERCIAL]")) return [];

  return commercialNotes
    .split("[AJUSTE COMERCIAL]")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const block = `[AJUSTE COMERCIAL]\n${part}`;

      return {
        caseId: item.id,
        caseName: item.customer_name,
        adjustmentDate: parseAuditLine(block, "Fecha del ajuste"),
        adjustmentType: parseAuditLine(block, "Tipo"),
        reason: parseAuditLine(block, "Motivo"),
        appliedBy: parseAuditLine(block, "Aplicado por"),
        originalValue: parseCurrencyText(parseAuditLine(block, "Valor original")),
        adjustedValue: parseCurrencyText(parseAuditLine(block, "Valor ajustado")),
        raw: block,
      };
    });
}

function makeInitialForm(): AdjustmentForm {
  return {
    adjustment_type: "renegociacion",
    adjustment_date: hoyISO(),
    reason: "",
    internal_notes: "",
    affects_commission: true,
    affects_inventory: false,
    requires_product_return: false,
    requires_new_appointment: false,
    new_service: "",
    new_total_value: "",
    new_cash_value: "",
    new_portfolio_value: "",
    inventory_notes: "",
    status: "ajuste_pendiente",
  };
}

function loadStoredDraft(caseId: string): StoredDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const drafts = JSON.parse(raw) as StoredDraft[];
    return drafts.find((item) => item.case_id === caseId) || null;
  } catch {
    return null;
  }
}

function saveStoredDraft(caseId: string, form: AdjustmentForm) {
  if (typeof window === "undefined") return;

  const nextDraft: StoredDraft = {
    ...form,
    case_id: caseId,
    saved_at: new Date().toISOString(),
  };

  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    const drafts = raw ? (JSON.parse(raw) as StoredDraft[]) : [];
    const filtered = drafts.filter((item) => item.case_id !== caseId);
    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify([nextDraft, ...filtered].slice(0, 30))
    );
  } catch {
  }
}

function removeStoredDraft(caseId: string) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    const drafts = JSON.parse(raw) as StoredDraft[];
    const filtered = drafts.filter((item) => item.case_id !== caseId);
    window.localStorage.setItem(draftStorageKey, JSON.stringify(filtered));
  } catch {
  }
}

export default function ComercialAjustesPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("finalizado");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [form, setForm] = useState<AdjustmentForm>(makeInitialForm());
  const [impactConfirmed, setImpactConfirmed] = useState(false);

  useEffect(() => {
    async function validateAndLoad() {
      try {
        setLoadingAuth(true);
        setError("");

        const auth = await getCurrentUserRole();
        if (!auth.user || !auth.roleCode || !allowedRoles.includes(auth.roleCode)) {
          setAuthorized(false);
          setError("No tienes permiso para entrar a retractos y renegociaciones.");
          return;
        }

        setAuthorized(true);
        setCurrentUserId(auth.user.id);

        const [casesResult, appointmentsResult, profilesResult] = await Promise.all([
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
              status,
              purchased_service,
              sale_value,
              payment_method,
              cash_amount,
              portfolio_amount,
              volume_amount,
              closing_notes,
              commercial_notes,
              lead_source_type,
              commission_source_type,
              call_user_id,
              opc_user_id,
              net_commission_base,
              counts_for_commission,
              counts_for_commercial_bonus,
              gross_bonus_base,
              created_at,
              closed_at
            `)
            .order("created_at", { ascending: false })
            .limit(250),
          supabase
            .from("appointments")
            .select(`
              id,
              lead_id,
              specialist_user_id,
              appointment_date,
              appointment_time,
              status,
              service_type
            `)
            .order("appointment_date", { ascending: false })
            .limit(500),
          supabase
            .from("profiles")
            .select("id, full_name")
            .order("full_name", { ascending: true }),
        ]);

        if (casesResult.error) throw casesResult.error;
        if (appointmentsResult.error) throw appointmentsResult.error;
        if (profilesResult.error) throw profilesResult.error;

        setCases((casesResult.data as CommercialCase[]) || []);
        setAppointments((appointmentsResult.data as AppointmentRow[]) || []);
        setUsers(
          (((profilesResult.data as Array<{ id: string; full_name: string }>) || [])).map(
            (item) => ({ id: item.id, full_name: item.full_name || "Sin nombre" })
          )
        );
      } catch (err: any) {
        setError(err?.message || "No se pudo cargar el modulo.");
      } finally {
        setLoading(false);
        setLoadingAuth(false);
      }
    }

    void validateAndLoad();
  }, []);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesStatus = statusFilter ? item.status === statusFilter : true;
      const matchesSearch = q
        ? item.customer_name.toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q)
        : true;
      return matchesStatus && matchesSearch;
    });
  }, [cases, search, statusFilter]);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  const relatedAppointments = useMemo(() => {
    if (!selectedCase) return [];
    return appointments.filter(
      (item) =>
        item.id === selectedCase.appointment_id ||
        (selectedCase.lead_id && item.lead_id === selectedCase.lead_id)
    );
  }, [appointments, selectedCase]);

  const allAdjustmentEntries = useMemo(
    () =>
      cases
        .flatMap((item) => extractAdjustmentAuditEntries(item))
        .sort((a, b) => b.adjustmentDate.localeCompare(a.adjustmentDate)),
    [cases]
  );

  const selectedCaseAdjustmentEntries = useMemo(() => {
    if (!selectedCase) return [];
    return extractAdjustmentAuditEntries(selectedCase).sort((a, b) =>
      b.adjustmentDate.localeCompare(a.adjustmentDate)
    );
  }, [selectedCase]);

  const adjustmentSummary = useMemo(() => {
    const total = allAdjustmentEntries.length;
    const retractos = allAdjustmentEntries.filter((item) =>
      item.adjustmentType.toLowerCase().includes("retracto")
    ).length;
    const renegociaciones = allAdjustmentEntries.filter(
      (item) =>
        item.adjustmentType.toLowerCase().includes("renegoci") ||
        item.adjustmentType.toLowerCase().includes("cambio") ||
        item.adjustmentType.toLowerCase().includes("descuento")
    ).length;
    const impact = allAdjustmentEntries.reduce(
      (acc, item) => acc + (item.adjustedValue - item.originalValue),
      0
    );

    return {
      total,
      retractos,
      renegociaciones,
      impact,
    };
  }, [allAdjustmentEntries]);

  const originalTotal = Number(selectedCase?.volume_amount || selectedCase?.sale_value || 0);
  const originalCash = Number(selectedCase?.cash_amount || selectedCase?.net_commission_base || 0);
  const originalPortfolio = Number(
    selectedCase?.portfolio_amount || Math.max(0, originalTotal - originalCash)
  );
  const originalCommissionBase = Number(selectedCase?.net_commission_base || originalCash);
  const originalBonusBase = Number(selectedCase?.gross_bonus_base || originalTotal);

  const calculatedNewTotal = useMemo(() => {
    if (form.adjustment_type === "retracto_total") return 0;
    return numberFromString(form.new_total_value);
  }, [form.adjustment_type, form.new_total_value]);

  const calculatedNewCash = useMemo(() => {
    if (form.adjustment_type === "retracto_total") return 0;
    return numberFromString(form.new_cash_value);
  }, [form.adjustment_type, form.new_cash_value]);

  const calculatedNewPortfolio = useMemo(() => {
    if (form.adjustment_type === "retracto_total") return 0;
    const explicit = numberFromString(form.new_portfolio_value);
    if (explicit > 0) return explicit;
    return Math.max(0, calculatedNewTotal - calculatedNewCash);
  }, [form.adjustment_type, form.new_portfolio_value, calculatedNewTotal, calculatedNewCash]);

  const adjustedCommissionBase = form.affects_commission
    ? calculatedNewCash
    : originalCommissionBase;
  const adjustedBonusBase = form.affects_commission ? calculatedNewTotal : originalBonusBase;
  const valueDifference = calculatedNewTotal - originalTotal;
  const cashDifference = calculatedNewCash - originalCash;
  const portfolioDifference = calculatedNewPortfolio - originalPortfolio;

  function setValue<K extends keyof AdjustmentForm>(key: K, value: AdjustmentForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function startAdjustment(caseItem: CommercialCase) {
    const draft = loadStoredDraft(caseItem.id);
    const caseTotal = Number(caseItem.volume_amount || caseItem.sale_value || 0);
    const caseCash = Number(caseItem.cash_amount || caseItem.net_commission_base || 0);
    const casePortfolio = Number(
      caseItem.portfolio_amount || Math.max(0, caseTotal - caseCash)
    );

    setSelectedCaseId(caseItem.id);
    setImpactConfirmed(false);
    setMessage("");
    setError("");

    if (draft) {
      setForm({
        adjustment_type: draft.adjustment_type,
        adjustment_date: draft.adjustment_date,
        reason: draft.reason,
        internal_notes: draft.internal_notes,
        affects_commission: draft.affects_commission,
        affects_inventory: draft.affects_inventory,
        requires_product_return: draft.requires_product_return,
        requires_new_appointment: draft.requires_new_appointment,
        new_service: draft.new_service,
        new_total_value: draft.new_total_value,
        new_cash_value: draft.new_cash_value,
        new_portfolio_value: draft.new_portfolio_value,
        inventory_notes: draft.inventory_notes,
        status: draft.status,
      });
      setMessage("Se cargo un borrador local guardado para este caso.");
      return;
    }

    setForm({
      ...makeInitialForm(),
      new_service: caseItem.purchased_service || "",
      new_total_value: String(caseTotal || ""),
      new_cash_value: String(caseCash || ""),
      new_portfolio_value: String(casePortfolio || ""),
    });
  }

  function saveDraft() {
    if (!selectedCaseId) return;
    saveStoredDraft(selectedCaseId, form);
    setMessage("Borrador guardado en este navegador para seguirlo afinando luego.");
  }

  function clearDraft() {
    if (!selectedCaseId) return;
    removeStoredDraft(selectedCaseId);
    setForm(makeInitialForm());
    setImpactConfirmed(false);
    setMessage("Borrador local eliminado.");
  }

  function handleCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImpactConfirmed(true);
    setMessage("Impacto calculado. Revisa el comparativo antes de la fase de aplicacion.");
  }

  function userName(userId: string | null | undefined) {
    if (!userId) return "Sin definir";
    return users.find((item) => item.id === userId)?.full_name || "Usuario no visible";
  }

  async function applyAdjustment() {
    if (!selectedCase || !selectedCaseId || !currentUserId) {
      setError("Selecciona un caso valido antes de aplicar el ajuste.");
      return;
    }

    if (!impactConfirmed) {
      setError("Calcula primero el impacto para revisar el comparativo antes de aplicar.");
      return;
    }

    if (!form.reason.trim()) {
      setError("Debes registrar el motivo del ajuste.");
      return;
    }

    const nextTotal = calculatedNewTotal;
    const nextCash = calculatedNewCash;
    const nextPortfolio = calculatedNewPortfolio;
    const nextCommissionBase = adjustedCommissionBase;
    const nextBonusBase = adjustedBonusBase;
    const nextService =
      form.adjustment_type === "retracto_total"
        ? null
        : form.new_service || selectedCase.purchased_service || null;

    const before: CaseSnapshot = {
      total: originalTotal,
      cash: originalCash,
      portfolio: originalPortfolio,
      commissionBase: originalCommissionBase,
      bonusBase: originalBonusBase,
      service: selectedCase.purchased_service,
    };

    const after: CaseSnapshot = {
      total: nextTotal,
      cash: nextCash,
      portfolio: nextPortfolio,
      commissionBase: nextCommissionBase,
      bonusBase: nextBonusBase,
      service: nextService,
    };

    const existingNotes = parseStoredCommercialNotes(selectedCase.commercial_notes);
    const auditBlock = buildAdjustmentAuditBlock({
      userName: userName(currentUserId),
      selectedCase,
      form,
      before,
      after,
    });
    const mergedCommercialNotes = [
      existingNotes.commercialNotes,
      auditBlock,
    ]
      .filter(Boolean)
      .join("\n\n");

    const mergedClosingNotes = [selectedCase.closing_notes || "", auditBlock]
      .filter(Boolean)
      .join("\n\n");

    const countsForCommission = form.affects_commission
      ? nextCommissionBase > 0 && nextTotal > 0
      : Boolean(selectedCase.counts_for_commission);
    const countsForCommercialBonus = form.affects_commission
      ? nextBonusBase > 0 && nextTotal > 0
      : Boolean(selectedCase.counts_for_commercial_bonus);

    try {
      setApplying(true);
      setError("");
      setMessage("");

      const updatePayload = {
        purchased_service: nextService,
        sale_value: nextTotal || null,
        cash_amount: nextCash || null,
        portfolio_amount: nextPortfolio || null,
        volume_amount: nextTotal || null,
        net_commission_base: nextCommissionBase || null,
        gross_bonus_base: nextBonusBase || null,
        counts_for_commission: countsForCommission,
        counts_for_commercial_bonus: countsForCommercialBonus,
        commercial_notes: buildStoredCommercialNotes(
          existingNotes.receptionSummary,
          mergedCommercialNotes
        ),
        closing_notes: mergedClosingNotes || null,
        updated_by_user_id: currentUserId,
      };

      const { error: updateError } = await supabase
        .from("commercial_cases")
        .update(updatePayload)
        .eq("id", selectedCaseId);

      if (updateError) throw updateError;

      setCases((prev) =>
        prev.map((item) =>
          item.id === selectedCaseId
            ? {
                ...item,
                purchased_service: nextService,
                sale_value: nextTotal || null,
                cash_amount: nextCash || null,
                portfolio_amount: nextPortfolio || null,
                volume_amount: nextTotal || null,
                net_commission_base: nextCommissionBase || null,
                gross_bonus_base: nextBonusBase || null,
                counts_for_commission: countsForCommission,
                counts_for_commercial_bonus: countsForCommercialBonus,
                commercial_notes: buildStoredCommercialNotes(
                  existingNotes.receptionSummary,
                  mergedCommercialNotes
                ),
                closing_notes: mergedClosingNotes || null,
              }
            : item
        )
      );

      removeStoredDraft(selectedCaseId);
      setMessage(
        form.requires_new_appointment
          ? "Ajuste aplicado al caso. La nueva cita queda pendiente para programarla desde agenda."
          : "Ajuste aplicado correctamente sobre el caso comercial."
      );
      setImpactConfirmed(false);
    } catch (err: any) {
      setError(err?.message || "No se pudo aplicar el ajuste.");
    } finally {
      setApplying(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#F6FBF7] p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className={cardClass}>Validando acceso...</div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F6FBF7] p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className={cardClass}>
            <p className="text-sm font-medium text-red-700">
              {error || "No tienes permiso para esta vista."}
            </p>
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,236,221,0.52),_rgba(246,251,247,0.98)_46%,_rgba(244,249,245,1)_100%)] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
            <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain p-1" priority />
          </div>
        </div>

        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-[#D6E8DA] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#66826F] shadow-sm">
                Ajustes comerciales
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[#24312A] md:text-6xl">
                Retractos y renegociaciones
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-9 text-[#4F675C]">
                Este primer corte prepara el ajuste de forma segura: buscas el caso original,
                defines la novedad y ves el impacto financiero y comisional sin tocar todavia
                la venta original.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                >
                  Inicio
                </Link>
                <Link
                  href="/gerencia/comercial"
                  className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                >
                  Gerencia comercial
                </Link>
              </div>
            </div>
            <SessionBadge />
          </div>
        </section>

        {error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-[24px] border border-[#BFE0C8] bg-[#EDF8F0] px-5 py-4 text-sm text-[#335343]">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5 shadow-[0_18px_36px_rgba(95,125,102,0.10)]">
            <p className="text-sm font-semibold text-[#5B6E63]">Ajustes aplicados</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{adjustmentSummary.total}</p>
            <p className="mt-2 text-xs text-[#6B7F74]">Historial detectado dentro de casos comerciales.</p>
          </div>
          <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5 shadow-[0_18px_36px_rgba(95,125,102,0.10)]">
            <p className="text-sm font-semibold text-[#5B6E63]">Retractos</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{adjustmentSummary.retractos}</p>
            <p className="mt-2 text-xs text-[#6B7F74]">Total de retractos parciales o totales aplicados.</p>
          </div>
          <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5 shadow-[0_18px_36px_rgba(95,125,102,0.10)]">
            <p className="text-sm font-semibold text-[#5B6E63]">Renegociaciones</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{adjustmentSummary.renegociaciones}</p>
            <p className="mt-2 text-xs text-[#6B7F74]">Incluye cambios de plan y descuentos extraordinarios.</p>
          </div>
          <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5 shadow-[0_18px_36px_rgba(95,125,102,0.10)]">
            <p className="text-sm font-semibold text-[#5B6E63]">Impacto neto</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{formatMoney(adjustmentSummary.impact)}</p>
            <p className="mt-2 text-xs text-[#6B7F74]">Suma de diferencia entre valor original y valor ajustado.</p>
          </div>
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[#24312A]">Buscar caso original</h2>
              <p className="mt-2 text-sm leading-7 text-[#5C7568]">
                Fase 1 trabaja sobre el caso ya vendido o en gestion. La aplicacion real del
                ajuste vendra en la siguiente fase con una tabla propia de movimientos.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <input
                className={inputClass}
                placeholder="Buscar por cliente, telefono o ciudad"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={inputClass}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="finalizado">Finalizados</option>
                <option value="en_atencion_comercial">En atencion</option>
                <option value="asignado_comercial">Asignados</option>
                <option value="seguimiento_comercial">Seguimiento</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#CFE4D8] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                Cargando casos comerciales...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CFE4D8] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                No hay casos visibles con esos filtros.
              </div>
            ) : (
              filteredCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => startAdjustment(item)}
                  className={`rounded-[26px] border p-5 text-left transition ${
                    selectedCaseId === item.id
                      ? "border-[#7FA287] bg-[#EEF7F1] shadow-[0_16px_30px_rgba(95,125,102,0.12)]"
                      : "border-[#D7E8DC] bg-white/90 hover:border-[#BCD7C2]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-[#24312A]">{item.customer_name}</h3>
                    <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#5C7568] md:grid-cols-2">
                    <p>
                      {item.phone || "Sin telefono"} · {item.city || "Sin ciudad"}
                    </p>
                    <p>Servicio: {serviceLabel(item.purchased_service)}</p>
                    <p>Valor original: {formatMoney(item.volume_amount || item.sale_value)}</p>
                    <p>Fecha: {formatDateTime(item.closed_at || item.created_at)}</p>
                    <p>Fuente comision: {sourceLabel(item.commission_source_type)}</p>
                    <p>Comercial: {userName(item.assigned_commercial_user_id)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#6A8573]">
                  Resumen del caso original
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-[#24312A]">
                  {selectedCase ? selectedCase.customer_name : "Selecciona un caso"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5C7568]">
                  Aqui revisas la venta original antes de preparar el retracto o la renegociacion.
                  El caso original sigue intacto en esta fase.
                </p>
              </div>
              {selectedCase ? (
                <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-4 py-2 text-sm font-semibold text-[#4F6F5B]">
                  {statusLabel(selectedCase.status)}
                </span>
              ) : null}
            </div>

            {!selectedCase ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F8FBF9] p-6 text-sm text-[#5C7568]">
                Elige primero un caso comercial en la parte superior para habilitar el formulario
                del ajuste.
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Cliente
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#24312A]">
                      {selectedCase.customer_name}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Contacto
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#24312A]">
                      {selectedCase.phone || "Sin telefono"}
                    </p>
                    <p className="mt-1 text-sm text-[#5C7568]">{selectedCase.city || "Sin ciudad"}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Servicio
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#24312A]">
                      {serviceLabel(selectedCase.purchased_service)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Venta original
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#24312A]">{formatMoney(originalTotal)}</p>
                    <p className="mt-1 text-sm text-[#5C7568]">
                      Contado {formatMoney(originalCash)} · Cartera {formatMoney(originalPortfolio)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Comision
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#24312A]">
                      Base {formatMoney(originalCommissionBase)}
                    </p>
                    <p className="mt-1 text-sm text-[#5C7568]">
                      Bono {formatMoney(originalBonusBase)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[#D6E8DA] bg-white/92 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6A8573]">
                      Trazabilidad
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#24312A]">
                      Fuente lead {sourceLabel(selectedCase.lead_source_type)}
                    </p>
                    <p className="mt-1 text-sm text-[#5C7568]">
                      Fuente comision {sourceLabel(selectedCase.commission_source_type)}
                    </p>
                    <p className="mt-1 text-sm text-[#5C7568]">
                      Comercial {userName(selectedCase.assigned_commercial_user_id)}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#D6E8DA] bg-[#F8FBF9] p-5">
                  <h3 className="text-lg font-semibold text-[#24312A]">Citas y continuidad asociada</h3>
                  {relatedAppointments.length === 0 ? (
                    <p className="mt-3 text-sm text-[#5C7568]">
                      No hay citas ligadas visibles para este caso.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {relatedAppointments.slice(0, 6).map((appointment) => (
                        <div
                          key={appointment.id}
                          className="rounded-[20px] border border-[#D6E8DA] bg-white/92 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-sm text-[#24312A]">
                            <span className="font-semibold">
                              {appointment.appointment_date} · {appointment.appointment_time}
                            </span>
                            <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-2.5 py-1 text-xs font-semibold text-[#4F6F5B]">
                              {appointment.status}
                            </span>
                            <span className="text-[#5C7568]">{serviceLabel(appointment.service_type)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[#24312A]">
                      Historial de ajustes del caso
                    </h3>
                    <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                      {selectedCaseAdjustmentEntries.length} ajustes
                    </span>
                  </div>
                  {selectedCaseAdjustmentEntries.length === 0 ? (
                    <p className="mt-3 text-sm text-[#5C7568]">
                      Este caso todavia no tiene ajustes aplicados desde el modulo.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {selectedCaseAdjustmentEntries.map((entry, index) => (
                        <div
                          key={`${entry.caseId}-${entry.adjustmentDate}-${index}`}
                          className="rounded-[20px] border border-[#D6E8DA] bg-[#F8FBF9] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#D6E8DA] bg-white px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                              {entry.adjustmentType || "Ajuste"}
                            </span>
                            <span className="text-sm font-semibold text-[#24312A]">
                              {entry.adjustmentDate || "Sin fecha"}
                            </span>
                            <span className="text-sm text-[#5C7568]">
                              por {entry.appliedBy || "Usuario no visible"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-[#5C7568]">
                            {entry.reason || "Sin motivo registrado"}
                          </p>
                          <p className="mt-2 text-sm text-[#24312A]">
                            {formatMoney(entry.originalValue)} → {formatMoney(entry.adjustedValue)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={`${cardClass} space-y-6`}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#6A8573]">
                Tipo de ajuste
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#24312A]">Preparar novedad</h2>
              <p className="mt-2 text-sm leading-7 text-[#5C7568]">
                Define el tipo de retracto, renegociacion o cambio de plan. Todavia no se aplica
                sobre base de datos: esta primera fase calcula y deja borrador.
              </p>
            </div>

            {!selectedCase ? (
              <div className="rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F8FBF9] p-6 text-sm text-[#5C7568]">
                Selecciona un caso para habilitar el formulario del ajuste.
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleCalculate}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Tipo de novedad"
                    input={
                      <select
                        className={inputClass}
                        value={form.adjustment_type}
                        onChange={(e) =>
                          setValue("adjustment_type", e.target.value as AdjustmentType)
                        }
                      >
                        {adjustmentTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <Field
                    label="Fecha real del ajuste"
                    input={
                      <input
                        className={inputClass}
                        type="date"
                        value={form.adjustment_date}
                        onChange={(e) => setValue("adjustment_date", e.target.value)}
                      />
                    }
                  />
                </div>

                <Field
                  label="Motivo principal"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-y`}
                      placeholder="Explica por que se va a retractar, renegociar o cambiar el plan."
                      value={form.reason}
                      onChange={(e) => setValue("reason", e.target.value)}
                    />
                  }
                />

                <Field
                  label="Observaciones internas"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-y`}
                      placeholder="Notas para gerencia, auditoria o cartera."
                      value={form.internal_notes}
                      onChange={(e) => setValue("internal_notes", e.target.value)}
                    />
                  }
                />

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { key: "affects_commission" as const, label: "Afecta comision" },
                    { key: "affects_inventory" as const, label: "Afecta inventario" },
                    {
                      key: "requires_product_return" as const,
                      label: "Requiere devolucion de producto",
                    },
                    { key: "requires_new_appointment" as const, label: "Requiere nueva cita" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 rounded-[22px] border border-[#D6E8DA] bg-white/92 px-4 py-4 text-sm font-medium text-[#365243]"
                    >
                      <input
                        type="checkbox"
                        checked={form[item.key]}
                        onChange={(e) => setValue(item.key, e.target.checked)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                <div className="rounded-[24px] border border-[#D6E8DA] bg-[#F8FBF9] p-5">
                  <h3 className="text-lg font-semibold text-[#24312A]">Datos ajustados</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Nuevo servicio o plan"
                      input={
                        <select
                          className={inputClass}
                          value={form.new_service}
                          onChange={(e) => setValue("new_service", e.target.value)}
                        >
                          {serviceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      }
                    />
                    <Field
                      label="Estado del borrador"
                      input={
                        <select
                          className={inputClass}
                          value={form.status}
                          onChange={(e) =>
                            setValue("status", e.target.value as AdjustmentStatus)
                          }
                        >
                          <option value="ajuste_pendiente">Ajuste pendiente</option>
                          <option value="ajuste_aprobado">Ajuste aprobado</option>
                          <option value="ajuste_rechazado">Ajuste rechazado</option>
                        </select>
                      }
                    />
                    <Field
                      label="Nuevo valor total"
                      input={
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          placeholder="Ej. 2000000"
                          value={form.new_total_value}
                          onChange={(e) =>
                            setValue("new_total_value", normalizeMoneyString(e.target.value))
                          }
                        />
                      }
                    />
                    <Field
                      label="Nuevo valor contado"
                      input={
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          placeholder="Ej. 800000"
                          value={form.new_cash_value}
                          onChange={(e) =>
                            setValue("new_cash_value", normalizeMoneyString(e.target.value))
                          }
                        />
                      }
                    />
                    <Field
                      label="Nuevo valor cartera"
                      input={
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          placeholder="Ej. 1200000"
                          value={form.new_portfolio_value}
                          onChange={(e) =>
                            setValue(
                              "new_portfolio_value",
                              normalizeMoneyString(e.target.value)
                            )
                          }
                        />
                      }
                    />
                    <Field
                      label="Nota de inventario o devolucion"
                      input={
                        <input
                          className={inputClass}
                          placeholder="Ej. se reintegran 2 cajas de producto"
                          value={form.inventory_notes}
                          onChange={(e) => setValue("inventory_notes", e.target.value)}
                        />
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex rounded-full bg-[#567E63] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(86,126,99,0.26)] transition hover:brightness-105"
                  >
                    Calcular impacto
                  </button>
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-6 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                  >
                    Guardar borrador
                  </button>
                  <button
                    type="button"
                    onClick={clearDraft}
                    className="inline-flex rounded-full border border-[#F1D8D8] bg-white px-6 py-3 text-sm font-semibold text-[#A44949] shadow-sm transition hover:border-[#D79A9A]"
                  >
                    Limpiar borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyAdjustment()}
                    disabled={applying}
                    className="inline-flex rounded-full bg-[#2F5B44] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(47,91,68,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {applying ? "Aplicando..." : "Aprobar y aplicar ajuste"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <section className={cardClass}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#6A8573]">
                Impacto financiero y comisional
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#24312A]">
                Comparativo del ajuste
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#5C7568]">
                Aqui ves el antes y despues de la renegociacion. En esta fase el calculo es
                visual y no altera todavia el caso original.
              </p>
            </div>
            <div className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-4 py-2 text-sm font-semibold text-[#4F6F5B]">
              {impactConfirmed ? "Impacto revisado" : "Pendiente por calcular"}
            </div>
          </div>

          {!selectedCase ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F8FBF9] p-6 text-sm text-[#5C7568]">
              Selecciona un caso y completa el formulario para ver el impacto financiero.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: "Valor original",
                    original: formatMoney(originalTotal),
                    adjusted: formatMoney(calculatedNewTotal),
                    diff: formatMoney(valueDifference),
                  },
                  {
                    title: "Contado",
                    original: formatMoney(originalCash),
                    adjusted: formatMoney(calculatedNewCash),
                    diff: formatMoney(cashDifference),
                  },
                  {
                    title: "Cartera",
                    original: formatMoney(originalPortfolio),
                    adjusted: formatMoney(calculatedNewPortfolio),
                    diff: formatMoney(portfolioDifference),
                  },
                  {
                    title: "Base comisionable",
                    original: formatMoney(originalCommissionBase),
                    adjusted: formatMoney(adjustedCommissionBase),
                    diff: formatMoney(adjustedCommissionBase - originalCommissionBase),
                  },
                  {
                    title: "Base bono",
                    original: formatMoney(originalBonusBase),
                    adjusted: formatMoney(adjustedBonusBase),
                    diff: formatMoney(adjustedBonusBase - originalBonusBase),
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5"
                  >
                    <p className="text-sm font-semibold text-[#5B6E63]">{item.title}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-[#5C7568]">
                        Original <span className="font-semibold text-[#24312A]">{item.original}</span>
                      </p>
                      <p className="text-[#5C7568]">
                        Ajustado <span className="font-semibold text-[#24312A]">{item.adjusted}</span>
                      </p>
                      <p className="text-[#5C7568]">
                        Diferencia <span className="font-semibold text-[#24312A]">{item.diff}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-[#D6E8DA] bg-[#F8FBF9] p-5">
                  <h3 className="text-lg font-semibold text-[#24312A]">Decision sugerida</h3>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-[#5C7568]">
                    <p>
                      Tipo de ajuste{" "}
                      <span className="font-semibold text-[#24312A]">
                        {
                          adjustmentTypeOptions.find(
                            (option) => option.value === form.adjustment_type
                          )?.label
                        }
                      </span>
                    </p>
                    <p>
                      Nuevo plan{" "}
                      <span className="font-semibold text-[#24312A]">
                        {serviceLabel(form.new_service)}
                      </span>
                    </p>
                    <p>
                      Inventario{" "}
                      <span className="font-semibold text-[#24312A]">
                        {form.affects_inventory ? "Afectado" : "Sin cambio"}
                      </span>
                    </p>
                    <p>
                      Requiere nueva cita{" "}
                      <span className="font-semibold text-[#24312A]">
                        {form.requires_new_appointment ? "Si" : "No"}
                      </span>
                    </p>
                    <p>
                      Responsable actual{" "}
                      <span className="font-semibold text-[#24312A]">
                        {userName(selectedCase.assigned_commercial_user_id)}
                      </span>
                    </p>
                    <p>
                      Borrador preparado por{" "}
                      <span className="font-semibold text-[#24312A]">
                        {userName(currentUserId)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5">
                  <h3 className="text-lg font-semibold text-[#24312A]">Alcance de esta fase</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-[#5C7568]">
                    <li>Busca casos reales ya vendidos o en gestion.</li>
                    <li>Calcula impacto financiero y comisional.</li>
                    <li>Guarda borradores locales por caso.</li>
                    <li>Aplica el ajuste directamente sobre el caso comercial seleccionado.</li>
                    <li>Deja auditoria textual del antes y despues dentro del mismo caso.</li>
                    <li>La nueva cita e inventario siguen siendo pasos manuales en esta fase.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#6A8573]">
                Reporte rapido
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-[#24312A]">
                Ultimos ajustes aplicados
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#5C7568]">
                Este tablero toma los ajustes guardados dentro de los casos comerciales y te deja
                revisar rapido que se ha renegociado, retractado o descontado.
              </p>
            </div>
            <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-4 py-2 text-sm font-semibold text-[#4F6F5B]">
              {allAdjustmentEntries.length} movimientos detectados
            </span>
          </div>

          {allAdjustmentEntries.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-[#CFE4D8] bg-[#F8FBF9] p-6 text-sm text-[#5C7568]">
              Aun no hay ajustes aplicados para reportar.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {allAdjustmentEntries.slice(0, 8).map((entry, index) => (
                <div
                  key={`${entry.caseId}-${entry.adjustmentDate}-${index}`}
                  className="rounded-[24px] border border-[#D6E8DA] bg-white/92 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#24312A]">{entry.caseName}</h3>
                    <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                      {entry.adjustmentType || "Ajuste"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-[#5C7568]">
                    <p>Fecha: <span className="font-semibold text-[#24312A]">{entry.adjustmentDate || "Sin fecha"}</span></p>
                    <p>Aplicado por: <span className="font-semibold text-[#24312A]">{entry.appliedBy || "Usuario no visible"}</span></p>
                    <p>Motivo: <span className="font-semibold text-[#24312A]">{entry.reason || "Sin motivo"}</span></p>
                    <p>
                      Valor: <span className="font-semibold text-[#24312A]">{formatMoney(entry.originalValue)}</span>
                      {" "}→{" "}
                      <span className="font-semibold text-[#24312A]">{formatMoney(entry.adjustedValue)}</span>
                    </p>
                    <p className="text-[#365243]">
                      Caso: <span className="font-semibold">{entry.caseId}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
