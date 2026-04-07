"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

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

function traducirEstado(status: string | null) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente asignación",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atención",
    seguimiento_comercial: "Seguimiento",
    finalizado: "Finalizado",
  };

  if (!status) return "Sin estado";
  return map[status] || status;
}

function estadoBadge(status: string | null) {
  switch (status) {
    case "pendiente_asignacion_comercial":
      return "bg-amber-100 text-amber-700";
    case "asignado_comercial":
      return "bg-blue-100 text-blue-700";
    case "en_atencion_comercial":
      return "bg-cyan-100 text-cyan-700";
    case "seguimiento_comercial":
      return "bg-violet-100 text-violet-700";
    case "finalizado":
      return "bg-slate-200 text-slate-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return "Sin fecha";
  try {
    return new Date(dateString).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateString;
  }
}

function hoyISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function ahoraHora() {
  const now = new Date();
  return now.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function esVentaReal(item: CommercialCase) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0) ||
    (item.volume_amount && Number(item.volume_amount) > 0)
  );
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
        !/^Fecha primera cuota:/i.test(line)
    );

  return lines.join("\n").trim();
}

function buildClosingNotes(baseText: string, portfolio: PortfolioFields, portfolioAmount: number) {
  const lines = [stripPortfolioDetails(baseText)].filter(Boolean);

  if (portfolioAmount > 0) {
    lines.push("Detalle cartera:");
    if (portfolio.installments_count) {
      lines.push(`Número de cuotas: ${portfolio.installments_count}`);
    }
    if (portfolio.installment_value) {
      lines.push(`Valor de la cuota: ${portfolio.installment_value}`);
    }
    if (portfolio.first_installment_date) {
      lines.push(`Fecha primera cuota: ${portfolio.first_installment_date}`);
    }
  }

  return lines.join("\n").trim() || null;
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

  const calculatedVolume = useMemo(() => numberFromString(form.volume_amount), [form.volume_amount]);
  const calculatedCash = useMemo(() => numberFromString(form.cash_amount), [form.cash_amount]);
  const calculatedPortfolio = useMemo(
    () => Math.max(0, calculatedVolume - calculatedCash),
    [calculatedCash, calculatedVolume]
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      portfolio_amount: calculatedPortfolio ? String(calculatedPortfolio) : "",
    }));
  }, [calculatedPortfolio]);

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

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return cases.filter((item) => {
      const searchOk = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q)
        : true;

      const statusOk = statusFilter ? item.status === statusFilter : true;

      return searchOk && statusOk;
    });
  }, [cases, search, statusFilter]);

  const resumen = useMemo(() => {
    return {
      total: cases.length,
      activos: cases.filter((x) =>
        ["asignado_comercial", "en_atencion_comercial", "seguimiento_comercial"].includes(
          x.status
        )
      ).length,
      vendidos: cases.filter((x) => x.status === "finalizado" && esVentaReal(x)).length,
      seguimiento: cases.filter((x) => x.status === "seguimiento_comercial").length,
      noVendidos: cases.filter((x) => x.status === "finalizado" && !esVentaReal(x)).length,
    };
  }, [cases]);

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
      setPortfolioForm(portfolioData);

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
      const statusFinal = finalizar ? "finalizado" : "en_atencion_comercial";
      const volumeNumber = numberFromString(form.volume_amount);
      const cashNumber = numberFromString(form.cash_amount);
      const portfolioNumber = Math.max(0, volumeNumber - cashNumber);
      const closingNotes = buildClosingNotes(form.closing_notes, portfolioForm, portfolioNumber);
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

      const updatePayload: any = {
        status: statusFinal,
        commercial_notes: form.commercial_notes.trim() || null,
        sales_assessment: form.sales_assessment.trim() || null,
        proposal_text: form.proposal_text.trim() || null,
        sale_result: preservedReceptionSummary,
        purchased_service: form.purchased_service || null,
        sale_value: volumeNumber || null,
        payment_method: form.payment_method || null,
        cash_amount: cashNumber || null,
        portfolio_amount: portfolioNumber || null,
        volume_amount: volumeNumber || null,
        closing_notes: closingNotes,
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

      const hayVenta = volumeNumber > 0 || !!form.purchased_service;

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
          ? "Caso finalizado correctamente."
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

  const receptionSummary = currentCase ? getReceptionSummary(currentCase) : [];

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Gestión comercial</h1>
              <p className="mt-3 text-sm text-slate-600">
                Atiende tus casos, registra ventas y agenda la siguiente continuidad.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4">
            <a
              href="/"
              className="inline-flex rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Inicio
            </a>
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

        <section className="mb-6 grid gap-4 md:grid-cols-5">
          <StatCard title="Casos" value={String(resumen.total)} />
          <StatCard title="Activos" value={String(resumen.activos)} />
          <StatCard title="Vendidos" value={String(resumen.vendidos)} />
          <StatCard title="Seguimiento" value={String(resumen.seguimiento)} />
          <StatCard title="No vendidos" value={String(resumen.noVendidos)} />
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
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
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
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
                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-cyan-900">Estado del caso:</span>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-800">
                      En atención
                    </span>
                    {currentCase?.assigned_at ? (
                      <span className="text-sm text-cyan-900">
                        Desde: {formatDate(currentCase.assigned_at)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {currentCase ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">Información recibida desde recepción</h3>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                      <InfoItem label="Cliente" value={currentCase.customer_name} />
                      <InfoItem label="Teléfono" value={currentCase.phone || "Sin teléfono"} />
                      <InfoItem label="Ciudad" value={currentCase.city || "Sin ciudad"} />
                      <InfoItem label="Ingreso comercial" value={formatDate(currentCase.created_at)} />
                    </div>

                    {receptionSummary.length > 0 ? (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                        <p className="mb-2 text-sm font-semibold text-slate-800">
                          Resumen registrado en recepción
                        </p>
                        <ul className="space-y-2 text-sm text-slate-700">
                          {receptionSummary.map((line, index) => (
                            <li key={index}>• {line}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
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
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
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
                            className={inputClass}
                            inputMode="numeric"
                            value={formatMoneyDisplay(portfolioForm.installment_value)}
                            onChange={(e) =>
                              setPortfolioForm((prev) => ({
                                ...prev,
                                installment_value: normalizeMoneyString(e.target.value),
                              }))
                            }
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-lg font-semibold text-slate-900">
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

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void guardarCaso(false)}
                    disabled={saving}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-700 disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar avances"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void guardarCaso(true)}
                    disabled={saving}
                    className="rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Finalizar caso"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Casos visibles</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Busca por cliente o teléfono y filtra por estado.
                </p>
              </div>

              <button
                onClick={() => void cargarDatos()}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Actualizar
              </button>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                placeholder="Buscar por cliente o teléfono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="asignado_comercial">Asignado</option>
                <option value="en_atencion_comercial">En atención</option>
                <option value="seguimiento_comercial">Seguimiento</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando casos...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay casos visibles.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCases.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {item.customer_name}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs ${estadoBadge(item.status)}`}
                            >
                              {traducirEstado(item.status)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {item.phone || "Sin teléfono"} · {item.city || "Sin ciudad"}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Asignado: {formatDate(item.assigned_at)}
                          </p>

                          {item.purchased_service ? (
                            <p className="mt-1 text-sm text-slate-600">
                              Servicio adquirido: {item.purchased_service}
                            </p>
                          ) : null}

                          {item.volume_amount || item.sale_value ? (
                            <p className="mt-1 text-sm text-slate-600">
                              Volumen: $
                              {Number(item.volume_amount || item.sale_value || 0).toLocaleString("es-CO")}
                            </p>
                          ) : null}

                          {item.next_appointment_created ? (
                            <p className="mt-1 text-sm text-green-700">
                              Siguiente cita creada
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => void iniciarAtencion(item)}
                          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Atender
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  input,
}: {
  label: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {input}
    </label>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-slate-800">{label}:</span> {value}
    </p>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-500";
