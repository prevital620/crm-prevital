"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { getLeadSourceLabel } from "@/lib/lead-source";

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
  commission_source_type: string | null;
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
  | "sin_asignar_pendientes_no_contestan"
  | "asignados"
  | "pendientes"
  | "no_contestan"
  | "interesados"
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

const commissionSourceOptions = [
  { value: "opc", label: "OPC" },
  { value: "redes", label: "Redes" },
  { value: "base", label: "Base" },
  { value: "otro", label: "Otro" },
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

function restarDiasISO(dias: number) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() - dias);
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
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
    case "no_asistio":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
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
    no_asistio: "No asistió",
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
  return getLeadSourceLabel(source);
}

function traducirFuenteComision(value: string | null) {
  const map: Record<string, string> = {
    opc: "OPC",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };

  if (!value) return "Sin definir";
  return map[value] || value;
}

const quickFilterButtons: Array<{ key: QuickFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "sin_asignar", label: "Sin asignar" },
  { key: "pendientes", label: "Pendientes" },
  { key: "no_contestan", label: "No contestan" },
  { key: "interesados", label: "Interesados" },
  { key: "nuevos", label: "Nuevos" },
  { key: "asignados", label: "Asignados" },
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
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, string>>({});
  const [selectedCommissionSources, setSelectedCommissionSources] = useState<Record<string, string>>({});
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [savingStatusLeadId, setSavingStatusLeadId] = useState<string | null>(null);
  const [savingCommissionLeadId, setSavingCommissionLeadId] = useState<string | null>(null);
  const [cancelingAppointmentId, setCancelingAppointmentId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");

  async function cargarLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, full_name, phone, city, interest_service, capture_location, source, status, observations, created_at, created_by_user_id, assigned_to_user_id, commission_source_type"
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
      const commissionSources: Record<string, string> = {};

      leadsData.forEach((lead) => {
        assignments[lead.id] = lead.assigned_to_user_id || "";
        statuses[lead.id] = lead.status || "nuevo";
        commissionSources[lead.id] = lead.commission_source_type || "";
      });

      setSelectedAssignments(assignments);
      setSelectedStatuses(statuses);
      setSelectedCommissionSources(commissionSources);
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
    void validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      void cargarTodo();
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

  async function guardarFuenteComision(leadId: string) {
    try {
      const commissionSource = selectedCommissionSources[leadId] || null;

      setSavingCommissionLeadId(leadId);
      setMensaje("");
      setError("");

      const { error } = await supabase
        .from("leads")
        .update({
          commission_source_type: commissionSource,
        })
        .eq("id", leadId);

      if (error) {
        console.error("Error guardando fuente de comisión:", error);
        throw new Error(error.message || "No se pudo guardar la fuente de comisión.");
      }

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? { ...lead, commission_source_type: commissionSource }
            : lead
        )
      );

      setMensaje(
        commissionSource
          ? "Fuente para comisión guardada correctamente."
          : "Se limpió la fuente para comisión."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la fuente para comisión.");
    } finally {
      setSavingCommissionLeadId(null);
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

  function esNoContesta(lead: Lead) {
    return obtenerEstadoVisible(lead) === "no_responde";
  }

  function esInteresado(lead: Lead) {
    return obtenerEstadoVisible(lead) === "interesado";
  }

  function esPendienteDeCita(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return !tieneCitaActiva(lead) && estado === "contactado";
  }

  function esCerrado(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);
    return estado === "dato_falso" || estado === "no_interesa";
  }

  function esSinAsignarPendienteONoContesta(lead: Lead) {
    const estado = obtenerEstadoVisible(lead);

    return (
      !estaAsignado(lead) &&
      (
        estado === "nuevo" ||
        estado === "pendiente_contacto" ||
        estado === "no_responde"
      )
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

  const leadsDelDia = useMemo(() => {
    return leadsBasePorRol.filter((lead) =>
      fechaFiltro ? soloFecha(lead.created_at) === fechaFiltro : true
    );
  }, [leadsBasePorRol, fechaFiltro]);

  const leadsUltimos30Dias = useMemo(() => {
    const inicioVentana = restarDiasISO(29);
    const finVentana = hoyISO();

    return leadsBasePorRol.filter((lead) => {
      const fechaLead = soloFecha(lead.created_at);
      return fechaLead >= inicioVentana && fechaLead <= finVentana;
    });
  }, [leadsBasePorRol]);

  const resumen = useMemo(() => {
    return {
      total: leadsDelDia.length,
      nuevos: leadsDelDia.filter((lead) => obtenerEstadoVisible(lead) === "nuevo").length,
      sinAsignar: leadsDelDia.filter((lead) => !estaAsignado(lead)).length,
      sinAsignarPendientesNoContestan: leadsUltimos30Dias.filter((lead) =>
        esSinAsignarPendienteONoContesta(lead)
      ).length,
      asignados: leadsDelDia.filter((lead) => obtenerEstadoVisible(lead) === "asignado").length,
      pendientes: leadsDelDia.filter((lead) => esPendiente(lead)).length,
      noContestan: leadsDelDia.filter((lead) => esNoContesta(lead)).length,
      interesados: leadsDelDia.filter((lead) => esInteresado(lead)).length,
      pendientesCita: leadsDelDia.filter((lead) => esPendienteDeCita(lead)).length,
      agendados: leadsDelDia.filter((lead) => tieneCitaActiva(lead)).length,
      noAsistio: leadsDelDia.filter((lead) => obtenerEstadoVisible(lead) === "no_asistio").length,
      cerrados: leadsDelDia.filter((lead) => esCerrado(lead)).length,
    };
  }, [leadsDelDia, leadsUltimos30Dias, activeAppointmentByLeadId]);

  const leadsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    let base =
      quickFilter === "sin_asignar_pendientes_no_contestan"
        ? [...leadsUltimos30Dias]
        : [...leadsDelDia];

    if (quickFilter === "nuevos") {
      base = base.filter((lead) => obtenerEstadoVisible(lead) === "nuevo");
    }

    if (quickFilter === "sin_asignar") {
      base = base.filter((lead) => !estaAsignado(lead));
    }

    if (quickFilter === "sin_asignar_pendientes_no_contestan") {
      base = base.filter((lead) => esSinAsignarPendienteONoContesta(lead));
    }

    if (quickFilter === "asignados") {
      base = base.filter((lead) => obtenerEstadoVisible(lead) === "asignado");
    }

    if (quickFilter === "pendientes") {
      base = base.filter((lead) => esPendiente(lead));
    }

    if (quickFilter === "no_contestan") {
      base = base.filter((lead) => esNoContesta(lead));
    }

    if (quickFilter === "interesados") {
      base = base.filter((lead) => esInteresado(lead));
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
    leadsDelDia,
    leadsUltimos30Dias,
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#F1FBF5_0%,_#FAFCF9_48%,_#FFFDF9_100%)] p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#CFE4D8] bg-white/90 p-6 shadow-[0_18px_50px_rgba(95,125,102,0.12)] backdrop-blur">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#F1FBF5_0%,_#FAFCF9_48%,_#FFFDF9_100%)] p-6 md:p-10">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#CFE4D8] bg-white/90 p-6 shadow-[0_18px_50px_rgba(95,125,102,0.12)] backdrop-blur">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-10">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-80 w-80 rounded-full bg-[#8CB88D]/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#DDF4E8]/45 blur-3xl" />

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
          <div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-[#BFE7D7]/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-48 bg-[radial-gradient(circle_at_bottom_left,_rgba(168,205,189,0.22),_transparent_68%)]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Call Center</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.2rem]">Gestión de leads</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                {currentRoleCode === "supervisor_call_center" || currentRoleCode === "super_user"
                  ? "Puedes consultar, asignar, organizar por bloques, cancelar citas y actualizar el estado de los leads."
                  : currentRoleCode === "confirmador"
                  ? "Puedes consultar todos los leads, cancelar citas y actualizar su estado."
                  : "Puedes consultar tus leads asignados o creados por ti, cancelar citas y actualizar su estado."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">
                  Paleta Prevital
                </span>
                <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">
                  Menta, hoja y crema
                </span>
              </div>
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

            {(currentRoleCode === "supervisor_call_center" || currentRoleCode === "super_user") && (
              <>
                <a
                  href="/leads/nuevo"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_14px_28px_rgba(95,125,102,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Nuevo lead
                </a>

                <a
                  href="/recepcion"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Agenda visible
                </a>

                <a
                  href="/recepcion"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#A8CDBD_0%,_#7FA287_55%,_#5F7D66_100%)] px-4 py-2 text-sm font-medium text-[#1F3128] shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Configurar cupos
                </a>

                <button
                  type="button"
                  onClick={() => setQuickFilter("sin_asignar_pendientes_no_contestan")}
                  className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    quickFilter === "sin_asignar_pendientes_no_contestan"
                      ? "bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] text-white shadow-[0_16px_30px_rgba(63,105,82,0.3)]"
                      : "border border-[#CFE4D8] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#ECF8F1_100%)] text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-white"
                  }`}
                >
                  Sin asignar 30 días ({resumen.sinAsignarPendientesNoContestan})
                </button>
              </>
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-[linear-gradient(135deg,_#FFF5F5_0%,_#FFF0F0_100%)] p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-2xl border border-[#BFE0CD] bg-[linear-gradient(135deg,_#F1FBF5_0%,_#E8F7EF_100%)] p-4 text-sm text-[#2D6B4A] shadow-sm">
            {mensaje}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard title="Todos" value={resumen.total} active={quickFilter === "todos"} onClick={() => setQuickFilter("todos")} />
          <StatCard
            title="Sin asignar nuevos / pendientes / no contestan (30 días)"
            value={resumen.sinAsignarPendientesNoContestan}
            active={quickFilter === "sin_asignar_pendientes_no_contestan"}
            onClick={() => setQuickFilter("sin_asignar_pendientes_no_contestan")}
            highlight={resumen.sinAsignarPendientesNoContestan > 0}
          />
          <StatCard title="Sin asignar" value={resumen.sinAsignar} active={quickFilter === "sin_asignar"} onClick={() => setQuickFilter("sin_asignar")} highlight={resumen.sinAsignar > 0} />
          <StatCard title="Pendientes" value={resumen.pendientes} active={quickFilter === "pendientes"} onClick={() => setQuickFilter("pendientes")} highlight={resumen.pendientes > 0} />
          <StatCard title="No contestan" value={resumen.noContestan} active={quickFilter === "no_contestan"} onClick={() => setQuickFilter("no_contestan")} highlight={resumen.noContestan > 0} />
          <StatCard title="Interesados" value={resumen.interesados} active={quickFilter === "interesados"} onClick={() => setQuickFilter("interesados")} />
          <StatCard title="Nuevos" value={resumen.nuevos} active={quickFilter === "nuevos"} onClick={() => setQuickFilter("nuevos")} />
          <StatCard title="Asignados" value={resumen.asignados} active={quickFilter === "asignados"} onClick={() => setQuickFilter("asignados")} />
          <StatCard title="Pendientes de cita" value={resumen.pendientesCita} active={quickFilter === "pendientes_cita"} onClick={() => setQuickFilter("pendientes_cita")} />
          <StatCard title="Agendados" value={resumen.agendados} active={quickFilter === "agendados"} onClick={() => setQuickFilter("agendados")} />
          <StatCard title="No asistió" value={resumen.noAsistio} active={quickFilter === "no_asistio"} onClick={() => setQuickFilter("no_asistio")} />
          <StatCard title="Descartados" value={resumen.cerrados} active={quickFilter === "cerrados"} onClick={() => setQuickFilter("cerrados")} />
        </section>

        <section className="rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
          <div className="mb-5 rounded-[28px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-5 shadow-inner">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F6F5B]">Control rápido del supervisor</p>
            <p className="mt-2 text-sm leading-7 text-[#51695C]">
              Prioriza primero <span className="font-medium text-[#4F6F5B]">Sin asignar</span>,{" "}
              <span className="font-medium text-[#4F6F5B]">Pendientes</span> y{" "}
              <span className="font-medium text-[#4F6F5B]">No contestan</span> para que no se pierdan leads. El acceso
              directo superior revisa siempre los Ãºltimos 30 dÃ­as.
            </p>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {quickFilterButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setQuickFilter(item.key)}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    quickFilter === item.key
                      ? "bg-[linear-gradient(135deg,_#6D9D88_0%,_#5F7D66_100%)] text-white shadow-[0_14px_26px_rgba(95,125,102,0.22)]"
                      : "border border-[#D6E8DA] bg-white/90 text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_1fr]">
            <input
              className="w-full rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-slate-800 shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />

            <button
              type="button"
              onClick={() => setFechaFiltro(hoyISO())}
              className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F5FCF7]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => setFechaFiltro("")}
              className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F5FCF7]"
            >
              Todos
            </button>

            <input
              className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-slate-800 shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]"
              placeholder="Buscar por teléfono, nombre, creador o asignado"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <p className="mt-3 text-xs text-[#5F7D66]">
            {fechaFiltro
              ? `Mostrando leads del ${fechaFiltro}.`
              : "Mostrando todos los leads disponibles para tu rol."}
          </p>

          {cargando ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
              Cargando leads...
            </div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
              No hay leads para el filtro actual.
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

                const canManageCommissionSource =
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
                    className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
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
                            <p className="text-[#4F6F5B]">
                              <span className="font-medium">Fuente para comisión:</span>{" "}
                              {traducirFuenteComision(lead.commission_source_type)}
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

                      {canManageCommissionSource ? (
                        <div className="rounded-3xl border border-[#E3ECE5] bg-[#F8F7F4] p-4">
                          <p className="mb-3 text-sm font-semibold text-[#4F6F5B]">
                            Fuente para comisión
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-[#D6E8DA] bg-white p-4 text-slate-800 outline-none transition focus:border-[#7FA287]"
                              value={selectedCommissionSources[lead.id] || ""}
                              onChange={(e) =>
                                setSelectedCommissionSources((prev) => ({
                                  ...prev,
                                  [lead.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Sin definir</option>
                              {commissionSourceOptions.map((item) => (
                                <option key={item.value} value={item.value}>
                                  {item.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => guardarFuenteComision(lead.id)}
                              disabled={savingCommissionLeadId === lead.id}
                              className="rounded-2xl border border-[#5F7D66] bg-white px-5 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                            >
                              {savingCommissionLeadId === lead.id
                                ? "Guardando..."
                                : "Guardar fuente"}
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
  highlight = false,
}: {
  title: string;
  value: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 text-left shadow-[0_18px_40px_rgba(95,125,102,0.12)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(95,125,102,0.18)] ${
        active
          ? "border-[#7FA287] ring-2 ring-[#DDECE1]"
          : highlight
          ? "border-[#B7D6B9] bg-[linear-gradient(180deg,_rgba(248,255,249,0.98)_0%,_rgba(233,247,236,0.95)_100%)] hover:border-[#8CB88D]"
          : "border-[#D6E8DA] hover:border-[#9BC4AF]"
      }`}
    >
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
    </button>
  );
}

