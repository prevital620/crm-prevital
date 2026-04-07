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

const caseStatusOptions = [
  { value: "asignado_comercial", label: "Asignado" },
  { value: "en_atencion_comercial", label: "En atención" },
  { value: "seguimiento_comercial", label: "Seguimiento" },
  { value: "finalizado", label: "Finalizado" },
];

const purchasedServiceOptions = [
  { value: "", label: "Selecciona" },
  { value: "valoracion", label: "Valoración" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutrición" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "plan_integral", label: "Plan integral" },
  { value: "otro", label: "Otro" },
];

const paymentMethodOptions = [
  { value: "", label: "Selecciona" },
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "mixto", label: "Mixto" },
  { value: "otro", label: "Otro" },
];

const nextStepOptions = [
  { value: "", label: "Sin siguiente cita" },
  { value: "especialista", label: "Especialista" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "valoracion", label: "Valoración" },
  { value: "nutricion", label: "Nutrición" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "otro", label: "Otro" },
];

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
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ahoraHora() {
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mm = String(ahora.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function esVentaReal(item: CommercialCase) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0)
  );
}

export default function ComercialPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    status: "asignado_comercial",
    commercial_notes: "",
    sales_assessment: "",
    proposal_text: "",
    purchased_service: "",
    sale_value: "",
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
            full_name: row.full_name,
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
          (item.phone || "").toLowerCase().includes(q)
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
      vendidos: cases.filter(
        (x) => x.status === "finalizado" && esVentaReal(x)
      ).length,
      seguimiento: cases.filter((x) => x.status === "seguimiento_comercial").length,
      noVendidos: cases.filter(
        (x) => x.status === "finalizado" && !esVentaReal(x)
      ).length,
    };
  }, [cases]);

  function cargarCasoParaEditar(item: CommercialCase) {
    setEditingCaseId(item.id);
    setForm({
      status: item.status || "asignado_comercial",
      commercial_notes: item.commercial_notes || "",
      sales_assessment: item.sales_assessment || "",
      proposal_text: item.proposal_text || "",
      purchased_service: item.purchased_service || "",
      sale_value: item.sale_value ? String(item.sale_value) : "",
      payment_method: item.payment_method || "",
      cash_amount: item.cash_amount ? String(item.cash_amount) : "",
      portfolio_amount: item.portfolio_amount ? String(item.portfolio_amount) : "",
      volume_amount: item.volume_amount ? String(item.volume_amount) : "",
      closing_notes: item.closing_notes || "",
      next_step_type: item.next_step_type || "",
      next_appointment_date: item.next_appointment_date || hoyISO(),
      next_appointment_time: item.next_appointment_time
        ? item.next_appointment_time.slice(0, 5)
        : ahoraHora(),
      next_specialist_user_id: item.next_specialist_user_id || "",
      next_notes: item.next_notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingCaseId(null);
    setForm({
      status: "asignado_comercial",
      commercial_notes: "",
      sales_assessment: "",
      proposal_text: "",
      purchased_service: "",
      sale_value: "",
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
  }

  async function guardarCaso(e: React.FormEvent) {
    e.preventDefault();

    if (!editingCaseId || !currentUserId) {
      setError("No se encontró el caso o el usuario actual.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const statusFinal = form.status;

      const updatePayload: any = {
        status: statusFinal,
        commercial_notes: form.commercial_notes.trim() || null,
        sales_assessment: form.sales_assessment.trim() || null,
        proposal_text: form.proposal_text.trim() || null,
        sale_result:
          form.purchased_service || form.sale_value
            ? "ganada"
            : statusFinal === "seguimiento_comercial"
            ? "pendiente"
            : statusFinal === "finalizado"
            ? "perdida"
            : null,
        purchased_service: form.purchased_service || null,
        sale_value: form.sale_value ? Number(form.sale_value) : null,
        payment_method: form.payment_method || null,
        cash_amount: form.cash_amount ? Number(form.cash_amount) : null,
        portfolio_amount: form.portfolio_amount ? Number(form.portfolio_amount) : null,
        volume_amount: form.volume_amount ? Number(form.volume_amount) : null,
        closing_notes: form.closing_notes.trim() || null,
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

      const currentCase = cases.find((item) => item.id === editingCaseId);

      const hayVenta =
        !!form.purchased_service || !!form.sale_value || !!form.cash_amount || !!form.volume_amount;

      if (
        statusFinal === "finalizado" &&
        hayVenta &&
        form.next_step_type &&
        !currentCase?.next_appointment_created
      ) {
        const { data: appointmentData, error: appointmentError } = await supabase
          .from("appointments")
          .insert([
            {
              lead_id: currentCase?.lead_id || null,
              patient_name: currentCase?.customer_name || "Cliente",
              phone: currentCase?.phone || null,
              city: currentCase?.city || null,
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

      setMensaje("Caso comercial actualizado correctamente.");
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
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Gestión comercial
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Atiende tus casos, registra ventas y agenda la siguiente continuidad.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
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
                  Registra tu gestión comercial, la venta y la continuidad.
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
              <form onSubmit={guardarCaso} className="mt-5 space-y-4">
                <Field
                  label="Estado del caso"
                  input={
                    <select
                      className={inputClass}
                      value={form.status}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                    >
                      {caseStatusOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  }
                />

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
                    label="Valor de la venta"
                    input={
                      <input
                        className={inputClass}
                        type="number"
                        value={form.sale_value}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            sale_value: e.target.value,
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
                        type="number"
                        value={form.cash_amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            cash_amount: e.target.value,
                          }))
                        }
                      />
                    }
                  />

                  <Field
                    label="Cartera"
                    input={
                      <input
                        className={inputClass}
                        type="number"
                        value={form.portfolio_amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            portfolio_amount: e.target.value,
                          }))
                        }
                      />
                    }
                  />

                  <Field
                    label="Volumen"
                    input={
                      <input
                        className={inputClass}
                        type="number"
                        value={form.volume_amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            volume_amount: e.target.value,
                          }))
                        }
                      />
                    }
                  />
                </div>

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
                    Si cierras la venta, puedes dejar programado el siguiente paso.
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

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar caso comercial"}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Casos visibles
                </h2>
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
                {caseStatusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
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
                              className={`rounded-full px-3 py-1 text-xs ${estadoBadge(
                                item.status
                              )}`}
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

                          {item.sale_value ? (
                            <p className="mt-1 text-sm text-slate-600">
                              Venta: ${Number(item.sale_value).toLocaleString("es-CO")}
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
                          onClick={() => cargarCasoParaEditar(item)}
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

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-500";
