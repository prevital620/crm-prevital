"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { useSearchParams } from "next/navigation";

type LeadOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  phone: string;
  city: string | null;
  status: string;
};

type SpecialistOption = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
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
  treatment_type: string | null;
  specialist_user_id: string | null;
  notes: string | null;
  instructions_text: string | null;
  checked_in_at: string | null;
  attended_at: string | null;
};

const allowedRoles = ["super_user", "recepcion"];

const appointmentStatusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "en_espera", label: "En espera" },
  { value: "asistio", label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
  { value: "reagendada", label: "Reagendada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "en_atencion", label: "En atención" },
  { value: "finalizada", label: "Finalizada" },
];

const serviceOptions = [
  { value: "valoracion", label: "Valoración" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutrición" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "otro", label: "Otro" },
];

const treatmentOptions = [
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "plan_nutricional", label: "Plan nutricional" },
  { value: "terapia", label: "Terapia" },
  { value: "valoracion_preventiva", label: "Valoración preventiva" },
  { value: "otro", label: "Otro" },
];

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

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function fullLeadName(lead: LeadOption) {
  return (
    lead.full_name?.trim() ||
    `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
    "Sin nombre"
  );
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
    asistio: "Asistió",
    no_asistio: "No asistió",
    reagendada: "Reagendada",
    cancelada: "Cancelada",
    en_atencion: "En atención",
    finalizada: "Finalizada",
  };
  return map[status] || status;
}

export default function RecepcionPage() {
  const searchParams = useSearchParams();
  const leadIdFromUrl = searchParams.get("leadId");

  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [fechaFiltro, setFechaFiltro] = useState(hoyISO());
  const [busquedaAgenda, setBusquedaAgenda] = useState("");
  const [busquedaLead, setBusquedaLead] = useState("");

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [specialists, setSpecialists] = useState<SpecialistOption[]>([]);
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

  const [form, setForm] = useState({
    mode: "lead",
    lead_id: "",
    patient_name: "",
    phone: "",
    city: "",
    appointment_date: hoyISO(),
    appointment_time: ahoraHora(),
    status: "agendada",
    service_type: "",
    treatment_type: "",
    specialist_user_id: "",
    notes: "",
    instructions_text: "",
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
        setError("No tienes permiso para entrar a Recepción.");
        return;
      }

      setAuthorized(true);
      setCurrentUserId(auth.user.id);
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

      const [appointmentsResult, leadsResult, specialistsResult] = await Promise.all([
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
            treatment_type,
            specialist_user_id,
            notes,
            instructions_text,
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
          .limit(200),

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

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (specialistsResult.error) throw specialistsResult.error;

      const appointmentsData = (appointmentsResult.data as AppointmentRow[]) || [];
      const leadsData = (leadsResult.data as LeadOption[]) || [];
      const profileRows = (specialistsResult.data as any[]) || [];

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

      const nextStatuses: Record<string, string> = {};
      appointmentsData.forEach((item) => {
        nextStatuses[item.id] = item.status;
      });

      setAppointments(appointmentsData);
      setLeads(leadsData);
      setSpecialists(specialistList);
      setStatusById(nextStatuses);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de recepción.");
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

  const leadsFiltrados = useMemo(() => {
    const q = busquedaLead.trim().toLowerCase();

    if (!q) return leads.slice(0, 20);

    return leads
      .filter((lead) => {
        const nombre = fullLeadName(lead).toLowerCase();
        const telefono = (lead.phone || "").toLowerCase();
        return nombre.includes(q) || telefono.includes(q);
      })
      .slice(0, 20);
  }, [leads, busquedaLead]);

  const agendaFiltrada = useMemo(() => {
    const q = busquedaAgenda.trim().toLowerCase();

    return appointments.filter((item) => {
      const fechaOk = fechaFiltro ? item.appointment_date === fechaFiltro : true;
      const nombre = (item.patient_name || "").toLowerCase();
      const telefono = (item.phone || "").toLowerCase();
      const busquedaOk = q ? nombre.includes(q) || telefono.includes(q) : true;
      return fechaOk && busquedaOk;
    });
  }, [appointments, fechaFiltro, busquedaAgenda]);

  const resumen = useMemo(() => {
    const delDia = appointments.filter((item) => item.appointment_date === fechaFiltro);

    return {
      total: delDia.length,
      agendadas: delDia.filter((x) => x.status === "agendada").length,
      espera: delDia.filter((x) => x.status === "en_espera").length,
      asistio: delDia.filter((x) => x.status === "asistio").length,
      noAsistio: delDia.filter((x) => x.status === "no_asistio").length,
    };
  }, [appointments, fechaFiltro]);

  function resetForm() {
    setEditingAppointmentId(null);
    setForm({
      mode: "lead",
      lead_id: "",
      patient_name: "",
      phone: "",
      city: "",
      appointment_date: hoyISO(),
      appointment_time: ahoraHora(),
      status: "agendada",
      service_type: "",
      treatment_type: "",
      specialist_user_id: "",
      notes: "",
      instructions_text: "",
    });
  }

  function cargarCitaParaEditar(item: AppointmentRow) {
    setEditingAppointmentId(item.id);
    setForm({
      mode: item.lead_id ? "lead" : "manual",
      lead_id: item.lead_id || "",
      patient_name: item.patient_name || "",
      phone: item.phone || "",
      city: item.city || "",
      appointment_date: item.appointment_date,
      appointment_time: item.appointment_time,
      status: item.status || "agendada",
      service_type: item.service_type || "",
      treatment_type: item.treatment_type || "",
      specialist_user_id: item.specialist_user_id || "",
      notes: item.notes || "",
      instructions_text: item.instructions_text || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.patient_name.trim()) {
      setError("Debes indicar el nombre del cliente.");
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
      setError("No se encontró el usuario actual.");
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
        service_type: form.service_type || null,
        treatment_type: form.treatment_type || null,
        specialist_user_id: form.specialist_user_id || null,
        notes: form.notes.trim() || null,
        instructions_text: form.instructions_text.trim() || null,
        updated_by_user_id: currentUserId,
      };

      if (editingAppointmentId) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingAppointmentId);

        if (error) throw error;

        setMensaje("Cita actualizada correctamente.");
      } else {
        const { error } = await supabase.from("appointments").insert([
          {
            ...payload,
            created_by_user_id: currentUserId,
          },
        ]);

        if (error) throw error;

        setMensaje("Cita creada correctamente.");
      }

      resetForm();
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

  async function guardarEstado(id: string) {
    const nuevoEstado = statusById[id];
    if (!nuevoEstado || !currentUserId) return;

    setSavingStatusId(id);
    setMensaje("");
    setError("");

    const appointmentActual = appointments.find((item) => item.id === id);

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
      if (nuevoEstado === "asistio" && appointmentActual) {
        const creado = await crearCasoVentasSiNoExiste(appointmentActual);
        if (creado) {
          mensajeFinal =
            "Estado actualizado y se creó automáticamente el caso de ventas.";
        }
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "La cita se actualizó, pero no se pudo crear el caso de ventas."
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
              <p className="text-sm font-medium text-slate-500">Recepción</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Agenda y admisión
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Crear citas, ubicar clientes, registrar llegada y actualizar estado.
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
          <StatCard title="Citas del día" value={String(resumen.total)} />
          <StatCard title="Agendadas" value={String(resumen.agendadas)} />
          <StatCard title="En espera" value={String(resumen.espera)} />
          <StatCard title="Asistió" value={String(resumen.asistio)} />
          <StatCard title="No asistió" value={String(resumen.noAsistio)} />
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingAppointmentId ? "Reagendar / editar cita" : "Nueva cita"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Puedes elegir un lead existente o ingresar el cliente manualmente.
                </p>
              </div>

              {editingAppointmentId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <form onSubmit={guardarCita} className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                  <div className="mb-2 font-medium text-slate-700">Modo de creación</div>
                  <select
                    className="w-full outline-none"
                    value={form.mode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        mode: e.target.value,
                        lead_id: "",
                        patient_name: "",
                        phone: "",
                        city: "",
                      }))
                    }
                  >
                    <option value="lead">Desde lead</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>

                <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                  <div className="mb-2 font-medium text-slate-700">Buscar lead</div>
                  <input
                    className="w-full outline-none"
                    placeholder="Nombre o teléfono"
                    value={busquedaLead}
                    onChange={(e) => setBusquedaLead(e.target.value)}
                    disabled={form.mode !== "lead"}
                  />
                </label>
              </div>

              {form.mode === "lead" ? (
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
                        {fullLeadName(lead)} · {lead.phone}
                      </option>
                    ))}
                  </select>
                </label>
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
                  label="Teléfono"
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

                <Field
                  label="Servicio"
                  input={
                    <select
                      className={inputClass}
                      value={form.service_type}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, service_type: e.target.value }))
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
                    <input
                      className={inputClass}
                      type="time"
                      value={form.appointment_time}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, appointment_time: e.target.value }))
                      }
                    />
                  }
                />

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
                  label="Tratamiento"
                  input={
                    <select
                      className={inputClass}
                      value={form.treatment_type}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, treatment_type: e.target.value }))
                      }
                    >
                      <option value="">Selecciona</option>
                      {treatmentOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
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

              <Field
                label="Instrucciones"
                input={
                  <textarea
                    className={`${inputClass} min-h-[110px] resize-none`}
                    value={form.instructions_text}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        instructions_text: e.target.value,
                      }))
                    }
                  />
                }
              />

              <button
                type="submit"
                disabled={savingAppointment}
                className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
              >
                {savingAppointment
                  ? "Guardando..."
                  : editingAppointmentId
                  ? "Guardar reagendamiento"
                  : "Guardar cita"}
              </button>
            </form>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Agenda visible</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Busca por nombre o teléfono y filtra por fecha.
                </p>
              </div>

              <button
                onClick={cargarTodo}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Actualizar
              </button>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
              />

              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                type="text"
                placeholder="Buscar por nombre o teléfono"
                value={busquedaAgenda}
                onChange={(e) => setBusquedaAgenda(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando citas...
              </div>
            ) : agendaFiltrada.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay citas con esos filtros.
              </div>
            ) : (
              <div className="space-y-4">
                {agendaFiltrada.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
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

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                              {item.appointment_date}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                              {formatHora(item.appointment_time)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {item.phone || "Sin teléfono"} · {item.city || "Sin ciudad"}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Servicio: {item.service_type || "Sin servicio"}
                          </p>

                          {item.treatment_type ? (
                            <p className="mt-1 text-sm text-slate-600">
                              Tratamiento: {item.treatment_type}
                            </p>
                          ) : null}

                          {item.notes ? (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-medium text-slate-800">Notas:</span>{" "}
                              {item.notes}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => cargarCitaParaEditar(item)}
                          className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          Reagendar
                        </button>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="mb-3 text-sm font-medium text-slate-700">
                          Estado de la cita
                        </p>

                        <div className="flex flex-col gap-3 md:flex-row">
                          <select
                            className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none"
                            value={statusById[item.id] || item.status}
                            onChange={(e) =>
                              setStatusById((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                          >
                            {appointmentStatusOptions.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => guardarEstado(item.id)}
                            disabled={savingStatusId === item.id}
                            className="rounded-2xl border border-slate-900 px-5 py-3 text-sm font-medium text-slate-900 disabled:opacity-60"
                          >
                            {savingStatusId === item.id
                              ? "Guardando..."
                              : "Guardar estado"}
                          </button>
                        </div>
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