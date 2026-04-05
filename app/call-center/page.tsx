"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  phone: string;
  city: string | null;
  interest_service: string | null;
  capture_location: string | null;
  source: string | null;
  status: string;
  observations: string | null;
  created_at: string;
  created_by_user_id: string | null;
  assigned_to_user_id: string | null;
};

type CallCenterUser = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  status: string;
  appointment_date: string;
  appointment_time: string;
};

type QuickFilter =
  | "todos"
  | "nuevos"
  | "sin_asignar"
  | "asignados"
  | "pendientes"
  | "pendientes_cita"
  | "agendados"
  | "no_asistio"
  | "cerrados";

const statusOptions = [
  { value: "nuevo", label: "Nuevo" },
  { value: "pendiente_contacto", label: "Pendiente" },
  { value: "interesado", label: "Interesado" },
  { value: "no_responde", label: "No responde" },
  { value: "contactado", label: "Contactado" },
  { value: "agendado", label: "Agendado" },
  { value: "reagendar", label: "Reagendar" },
  { value: "asistio", label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
  { value: "vendido", label: "Vendido" },
  { value: "cerrado", label: "Cerrado" },
  { value: "descartado", label: "Perdido" },
];

const allowedRoles = [
  "super_user",
  "supervisor_call_center",
  "confirmador",
  "tmk",
];

const ACTIVE_APPOINTMENT_STATUSES = [
  "agendada",
  "confirmada",
  "en_espera",
  "reagendada",
  "en_atencion",
];

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function soloFecha(fecha: string | null | undefined) {
  if (!fecha) return "";
  return fecha.slice(0, 10);
}

function estadoBadge(estado: string | null) {
  switch (estado) {
    case "asignado":
      return "bg-emerald-100 text-emerald-700";
    case "nuevo":
      return "bg-slate-100 text-slate-700";
    case "pendiente_contacto":
      return "bg-blue-100 text-blue-700";
    case "interesado":
      return "bg-amber-100 text-amber-700";
    case "no_responde":
      return "bg-orange-100 text-orange-700";
    case "contactado":
      return "bg-indigo-100 text-indigo-700";
    case "agendado":
      return "bg-emerald-100 text-emerald-700";
    case "reagendar":
      return "bg-cyan-100 text-cyan-700";
    case "asistio":
      return "bg-teal-100 text-teal-700";
    case "no_asistio":
      return "bg-rose-100 text-rose-700";
    case "vendido":
      return "bg-green-100 text-green-700";
    case "cerrado":
      return "bg-slate-200 text-slate-800";
    case "descartado":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function traducirEstado(estado: string | null) {
  const map: Record<string, string> = {
    asignado: "Asignado",
    nuevo: "Nuevo",
    pendiente_contacto: "Pendiente",
    interesado: "Interesado",
    no_responde: "No responde",
    contactado: "Contactado",
    agendado: "Agendado",
    reagendar: "Reagendar",
    asistio: "Asistió",
    no_asistio: "No asistió",
    vendido: "Vendido",
    cerrado: "Cerrado",
    descartado: "Perdido",
  };

  if (!estado) return "Sin estado";
  return map[estado] || estado;
}

function traducirServicio(servicio: string | null) {
  const map: Record<string, string> = {
    detox: "Detox",
    sueroterapia: "Sueroterapia",
    valoracion: "Valoración",
    nutricion: "Nutrición",
    fisioterapia: "Fisioterapia",
    medicina_general: "Medicina general",
    otro: "Otro",
  };

  if (!servicio) return "Sin servicio";
  return map[servicio] || servicio;
}

function traducirOrigen(source: string | null) {
  const map: Record<string, string> = {
    opc: "OPC",
    redes_sociales: "Redes sociales",
    referido: "Referido",
    evento: "Evento",
    punto_fisico: "Punto físico",
    otro: "Otro",
  };

  if (!source) return "Sin origen";
  return map[source] || source;
}

export default function CallCenterPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [callCenterUsers, setCallCenterUsers] = useState<CallCenterUser[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState(hoyISO());
  const [busqueda, setBusqueda] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, string>>({});
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [savingStatusLeadId, setSavingStatusLeadId] = useState<string | null>(null);
  const [cancelingAppointmentId, setCancelingAppointmentId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");

  async function cargarLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, full_name, phone, city, interest_service, capture_location, source, status, observations, created_at, created_by_user_id, assigned_to_user_id"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando leads:", error);
      throw new Error("No se pudieron cargar los leads.");
    }

    return (data as Lead[]) || [];
  }

  async function cargarCitas() {
    const { data, error } = await supabase
      .from("appointments")
      .select("id, lead_id, status, appointment_date, appointment_time");

    if (error) {
      console.error("Error cargando citas:", error);
      throw new Error("No se pudieron cargar las citas.");
    }

    return (data as AppointmentRow[]) || [];
  }

  async function cargarUsuariosCallCenter() {
    const { data, error } = await supabase
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
      `);

    if (error) {
      console.error("Error cargando usuarios call center:", error);
      throw new Error("No se pudieron cargar los usuarios de Call Center.");
    }

    const rows = (data || []) as any[];

    const filtered: CallCenterUser[] = rows
      .map((row) => ({
        id: row.profiles?.id || row.user_id,
        full_name: row.profiles?.full_name || "Sin nombre",
        role_name: row.roles?.name || "",
        role_code: row.roles?.code || "",
      }))
      .filter((user) =>
        ["supervisor_call_center", "confirmador", "tmk"].includes(user.role_code)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const uniqueMap = new Map<string, CallCenterUser>();
    filtered.forEach((user) => {
      if (!uniqueMap.has(user.id)) {
        uniqueMap.set(user.id, user);
      }
    });

    return Array.from(uniqueMap.values());
  }

  async function cargarNombresCreadores(leadsData: Lead[]) {
    const creatorIds = Array.from(
      new Set(
        leadsData
          .map((lead) => lead.created_by_user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (creatorIds.length === 0) {
      setCreatorNames({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);

    if (error) {
      console.error("Error cargando creadores:", error);
      throw new Error("No se pudieron cargar los nombres de los creadores.");
    }

    const map: Record<string, string> = {};
    ((data as ProfileRow[]) || []).forEach((profile) => {
      map[profile.id] = profile.full_name?.trim() || "Sin nombre";
    });

    setCreatorNames(map);
  }

  async function cargarTodo() {
    try {
      setCargando(true);
      setMensaje("");
      setError("");

      const [leadsData, appointmentsData, usersData] = await Promise.all([
        cargarLeads(),
        cargarCitas(),
        cargarUsuariosCallCenter(),
      ]);

      setLeads(leadsData);
      setAppointments(appointmentsData);
      setCallCenterUsers(usersData);
      await cargarNombresCreadores(leadsData);

      const assignments: Record<string, string> = {};
      const statuses: Record<string, string> = {};

      leadsData.forEach((lead) => {
        assignments[lead.id] = lead.assigned_to_user_id || "";
        statuses[lead.id] = lead.status || "nuevo";
      });

      setSelectedAssignments(assignments);
      setSelectedStatuses(statuses);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos del módulo.");
    } finally {
      setCargando(false);
    }
  }

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
        setError("No tienes permiso para entrar a Call Center.");
        return;
      }

      setAuthorized(true);
      setCurrentRoleCode(auth.roleCode);
      setCurrentUserId(auth.user.id);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
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

  async function guardarAsignacion(leadId: string) {
    try {
      const assignedUserId = selectedAssignments[leadId] || null;

      setSavingLeadId(leadId);
      setMensaje("");
      setError("");

      const { error } = await supabase
        .from("leads")
        .update({
          assigned_to_user_id: assignedUserId,
        })
        .eq("id", leadId);

      if (error) {
        console.error("Error guardando asignación:", error);
        throw new Error(error.message || "No se pudo guardar la asignación.");
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? { ...lead, assigned_to_user_id: assignedUserId }
            : lead
        )
      );

      setMensaje(
        assignedUserId
          ? "Asignación guardada correctamente."
          : "Se quitó la asignación correctamente."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la asignación.");
    } finally {
      setSavingLeadId(null);
    }
  }

  async function guardarEstado(leadId: string) {
    try {
      const newStatus = selectedStatuses[leadId] || "nuevo";

      setSavingStatusLeadId(leadId);
      setMensaje("");
      setError("");

      const { error } = await supabase
        .from("leads")
        .update({
          status: newStatus,
        })
        .eq("id", leadId);

      if (error) {
        console.error("Error guardando estado:", error);
        throw new Error(error.message || "No se pudo actualizar el estado.");
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );

      setMensaje("Estado actualizado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el estado.");
    } finally {
      setSavingStatusLeadId(null);
    }
  }

  async function cancelarCita(lead: Lead, appointment: AppointmentRow) {
    try {
      setCancelingAppointmentId(appointment.id);
      setMensaje("");
      setError("");

      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({
          status: "cancelada",
        })
        .eq("id", appointment.id);

      if (appointmentError) throw appointmentError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({
          status: "contactado",
        })
        .eq("id", lead.id);

      if (leadError) throw leadError;

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointment.id ? { ...item, status: "cancelada" } : item
        )
      );

      setLeads((prev) =>
        prev.map((item) =>
          item.id === lead.id ? { ...item, status: "contactado" } : item
        )
      );

      setSelectedStatuses((prev) => ({
        ...prev,
        [lead.id]: "contactado",
      }));

      setMensaje("Cita cancelada correctamente. El cupo quedó liberado.");
    } catch (err: any) {
      setError(err?.message || "No se pudo cancelar la cita.");
    } finally {
      setCancelingAppointmentId(null);
    }
  }

  const activeAppointmentByLeadId = useMemo(() => {
    const map: Record<string, AppointmentRow> = {};

    appointments.forEach((appointment) => {
      if (
        appointment.lead_id &&
        ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)
      ) {
        map[appointment.lead_id] = appointment;
      }
    });

    return map;
  }, [appointments]);

  function tieneCitaActiva(lead: Lead) {
    return !!activeAppointmentByLeadId[lead.id];
  }

  function estaAsignado(lead: Lead) {
    return !!lead.assigned_to_user_id;
  }

  function obtenerEstadoVisible(lead: Lead) {
    if (tieneCitaActiva(lead)) return "agendado";
    if (estaAsignado(lead) && lead.status === "nuevo") return "asignado";
    return lead.status || "nuevo";
  }

  function esPendiente(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return (
      estado === "pendiente_contacto" ||
      estado === "no_responde" ||
      estado === "interesado"
    );
  }

  function esPendienteDeCita(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return (
      !tieneCitaActiva(lead) &&
      (estado === "contactado" || estado === "reagendar")
    );
  }

  function esCerrado(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return (
      estado === "vendido" ||
      estado === "cerrado" ||
      estado === "descartado"
    );
  }

  const leadsBasePorRol = useMemo(() => {
    let base = leads;

    if (currentRoleCode === "tmk") {
      base = base.filter(
        (lead) =>
          lead.assigned_to_user_id === currentUserId ||
          lead.created_by_user_id === currentUserId
      );
    }

    return base;
  }, [leads, currentRoleCode, currentUserId]);

  const resumen = useMemo(() => {
    const delDia = leadsBasePorRol.filter(
      (lead) => soloFecha(lead.created_at) === fechaFiltro
    );

    return {
      total: delDia.length,
      nuevos: delDia.filter((lead) => obtenerEstadoVisible(lead) === "nuevo").length,
      sinAsignar: delDia.filter((lead) => !estaAsignado(lead)).length,
      asignados: delDia.filter((lead) => obtenerEstadoVisible(lead) === "asignado").length,
      pendientes: delDia.filter((lead) => esPendiente(lead)).length,
      pendientesCita: delDia.filter((lead) => esPendienteDeCita(lead)).length,
      agendados: delDia.filter((lead) => tieneCitaActiva(lead)).length,
      noAsistio: delDia.filter((lead) => obtenerEstadoVisible(lead) === "no_asistio").length,
      cerrados: delDia.filter((lead) => esCerrado(lead)).length,
    };
  }, [leadsBasePorRol, fechaFiltro, activeAppointmentByLeadId]);

  const leadsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    let base = leadsBasePorRol.filter(
      (lead) => soloFecha(lead.created_at) === fechaFiltro
    );

    if (quickFilter === "nuevos") {
      base = base.filter((lead) => obtenerEstadoVisible(lead) === "nuevo");
    }

    if (quickFilter === "sin_asignar") {
      base = base.filter((lead) => !estaAsignado(lead));
    }

    if (quickFilter === "asignados") {
      base = base.filter((lead) => obtenerEstadoVisible(lead) === "asignado");
    }

    if (quickFilter === "pendientes") {
      base = base.filter((lead) => esPendiente(lead));
    }

    if (quickFilter === "pendientes_cita") {
      base = base.filter((lead) => esPendienteDeCita(lead));
    }

    if (quickFilter === "agendados") {
      base = base.filter((lead) => tieneCitaActiva(lead));
    }

    if (quickFilter === "no_asistio") {
      base = base.filter((lead) => obtenerEstadoVisible(lead) === "no_asistio");
    }

    if (quickFilter === "cerrados") {
      base = base.filter((lead) => esCerrado(lead));
    }

    if (!q) return base;

    return base.filter((lead) => {
      const nombre =
        lead.full_name?.toLowerCase() ||
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim().toLowerCase();

      const creador = (creatorNames[lead.created_by_user_id || ""] || "").toLowerCase();
      const asignado = (
        callCenterUsers.find((u) => u.id === lead.assigned_to_user_id)?.full_name || ""
      ).toLowerCase();

      return (
        (lead.phone || "").toLowerCase().includes(q) ||
        nombre.includes(q) ||
        creador.includes(q) ||
        asignado.includes(q)
      );
    });
  }, [
    leadsBasePorRol,
    fechaFiltro,
    busqueda,
    quickFilter,
    creatorNames,
    callCenterUsers,
    activeAppointmentByLeadId,
  ]);

  function obtenerNombreAsignado(lead: Lead) {
    if (!lead.assigned_to_user_id) return "Sin asignar";

    const user = callCenterUsers.find((u) => u.id === lead.assigned_to_user_id);
    return user ? `${user.full_name} · ${user.role_name}` : "Asignado";
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Call Center</p>
              <h1 className="text-3xl font-bold text-slate-900">Gestión de leads</h1>
              <p className="mt-2 text-slate-600">
                {currentRoleCode === "supervisor_call_center" || currentRoleCode === "super_user"
                  ? "Puedes consultar, asignar, organizar por bloques, cancelar citas y actualizar el estado de los leads."
                  : currentRoleCode === "confirmador"
                  ? "Puedes consultar todos los leads, cancelar citas y actualizar su estado."
                  : "Puedes consultar tus leads asignados o creados por ti, cancelar citas y actualizar su estado."}
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
            >
              Inicio
            </a>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard title="Todos" value={resumen.total} active={quickFilter === "todos"} onClick={() => setQuickFilter("todos")} />
          <StatCard title="Nuevos" value={resumen.nuevos} active={quickFilter === "nuevos"} onClick={() => setQuickFilter("nuevos")} />
          <StatCard title="Sin asignar" value={resumen.sinAsignar} active={quickFilter === "sin_asignar"} onClick={() => setQuickFilter("sin_asignar")} />
          <StatCard title="Asignados" value={resumen.asignados} active={quickFilter === "asignados"} onClick={() => setQuickFilter("asignados")} />
          <StatCard title="Pendientes" value={resumen.pendientes} active={quickFilter === "pendientes"} onClick={() => setQuickFilter("pendientes")} />
          <StatCard title="Pendientes de cita" value={resumen.pendientesCita} active={quickFilter === "pendientes_cita"} onClick={() => setQuickFilter("pendientes_cita")} />
          <StatCard title="Agendados" value={resumen.agendados} active={quickFilter === "agendados"} onClick={() => setQuickFilter("agendados")} />
          <StatCard title="No asistió" value={resumen.noAsistio} active={quickFilter === "no_asistio"} onClick={() => setQuickFilter("no_asistio")} />
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { key: "todos", label: "Todos" },
              { key: "nuevos", label: "Nuevos" },
              { key: "sin_asignar", label: "Sin asignar" },
              { key: "asignados", label: "Asignados" },
              { key: "pendientes", label: "Pendientes" },
              { key: "pendientes_cita", label: "Pendientes de cita" },
              { key: "agendados", label: "Agendados" },
              { key: "no_asistio", label: "No asistió" },
              { key: "cerrados", label: "Cerrados" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setQuickFilter(item.key as QuickFilter)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                  quickFilter === item.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Buscar por teléfono, nombre, creador o asignado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {cargando ? (
            <p className="mt-6 text-slate-600">Cargando leads...</p>
          ) : leadsFiltrados.length === 0 ? (
            <p className="mt-6 text-slate-600">No hay leads para ese bloque o filtro.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {leadsFiltrados.map((lead) => {
                const nombre =
                  lead.full_name?.trim() ||
                  `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
                  "Sin nombre";

                const canAssign =
                  currentRoleCode === "super_user" ||
                  currentRoleCode === "supervisor_call_center";

                const canChangeStatus =
                  currentRoleCode === "super_user" ||
                  currentRoleCode === "supervisor_call_center" ||
                  currentRoleCode === "confirmador" ||
                  currentRoleCode === "tmk";

                const activeAppointment = activeAppointmentByLeadId[lead.id];
                const hasActiveAppointment = !!activeAppointment;
                const estadoVisible = obtenerEstadoVisible(lead);

                return (
                  <div
                    key={lead.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {nombre}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${estadoBadge(
                                estadoVisible
                              )}`}
                            >
                              {traducirEstado(estadoVisible)}
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                              {soloFecha(lead.created_at)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {lead.phone || "Sin teléfono"} · {lead.city || "Sin ciudad"}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Servicio: {traducirServicio(lead.interest_service)}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Origen: {traducirOrigen(lead.source)}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Captación: {lead.capture_location || "No registrado"}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Creado por: {creatorNames[lead.created_by_user_id || ""] || "Sin nombre"}
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            <span className="font-medium">Asignado a:</span>{" "}
                            {obtenerNombreAsignado(lead)}
                          </p>

                          {activeAppointment ? (
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Cita activa:</span>{" "}
                              {activeAppointment.appointment_date} · {activeAppointment.appointment_time}
                            </p>
                          ) : null}

                          {lead.observations ? (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-medium text-slate-800">Observaciones:</span>{" "}
                              {lead.observations}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/leads/${lead.id}`}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
                          >
                            Ver / editar
                          </a>

                          <a
                            href={`/recepcion?leadId=${lead.id}`}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
                          >
                            {hasActiveAppointment ? "Reagendar cita" : "Agendar cita"}
                          </a>

                          {hasActiveAppointment && activeAppointment ? (
                            <button
                              type="button"
                              onClick={() => cancelarCita(lead, activeAppointment)}
                              disabled={cancelingAppointmentId === activeAppointment.id}
                              className="rounded-2xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                            >
                              {cancelingAppointmentId === activeAppointment.id
                                ? "Cancelando..."
                                : "Cancelar cita"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {canAssign ? (
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="mb-3 text-sm font-medium text-slate-700">
                            Asignación Call Center
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none"
                              value={selectedAssignments[lead.id] || ""}
                              onChange={(e) =>
                                setSelectedAssignments((prev) => ({
                                  ...prev,
                                  [lead.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Sin asignar</option>
                              {callCenterUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.full_name} · {user.role_name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => guardarAsignacion(lead.id)}
                              disabled={savingLeadId === lead.id}
                              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                            >
                              {savingLeadId === lead.id
                                ? "Guardando..."
                                : "Guardar asignación"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {canChangeStatus ? (
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="mb-3 text-sm font-medium text-slate-700">
                            Estado del lead
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none"
                              value={selectedStatuses[lead.id] || lead.status || "nuevo"}
                              onChange={(e) =>
                                setSelectedStatuses((prev) => ({
                                  ...prev,
                                  [lead.id]: e.target.value,
                                }))
                              }
                            >
                              {statusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => guardarEstado(lead.id)}
                              disabled={savingStatusLeadId === lead.id}
                              className="rounded-2xl border border-slate-900 px-5 py-3 text-sm font-medium text-slate-900 disabled:opacity-60"
                            >
                              {savingStatusLeadId === lead.id
                                ? "Guardando..."
                                : "Guardar estado"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  active,
  onClick,
}: {
  title: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl bg-white p-5 text-left shadow-sm transition ${
        active ? "ring-2 ring-slate-900" : ""
      }`}
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </button>
  );
}