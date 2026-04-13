"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { getLeadSourceLabel } from "@/lib/lead-source";

type LeadRow = {
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
  created_at: string;
  created_by_user_id: string;
  assigned_to_user_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
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
  notes: string | null;
};

type QuickFilter =
  | "todos"
  | "nuevos"
  | "pendientes"
  | "interesados"
  | "agendados"
  | "no_asistio"
  | "cerrados";

const allowedRoles = [
  "super_user",
  "promotor_opc",
  "supervisor_opc",
  "supervisor_call_center",
  "confirmador",
  "tmk",
];

const opcVisibleStatuses = [
  "nuevo",
  "pendiente_contacto",
  "interesado",
  "no_responde",
  "contactado",
  "reagendar",
  "agendado",
  "no_asistio",
  "asistio",
  "vendido",
  "cerrado",
  "descartado",
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
    case "nuevo":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "pendiente_contacto":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "interesado":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "no_responde":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "contactado":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "reagendar":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "agendado":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "asistio":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "no_asistio":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "vendido":
      return "border-green-200 bg-green-50 text-green-700";
    case "cerrado":
      return "border-slate-300 bg-slate-200 text-slate-800";
    case "descartado":
      return "border-red-200 bg-red-50 text-red-700";
    case "agendada":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "confirmada":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "en_espera":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "reagendada":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "en_atencion":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "cancelada":
      return "border-red-200 bg-red-50 text-red-700";
    case "finalizada":
      return "border-slate-300 bg-slate-200 text-slate-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(hoyISO());
  const [appointmentsDateFilter, setAppointmentsDateFilter] = useState(hoyISO());
  const [appointmentsSearch, setAppointmentsSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const showCreatorColumn =
    roleCode === "super_user" ||
    roleCode === "supervisor_opc" ||
    roleCode === "supervisor_call_center";

  const showSupervisorOpcTools =
    roleCode === "supervisor_opc" || roleCode === "super_user";

  const isSuperUser = roleCode === "super_user";

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
      setRoleCode(auth.roleCode);
      setCurrentUserId(auth.user.id);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function cargarLeads() {
    try {
      setLoading(true);
      setError("");

      const [leadsResult, appointmentsResult] = await Promise.all([
        supabase
          .from("leads")
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            phone,
            city,
            interest_service,
            capture_location,
            source,
            status,
            created_at,
            created_by_user_id,
            assigned_to_user_id
          `)
          .order("created_at", { ascending: false }),

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
            notes
          `)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true }),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      const leadsData = (leadsResult.data as LeadRow[]) || [];
      const appointmentsData = (appointmentsResult.data as AppointmentRow[]) || [];

      setLeads(leadsData);
      setAppointments(appointmentsData);

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

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);

      if (profilesError) throw profilesError;

      const namesMap: Record<string, string> = {};
      ((profilesData as ProfileRow[]) || []).forEach((profile) => {
        namesMap[profile.id] = profile.full_name?.trim() || "Sin nombre";
      });

      setCreatorNames(namesMap);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los leads.");
    } finally {
      setLoading(false);
    }
  }

  async function eliminarLead(lead: LeadRow) {
    if (!isSuperUser) return;

    const nombre =
      lead.full_name?.trim() ||
      `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
      "este lead";

    const confirmado = window.confirm(
      `¿Seguro que deseas borrar a ${nombre}? Esta acción eliminará también sus citas relacionadas y no se puede deshacer.`
    );

    if (!confirmado) return;

    try {
      setDeletingLeadId(lead.id);
      setError("");
      setSuccessMessage("");

      const { error: appointmentsDeleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("lead_id", lead.id);

      if (appointmentsDeleteError) throw appointmentsDeleteError;

      const { error: leadDeleteError } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id);

      if (leadDeleteError) throw leadDeleteError;

      setSuccessMessage("Lead eliminado correctamente.");
      await cargarLeads();
    } catch (err: any) {
      setError(err?.message || "No se pudo eliminar el lead.");
    } finally {
      setDeletingLeadId(null);
    }
  }

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      cargarLeads();
    }
  }, [authorized]);

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

  function getVisibleStatus(lead: LeadRow) {
    const hasActiveAppointment = !!activeAppointmentByLeadId[lead.id];
    if (hasActiveAppointment) return "agendado";
    return lead.status || "nuevo";
  }

  const leadsPorRol = useMemo(() => {
    if (!roleCode || !currentUserId) return [];

    if (roleCode === "super_user") return leads;
    if (roleCode === "supervisor_call_center") return leads;

    if (roleCode === "supervisor_opc") {
      return leads.filter((lead) => opcVisibleStatuses.includes(getVisibleStatus(lead)));
    }

    if (roleCode === "promotor_opc") {
      return leads.filter(
        (lead) =>
          lead.created_by_user_id === currentUserId &&
          opcVisibleStatuses.includes(getVisibleStatus(lead))
      );
    }

    if (roleCode === "confirmador" || roleCode === "tmk") {
      return leads.filter(
        (lead) =>
          lead.assigned_to_user_id === currentUserId ||
          lead.created_by_user_id === currentUserId
      );
    }

    return [];
  }, [leads, roleCode, currentUserId, activeAppointmentByLeadId]);

  function isPending(lead: LeadRow) {
    const estado = getVisibleStatus(lead);
    return estado === "pendiente_contacto" || estado === "no_responde";
  }

  function isInterested(lead: LeadRow) {
    const estado = getVisibleStatus(lead);
    return (
      estado === "interesado" ||
      estado === "contactado" ||
      estado === "reagendar"
    );
  }

  function isScheduled(lead: LeadRow) {
    return getVisibleStatus(lead) === "agendado";
  }

  function isNoAsistio(lead: LeadRow) {
    return getVisibleStatus(lead) === "no_asistio";
  }

  function isClosed(lead: LeadRow) {
    const estado = getVisibleStatus(lead);
    return (
      estado === "vendido" ||
      estado === "cerrado" ||
      estado === "descartado"
    );
  }

  const resumen = useMemo(() => {
    const delDia = leadsPorRol.filter(
      (lead) => soloFecha(lead.created_at) === dateFilter
    );

    return {
      total: delDia.length,
      nuevos: delDia.filter((lead) => getVisibleStatus(lead) === "nuevo").length,
      pendientes: delDia.filter((lead) => isPending(lead)).length,
      interesados: delDia.filter((lead) => isInterested(lead)).length,
      agendados: delDia.filter((lead) => isScheduled(lead)).length,
      noAsistio: delDia.filter((lead) => isNoAsistio(lead)).length,
      cerrados: delDia.filter((lead) => isClosed(lead)).length,
    };
  }, [leadsPorRol, dateFilter, activeAppointmentByLeadId]);

  const leadsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    let base = leadsPorRol.filter((lead) =>
      dateFilter ? soloFecha(lead.created_at) === dateFilter : true
    );

    if (showSupervisorOpcTools) {
      if (quickFilter === "nuevos") {
        base = base.filter((lead) => getVisibleStatus(lead) === "nuevo");
      }
      if (quickFilter === "pendientes") {
        base = base.filter((lead) => isPending(lead));
      }
      if (quickFilter === "interesados") {
        base = base.filter((lead) => isInterested(lead));
      }
      if (quickFilter === "agendados") {
        base = base.filter((lead) => isScheduled(lead));
      }
      if (quickFilter === "no_asistio") {
        base = base.filter((lead) => isNoAsistio(lead));
      }
      if (quickFilter === "cerrados") {
        base = base.filter((lead) => isClosed(lead));
      }
    }

    return base.filter((lead) => {
      if (!q) return true;

      const nombreCompleto =
        lead.full_name?.toLowerCase() ||
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim().toLowerCase();

      const telefono = (lead.phone || "").toLowerCase();
      const creador = (creatorNames[lead.created_by_user_id] || "").toLowerCase();

      return (
        nombreCompleto.includes(q) ||
        telefono.includes(q) ||
        creador.includes(q)
      );
    });
  }, [
    leadsPorRol,
    search,
    dateFilter,
    creatorNames,
    quickFilter,
    showSupervisorOpcTools,
    activeAppointmentByLeadId,
  ]);

  const citasSupervisorOpc = useMemo(() => {
    if (!showSupervisorOpcTools) return [];

    const leadsIdsEquipo = new Set(leadsPorRol.map((lead) => lead.id));

    return appointments.filter(
      (appointment) => appointment.lead_id && leadsIdsEquipo.has(appointment.lead_id)
    );
  }, [appointments, leadsPorRol, showSupervisorOpcTools]);

  const citasFiltradas = useMemo(() => {
    if (!showSupervisorOpcTools) return [];

    const q = appointmentsSearch.trim().toLowerCase();

    return citasSupervisorOpc.filter((appointment) => {
      const fechaOk = appointmentsDateFilter
        ? appointment.appointment_date === appointmentsDateFilter
        : true;

      const nombre = (appointment.patient_name || "").toLowerCase();
      const telefono = (appointment.phone || "").toLowerCase();

      const busquedaOk = q
        ? nombre.includes(q) || telefono.includes(q)
        : true;

      return fechaOk && busquedaOk;
    });
  }, [citasSupervisorOpc, appointmentsDateFilter, appointmentsSearch, showSupervisorOpcTools]);

  function formatDate(dateString: string) {
    try {
      return new Date(dateString).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateString;
    }
  }

  function translateStatus(status: string) {
    const map: Record<string, string> = {
      nuevo: "Nuevo",
      pendiente_contacto: "Pendiente",
      interesado: "Interesado",
      no_responde: "No responde",
      contactado: "Contactado",
      reagendar: "Reagendar",
      agendado: "Agendado",
      asistio: "Asistió",
      no_asistio: "No asistió",
      vendido: "Vendido",
      cerrado: "Cerrado",
      descartado: "Descartado",
      agendada: "Agendada",
      confirmada: "Confirmada",
      en_espera: "En espera",
      reagendada: "Reagendada",
      en_atencion: "En atención",
      cancelada: "Cancelada",
      finalizada: "Finalizada",
    };

    return map[status] || status;
  }

  function translateService(service: string | null) {
    if (!service) return "Sin servicio";

    const map: Record<string, string> = {
      detox: "Detox",
      sueroterapia: "Sueroterapia",
      valoracion: "Valoración",
      nutricion: "Nutrición",
      fisioterapia: "Fisioterapia",
      medicina_general: "Medicina general",
      otro: "Otro",
    };

    return map[service] || service;
  }

  function translateSource(source: string | null) {
    return getLeadSourceLabel(source);
  }

  function getCreatorName(userId: string) {
    return creatorNames[userId] || "Sin nombre";
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#F3D3D6] bg-white p-6 shadow-sm">
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

      <div className="relative mx-auto max-w-7xl space-y-6">
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

        <section className="rounded-[28px] border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#7FA287]">Leads</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">
                Gestión de leads
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-500">
                Consulta, filtra y administra los leads visibles según el rol autenticado.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center rounded-2xl border border-[#D6E8DA] bg-white px-5 py-3 text-sm font-medium text-[#4F6F5B] transition hover:border-[#BCD7C2] hover:bg-[#F4FAF6]"
            >
              Inicio
            </a>

            {(roleCode === "super_user" ||
              roleCode === "promotor_opc" ||
              roleCode === "supervisor_opc" ||
              roleCode === "supervisor_call_center" ||
              roleCode === "confirmador" ||
              roleCode === "tmk") && (
              <a
                href="/leads/nuevo"
                className="inline-flex items-center rounded-2xl bg-[#5F7D66] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#4F6F5B]"
              >
                Nuevo lead
              </a>
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {showSupervisorOpcTools ? (
          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard title="Todos" value={resumen.total} active={quickFilter === "todos"} onClick={() => setQuickFilter("todos")} />
            <StatCard title="Nuevos" value={resumen.nuevos} active={quickFilter === "nuevos"} onClick={() => setQuickFilter("nuevos")} />
            <StatCard title="Pendientes" value={resumen.pendientes} active={quickFilter === "pendientes"} onClick={() => setQuickFilter("pendientes")} />
            <StatCard title="Interesados" value={resumen.interesados} active={quickFilter === "interesados"} onClick={() => setQuickFilter("interesados")} />
            <StatCard title="Agendados" value={resumen.agendados} active={quickFilter === "agendados"} onClick={() => setQuickFilter("agendados")} />
            <StatCard title="No asistió" value={resumen.noAsistio} active={quickFilter === "no_asistio"} onClick={() => setQuickFilter("no_asistio")} />
          </section>
        ) : null}

        {showSupervisorOpcTools ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[28px] border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#24312A]">
                    Leads visibles para tu rol
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Busca por nombre, teléfono o nombre del OPC y filtra por fecha.
                  </p>
                </div>

                <button
                  onClick={cargarLeads}
                  className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:border-[#BCD7C2] hover:bg-[#F4FAF6]"
                >
                  Actualizar
                </button>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { key: "todos", label: "Todos" },
                  { key: "nuevos", label: "Nuevos" },
                  { key: "pendientes", label: "Pendientes" },
                  { key: "interesados", label: "Interesados" },
                  { key: "agendados", label: "Agendados" },
                  { key: "no_asistio", label: "No asistió" },
                  { key: "cerrados", label: "Cerrados" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setQuickFilter(item.key as QuickFilter)}
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

              <div className="mb-6 grid gap-3">
                <input
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />

                <input
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                  type="text"
                  placeholder="Buscar por nombre, teléfono u OPC"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                  Cargando leads...
                </div>
              ) : leadsFiltrados.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                  No hay leads visibles con esos filtros.
                </div>
              ) : (
                <div className="space-y-3">
                  {leadsFiltrados.map((lead) => {
                    const estadoVisible = getVisibleStatus(lead);

                    return (
                      <div
                        key={lead.id}
                        className="group rounded-3xl border border-[#D6E8DA] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-[#24312A] transition group-hover:text-[#4F6F5B]">
                              {lead.full_name?.trim() ||
                                `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                                "Sin nombre"}
                            </h3>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoBadge(
                                estadoVisible
                              )}`}
                            >
                              {translateStatus(estadoVisible)}
                            </span>
                          </div>

                          <p className="text-sm text-slate-700">
                            {lead.phone} · {lead.city || "Sin ciudad"}
                          </p>

                          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                            <p>Servicio: {translateService(lead.interest_service)}</p>
                            <p>Origen: {translateSource(lead.source)}</p>
                            <p>Captación: {lead.capture_location || "Sin lugar"}</p>
                            <p>OPC: {getCreatorName(lead.created_by_user_id)}</p>
                          </div>

                          <p className="text-sm text-slate-500">
                            Creado: {formatDate(lead.created_at)}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <a
                              href={`/leads/${lead.id}`}
                              className="inline-flex rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#4F6F5B]"
                            >
                              Ver / editar
                            </a>

                            {isSuperUser ? (
                              <button
                                type="button"
                                onClick={() => eliminarLead(lead)}
                                disabled={deletingLeadId === lead.id}
                                className="inline-flex rounded-2xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingLeadId === lead.id ? "Borrando..." : "Eliminar"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-2xl font-bold tracking-tight text-[#24312A]">
                  Citas agendadas del equipo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Filtra las citas por fecha para ver la agenda futura del equipo OPC.
                </p>
              </div>

              <div className="mb-6 grid gap-3">
                <input
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                  type="date"
                  value={appointmentsDateFilter}
                  onChange={(e) => setAppointmentsDateFilter(e.target.value)}
                />

                <input
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                  type="text"
                  placeholder="Buscar por nombre o teléfono"
                  value={appointmentsSearch}
                  onChange={(e) => setAppointmentsSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                  Cargando citas...
                </div>
              ) : citasFiltradas.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                  No hay citas del equipo con esos filtros.
                </div>
              ) : (
                <div className="space-y-3">
                  {citasFiltradas.map((appointment) => {
                    const leadRelacionado = leads.find((lead) => lead.id === appointment.lead_id);

                    return (
                      <div
                        key={appointment.id}
                        className="group rounded-3xl border border-[#D6E8DA] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-[#24312A] transition group-hover:text-[#4F6F5B]">
                              {appointment.patient_name || "Sin nombre"}
                            </h3>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoBadge(
                                appointment.status
                              )}`}
                            >
                              {translateStatus(appointment.status)}
                            </span>
                          </div>

                          <p className="text-sm text-slate-700">
                            {appointment.phone || "Sin teléfono"} · {appointment.city || "Sin ciudad"}
                          </p>

                          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                            <p>Servicio: {translateService(appointment.service_type)}</p>
                            <p>
                              Fecha: {appointment.appointment_date} · Hora: {appointment.appointment_time?.slice(0, 5)}
                            </p>
                            <p className="md:col-span-2">
                              OPC:{" "}
                              {leadRelacionado
                                ? getCreatorName(leadRelacionado.created_by_user_id)
                                : "Sin OPC"}
                            </p>
                          </div>

                          {leadRelacionado ? (
                            <div>
                              <a
                                href={`/leads/${leadRelacionado.id}`}
                                className="inline-flex rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#4F6F5B]"
                              >
                                Ver lead
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="rounded-[28px] border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#24312A]">
                  Leads visibles para tu rol
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {showCreatorColumn
                    ? "Busca por nombre, teléfono o nombre del OPC y filtra por fecha."
                    : "Busca por nombre o teléfono y filtra por fecha."}
                </p>
              </div>

              <button
                onClick={cargarLeads}
                className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:border-[#BCD7C2] hover:bg-[#F4FAF6]"
              >
                Actualizar
              </button>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />

              <input
                className="rounded-2xl border border-[#D6E8DA] bg-[#FCFDFC] p-4 text-[#24312A] outline-none transition focus:border-[#A8CDBD] focus:ring-2 focus:ring-[#A8CDBD]/30"
                type="text"
                placeholder={
                  showCreatorColumn
                    ? "Buscar por nombre, teléfono u OPC"
                    : "Buscar por nombre o teléfono"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                Cargando leads...
              </div>
            ) : leadsFiltrados.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                No hay leads visibles con esos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-[#E3ECE5] bg-[#FCFDFC] p-3">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-4">Nombre</th>
                      <th className="px-4">Teléfono</th>
                      <th className="px-4">Ciudad</th>
                      <th className="px-4">Servicio</th>
                      <th className="px-4">Origen</th>
                      <th className="px-4">Captación</th>
                      {showCreatorColumn && <th className="px-4">OPC</th>}
                      <th className="px-4">Estado</th>
                      <th className="px-4">Creado</th>
                      <th className="px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsFiltrados.map((lead) => {
                      const estadoVisible = getVisibleStatus(lead);

                      return (
                        <tr
                          key={lead.id}
                          className="rounded-3xl border border-[#D6E8DA] bg-white shadow-sm"
                        >
                          <td className="rounded-l-3xl px-4 py-4 font-semibold text-[#24312A]">
                            {lead.full_name?.trim() ||
                              `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
                              "Sin nombre"}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-700">
                            {lead.phone}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-700">
                            {lead.city || "Sin ciudad"}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-700">
                            {translateService(lead.interest_service)}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-700">
                            {translateSource(lead.source)}
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-700">
                            {lead.capture_location || "Sin lugar"}
                          </td>

                          {showCreatorColumn && (
                            <td className="px-4 py-4 text-sm text-slate-700">
                              {getCreatorName(lead.created_by_user_id)}
                            </td>
                          )}

                          <td className="px-4 py-4 text-sm">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${estadoBadge(
                                estadoVisible
                              )}`}
                            >
                              {translateStatus(estadoVisible)}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-sm text-slate-500">
                            {formatDate(lead.created_at)}
                          </td>

                          <td className="rounded-r-3xl px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={`/leads/${lead.id}`}
                                className="inline-flex rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#4F6F5B]"
                              >
                                Ver / editar
                              </a>

                              {isSuperUser ? (
                                <button
                                  type="button"
                                  onClick={() => eliminarLead(lead)}
                                  disabled={deletingLeadId === lead.id}
                                  className="inline-flex rounded-2xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deletingLeadId === lead.id ? "Borrando..." : "Eliminar"}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
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
      className={`group overflow-hidden rounded-3xl border bg-white p-0 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${
        active ? "border-[#7FA287] ring-2 ring-[#A8CDBD]/40" : "border-[#D6E8DA]"
      }`}
    >
      <div className="h-1 w-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <div className="p-5">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">
          {value}
        </p>
      </div>
    </button>
  );
}
