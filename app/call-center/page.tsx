"use client";

import Image from "next/image";
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
  { value: "dato_falso", label: "Dato falso" },
  { value: "no_interesa", label: "No interesa" },
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
      return "border-[#CFE7D6] bg-[#EEF8F1] text-[#2F7A52]";
    case "nuevo":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "pendiente_contacto":
      return "border-[#D6E8DA] bg-[#EEF5F0] text-[#4F6F5B]";
    case "interesado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "no_responde":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "contactado":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "agendado":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "dato_falso":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "no_interesa":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
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
    dato_falso: "Dato falso",
    no_interesa: "No interesa",
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

const quickFilterButtons: Array<{ key: QuickFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "nuevos", label: "Nuevos" },
  { key: "sin_asignar", label: "Sin asignar" },
  { key: "asignados", label: "Asignados" },
  { key: "pendientes", label: "Pendientes" },
  { key: "pendientes_cita", label: "Pendientes de cita" },
  { key: "agendados", label: "Agendados" },
  { key: "no_asistio", label: "No asistió" },
  { key: "cerrados", label: "Descartados" },
];

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
    return !tieneCitaActiva(lead) && estado === "contactado";
  }

  function esCerrado(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return estado === "dato_falso" || estado === "no_interesa";
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
      (lead) => (fechaFiltro ? soloFecha(lead.created_at) === fechaFiltro : true)
    );

    return {
      total: delDia.length,
      nuevos: delDia.filter((lead) => obtenerEstadoVisible(lead) === "nuevo").length,
      sinAsignar: delDia.filter((lead) => !estaAsignado(lead)).length,
      asignados: delDia.filter((lead) => obtenerEstadoVisible(lead) === "asignado").length,
      pendientes: delDia.filter((lead) => esPendiente(lead)).length,
      pendientesCita: delDia.filter((lead) => esPendienteDeCita(lead)).length,
      agendados: delDia.filter((lead) => tieneCitaActiva(lead)).length,
      noAsistio: delDia.filter((lead) => soloFecha(activeAppointmentByLeadId[lead.id]?.appointment_date) === fechaFiltro && obtenerEstadoVisible(lead) === "no_asistio").length,
      cerrados: delDia.filter((lead) => esCerrado(lead)).length,
    };
  }, [leadsBasePorRol, fechaFiltro, activeAppointmentByLeadId]);

  const leadsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    let base = leadsBasePorRol.filter(
      (lead) => (fechaFiltro ? soloFecha(lead.created_at) === fechaFiltro : true)
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
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.04] md:h-[560px] md:w-[560px]">
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
              <p className="text-sm font-medium text-[#7FA287]">Call Center</p>
              <h1 className="mt-1 text-3xl font-bold text-[#24312A]">Gestión de leads</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
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
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:border-[#BCD7C2] hover:bg-[#F4FAF6]"
            >
              Inicio
            </a>

            {(currentRoleCode === "supervisor_call_center" || currentRoleCode === "super_user") && (
              <>
                <a
                  href="/leads/nuevo"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
                >
                  Nuevo lead
                </a>

                <a
                  href="/recepcion"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:border-[#BCD7C2] hover:bg-[#F4FAF6]"
                >
                  Agenda visible
                </a>

                <a
                  href="/recepcion"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
                >
                  Configurar cupos
                </a>
              </>
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
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
          <StatCard title="Descartados" value={resumen.cerrados} active={quickFilter === "cerrados"} onClick={() => setQuickFilter("cerrados")} />
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {quickFilterButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setQuickFilter(item.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  quickFilter === item.key
                    ? "bg-[#5F7D66] text-white shadow-sm"
                    : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_1fr]">
            <input
              className="w-full rounded-2xl border border-[#D6E8DA] bg-white p-4 text-slate-800 outline-none transition focus:border-[#7FA287]"
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setFechaFiltro(hoyISO())}
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => setFechaFiltro("")}
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Todos
            </button>

            <input
              className="rounded-2xl border border-[#D6E8DA] bg-white p-4 text-slate-800 outline-none transition focus:border-[#7FA287]"
              placeholder="Buscar por teléfono, nombre, creador o asignado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {cargando ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
              Cargando leads...
            </div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
              No hay leads para ese día o filtro.
            </div>
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
                    className="group rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-[#24312A]">
                              {nombre}
                            </h3>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoBadge(
                                estadoVisible
                              )}`}
                            >
                              {traducirEstado(estadoVisible)}
                            </span>

                            <span className="rounded-full border border-[#E3ECE5] bg-[#F8F7F4] px-3 py-1 text-xs text-slate-600">
                              {soloFecha(lead.created_at)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-1 text-sm text-slate-600">
                            <p>{lead.phone || "Sin teléfono"} · {lead.city || "Sin ciudad"}</p>
                            <p>Servicio: {traducirServicio(lead.interest_service)}</p>
                            <p>Origen: {traducirOrigen(lead.source)}</p>
                            <p>Captación: {lead.capture_location || "No registrado"}</p>
                            <p>Creado por: {creatorNames[lead.created_by_user_id || ""] || "Sin nombre"}</p>
                            <p className="text-[#4F6F5B]">
                              <span className="font-medium">Asignado a:</span>{" "}
                              {obtenerNombreAsignado(lead)}
                            </p>

                            {activeAppointment ? (
                              <p className="text-[#4F6F5B]">
                                <span className="font-medium">Cita activa:</span>{" "}
                                {activeAppointment.appointment_date} · {activeAppointment.appointment_time}
                              </p>
                            ) : null}
                          </div>

                          {lead.observations ? (
                            <div className="mt-3 rounded-2xl border border-[#E3ECE5] bg-[#F8F7F4] p-3 text-sm text-slate-600">
                              <span className="font-medium text-[#24312A]">Observaciones:</span>{" "}
                              {lead.observations}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                          >
                            Ver / editar
                          </a>

                          <a
                            href={`/recepcion?leadId=${lead.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                          >
                            {hasActiveAppointment ? "Reagendar cita" : "Agendar cita"}
                          </a>

                          {hasActiveAppointment && activeAppointment ? (
                            <button
                              type="button"
                              onClick={() => cancelarCita(lead, activeAppointment)}
                              disabled={cancelingAppointmentId === activeAppointment.id}
                              className="rounded-2xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {cancelingAppointmentId === activeAppointment.id
                                ? "Cancelando..."
                                : "Cancelar cita"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {canAssign ? (
                        <div className="rounded-3xl border border-[#E3ECE5] bg-[#F8F7F4] p-4">
                          <p className="mb-3 text-sm font-semibold text-[#4F6F5B]">
                            Asignación Call Center
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-[#D6E8DA] bg-white p-4 text-slate-800 outline-none transition focus:border-[#7FA287]"
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
                              className="rounded-2xl bg-[#5F7D66] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#4F6F5B] disabled:opacity-60"
                            >
                              {savingLeadId === lead.id
                                ? "Guardando..."
                                : "Guardar asignación"}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {canChangeStatus ? (
                        <div className="rounded-3xl border border-[#E3ECE5] bg-[#F8F7F4] p-4">
                          <p className="mb-3 text-sm font-semibold text-[#4F6F5B]">
                            Estado del lead en Call Center
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-[#D6E8DA] bg-white p-4 text-slate-800 outline-none transition focus:border-[#7FA287]"
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
                              className="rounded-2xl border border-[#5F7D66] bg-white px-5 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
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
      className={`group overflow-hidden rounded-3xl border bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${
        active
          ? "border-[#7FA287] ring-2 ring-[#DDECE1]"
          : "border-[#D6E8DA] hover:border-[#BCD7C2]"
      }`}
    >
      <div className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#24312A]">{value}</p>
    </button>
  );
}
