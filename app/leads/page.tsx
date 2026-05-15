"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { getLeadSourceLabel } from "@/lib/lead-source";
import { dateToLocalISO } from "@/lib/datetime/dateHelpers";
import {
  leadBelongsToOperationalGroup,
  normalizeOperationalGroupCode,
} from "@/lib/leads/group-routing";

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
  commission_group_code: string | null;
};

type OpcTeamPromoter = {
  id: string;
  full_name: string | null;
  commission_group_code: string | null;
};

type OpcWorkSessionRow = {
  id: string;
  user_id: string;
  work_date: string;
  started_at: string;
  ended_at: string | null;
  is_scheduled: boolean | null;
  unavailable_reason: string | null;
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
  | "pendientes_cita"
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

const OPC_DAILY_LEAD_GOAL = 30;
const OPC_DAILY_WORK_HOURS = 6;
const OPC_TARGET_LEADS_PER_HOUR = OPC_DAILY_LEAD_GOAL / OPC_DAILY_WORK_HOURS;

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function soloFecha(fecha: string | null | undefined) {
  if (!fecha) return "";
  if (fecha.includes("T")) return dateToLocalISO(fecha);
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
  const [profileGroupCodes, setProfileGroupCodes] = useState<Record<string, string | null>>({});
  const [currentCommissionGroupCode, setCurrentCommissionGroupCode] = useState<string | null>(null);
  const [opcTeamPromoters, setOpcTeamPromoters] = useState<OpcTeamPromoter[]>([]);
  const [opcWorkSessions, setOpcWorkSessions] = useState<OpcWorkSessionRow[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(hoyISO());
  const [appointmentsDateFilter, setAppointmentsDateFilter] = useState(hoyISO());
  const [appointmentsSearch, setAppointmentsSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [opcReportPromoterId, setOpcReportPromoterId] = useState("todos");
  const [startingOpcShift, setStartingOpcShift] = useState(false);
  const [savingAvailabilityUserId, setSavingAvailabilityUserId] = useState<string | null>(null);

  const showCreatorColumn =
    roleCode === "super_user" ||
    roleCode === "supervisor_opc" ||
    roleCode === "supervisor_call_center";

  const showSupervisorOpcTools =
    roleCode === "supervisor_opc" || roleCode === "super_user";
  const showTmkSchedulingTools = roleCode === "tmk";
  const currentOperationalGroupCode = normalizeOperationalGroupCode(
    currentCommissionGroupCode
  );
  const isCallCenterCzReportRole =
    (roleCode === "supervisor_call_center" || roleCode === "confirmador") &&
    currentOperationalGroupCode === "CZ";
  const canViewOpcPromoterReport =
    showSupervisorOpcTools ||
    roleCode === "promotor_opc" ||
    isCallCenterCzReportRole;
  const showTeamOpcPromoterReport =
    showSupervisorOpcTools || isCallCenterCzReportRole;
  const showLeadStatusFilters = showSupervisorOpcTools || showTmkSchedulingTools;

  const isSuperUser = roleCode === "super_user";
  const canScheduleFromLeadsList =
    roleCode === "tmk" ||
    roleCode === "confirmador" ||
    roleCode === "supervisor_call_center" ||
    roleCode === "super_user";
  const hideLeadHeroMeta = roleCode === "supervisor_opc";
  const currentOpcShift = useMemo(() => {
    if (!currentUserId || !dateFilter) return null;
    return (
      opcWorkSessions.find(
        (item) => item.user_id === currentUserId && item.work_date === dateFilter
      ) || null
    );
  }, [currentUserId, dateFilter, opcWorkSessions]);

  async function cargarJornadasOpc(fecha = dateFilter) {
    if (!fecha) {
      setOpcWorkSessions([]);
      return;
    }

    const { data, error: sessionsError } = await supabase
      .from("opc_work_sessions")
      .select("id, user_id, work_date, started_at, ended_at, is_scheduled, unavailable_reason")
      .eq("work_date", fecha);

    if (sessionsError) throw sessionsError;
    setOpcWorkSessions((data as OpcWorkSessionRow[]) || []);
  }

  async function iniciarJornadaOpc() {
    if (!currentUserId || !dateFilter || roleCode !== "promotor_opc") return;

    try {
      setStartingOpcShift(true);
      setError("");
      setSuccessMessage("");

      const { error: upsertError } = await supabase
        .from("opc_work_sessions")
        .upsert(
          {
            user_id: currentUserId,
            work_date: dateFilter,
            started_at: new Date().toISOString(),
            ended_at: null,
            is_scheduled: true,
            unavailable_reason: null,
          },
          { onConflict: "user_id,work_date", ignoreDuplicates: true }
        );

      if (upsertError) throw upsertError;

      await cargarJornadasOpc(dateFilter);
      setSuccessMessage("Jornada iniciada. Desde ahora medimos tu ritmo de 5 leads por hora.");
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar la jornada OPC.");
    } finally {
      setStartingOpcShift(false);
    }
  }

  async function actualizarDisponibilidadOpc(promoterId: string, isScheduled: boolean) {
    if (!dateFilter || !showTeamOpcPromoterReport) return;

    try {
      setSavingAvailabilityUserId(promoterId);
      setError("");
      setSuccessMessage("");

      const existing = opcWorkSessions.find(
        (item) => item.user_id === promoterId && item.work_date === dateFilter
      );

      const payload = {
        user_id: promoterId,
        work_date: dateFilter,
        started_at: existing?.started_at || new Date(`${dateFilter}T00:00:00`).toISOString(),
        ended_at: existing?.ended_at || null,
        is_scheduled: isScheduled,
        unavailable_reason: isScheduled ? null : "No trabaja hoy",
      };

      const { error: availabilityError } = await supabase
        .from("opc_work_sessions")
        .upsert(payload, { onConflict: "user_id,work_date" });

      if (availabilityError) throw availabilityError;

      await cargarJornadasOpc(dateFilter);
      setSuccessMessage(
        isScheduled
          ? "Promotor marcado como disponible para la meta del día."
          : "Promotor marcado como no trabaja hoy; no suma a la meta diaria."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la disponibilidad del promotor.");
    } finally {
      setSavingAvailabilityUserId(null);
    }
  }

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesiÃ³n para usar este mÃ³dulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a este mÃ³dulo.");
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
      await cargarJornadasOpc(dateFilter);

      const creatorIds = Array.from(
        new Set(
          leadsData
            .map((lead) => lead.created_by_user_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      const assignedIds = Array.from(
        new Set(
          leadsData
            .map((lead) => lead.assigned_to_user_id)
            .filter((id): id is string => Boolean(id))
        )
      );
      const profileIds = Array.from(
        new Set(
          [...creatorIds, ...assignedIds, currentUserId].filter(
            (id): id is string => Boolean(id)
          )
        )
      );

      if (profileIds.length === 0) {
        setCreatorNames({});
        setProfileGroupCodes({});
        setCurrentCommissionGroupCode(null);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, commission_group_code")
        .in("id", profileIds);

      if (profilesError) throw profilesError;

      const namesMap: Record<string, string> = {};
      const groupMap: Record<string, string | null> = {};
      ((profilesData as ProfileRow[]) || []).forEach((profile) => {
        if (creatorIds.includes(profile.id)) {
          namesMap[profile.id] = profile.full_name?.trim() || "Sin nombre";
        }
        groupMap[profile.id] = normalizeOperationalGroupCode(profile.commission_group_code);
      });

      const currentGroupCode = groupMap[currentUserId || ""] || null;
      const { data: promoterRolesData, error: promoterRolesError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          profiles!user_roles_user_id_fkey (
            id,
            full_name,
            commission_group_code,
            is_active
          ),
          roles!user_roles_role_id_fkey (
            code
          )
        `);

      if (promoterRolesError) throw promoterRolesError;

      const teamPromoters = (
        (promoterRolesData as
          | Array<{
              user_id: string;
              profiles:
                | {
                    id: string;
                    full_name: string | null;
                    commission_group_code: string | null;
                    is_active: boolean | null;
                  }
                | Array<{
                    id: string;
                    full_name: string | null;
                    commission_group_code: string | null;
                    is_active: boolean | null;
                  }>
                | null;
              roles:
                | { code: string | null }
                | Array<{ code: string | null }>
                | null;
            }>
          | null) || []
      )
        .filter((item) => {
          const roles = Array.isArray(item.roles)
            ? item.roles
            : item.roles
              ? [item.roles]
              : [];
          return roles.some((role) => role?.code === "promotor_opc");
        })
        .map((item) => {
          const profile = Array.isArray(item.profiles)
            ? item.profiles[0]
            : item.profiles;
          return profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                commission_group_code: normalizeOperationalGroupCode(profile.commission_group_code),
                is_active: Boolean(profile.is_active),
              }
            : null;
        })
        .filter((profile): profile is OpcTeamPromoter & { is_active: boolean } => Boolean(profile))
        .filter((profile) => profile.is_active)
        .filter((profile) => {
          if (roleCode === "super_user") return true;
          if (
            (roleCode === "supervisor_call_center" || roleCode === "confirmador") &&
            currentGroupCode === "CZ"
          ) {
            return true;
          }
          if (roleCode === "promotor_opc") return profile.id === currentUserId;
          return Boolean(currentGroupCode && profile.commission_group_code === currentGroupCode);
        })
        .sort((a, b) =>
          (a.full_name || "Sin nombre").localeCompare(b.full_name || "Sin nombre", "es")
        );

      teamPromoters.forEach((profile) => {
        namesMap[profile.id] = profile.full_name?.trim() || "Sin nombre";
        groupMap[profile.id] = profile.commission_group_code;
      });

      setCreatorNames(namesMap);
      setProfileGroupCodes(groupMap);
      setCurrentCommissionGroupCode(currentGroupCode);
      setOpcTeamPromoters(teamPromoters);
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
      `Â¿Seguro que deseas borrar a ${nombre}? Esta acciÃ³n eliminarÃ¡ tambiÃ©n sus citas relacionadas y no se puede deshacer.`
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
    const params = new URLSearchParams(window.location.search);
    const requestedFilter = params.get("filter") as QuickFilter | null;
    const requestedDate = params.get("date");
    const validFilters = new Set<QuickFilter>([
      "todos",
      "nuevos",
      "pendientes",
      "interesados",
      "pendientes_cita",
      "agendados",
      "no_asistio",
      "cerrados",
    ]);

    if (requestedFilter && validFilters.has(requestedFilter)) {
      setQuickFilter(requestedFilter);
    }

    if (requestedDate === "all") {
      setDateFilter("");
    } else if (requestedDate === "today") {
      setDateFilter(hoyISO());
    } else if (requestedDate) {
      setDateFilter(requestedDate);
    }
  }, []);

  useEffect(() => {
    if (authorized && currentUserId) {
      cargarLeads();
    }
  }, [authorized, currentUserId, roleCode]);

  useEffect(() => {
    if (!authorized || !currentUserId || !canViewOpcPromoterReport) return;
    cargarJornadasOpc(dateFilter).catch((err) => {
      console.warn("No se pudieron cargar jornadas OPC", err);
    });
  }, [authorized, currentUserId, dateFilter, canViewOpcPromoterReport]);

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
    if (roleCode === "supervisor_call_center" || roleCode === "confirmador") {
      const currentGroupCode = normalizeOperationalGroupCode(currentCommissionGroupCode);

      if (!currentGroupCode && roleCode === "supervisor_call_center") return leads;

      return leads.filter((lead) => {
        if (!currentGroupCode) {
          return (
            lead.assigned_to_user_id === currentUserId ||
            lead.created_by_user_id === currentUserId
          );
        }

        return leadBelongsToOperationalGroup({
          currentGroupCode,
          source: lead.source,
          createdAt: lead.created_at,
          creatorGroupCode: profileGroupCodes[lead.created_by_user_id],
          assignedUserGroupCode: profileGroupCodes[lead.assigned_to_user_id || ""],
          currentUserId,
          leadCreatedByUserId: lead.created_by_user_id,
          leadAssignedToUserId: lead.assigned_to_user_id,
        });
      });
    }

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

    if (roleCode === "tmk") {
      return leads.filter(
        (lead) =>
          lead.assigned_to_user_id === currentUserId ||
          lead.created_by_user_id === currentUserId
      );
    }

    return [];
  }, [
    leads,
    roleCode,
    currentUserId,
    currentCommissionGroupCode,
    profileGroupCodes,
    activeAppointmentByLeadId,
  ]);

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

  function isPendingSchedule(lead: LeadRow) {
    return !isScheduled(lead) && getVisibleStatus(lead) === "contactado";
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
      pendientesCita: delDia.filter((lead) => isPendingSchedule(lead)).length,
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

    if (showLeadStatusFilters) {
      if (quickFilter === "nuevos") {
        base = base.filter((lead) => getVisibleStatus(lead) === "nuevo");
      }
      if (quickFilter === "pendientes") {
        base = base.filter((lead) => isPending(lead));
      }
      if (quickFilter === "interesados") {
        base = base.filter((lead) => isInterested(lead));
      }
      if (quickFilter === "pendientes_cita") {
        base = base.filter((lead) => isPendingSchedule(lead));
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
    showLeadStatusFilters,
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

  const opcPromoterReport = useMemo(() => {
    if (!canViewOpcPromoterReport) {
      return {
        rows: [],
        filteredRows: [],
        totalLeads: 0,
        totalGoal: 0,
        totalProgress: 0,
        selectedDateHasGoal: Boolean(dateFilter),
      };
    }

    const selectedDateHasGoal = Boolean(dateFilter);
    const isToday = dateFilter === hoyISO();
    const sessionsByUser = new Map(opcWorkSessions.map((item) => [item.user_id, item]));
    const grouped = new Map<
      string,
      {
        promoterId: string;
        promoterName: string;
        total: number;
        newCount: number;
        scheduledCount: number;
        closedCount: number;
        firstCreatedAt: string | null;
        countsForGoal: boolean;
      }
    >();

    opcTeamPromoters.forEach((promoter) => {
      const session = sessionsByUser.get(promoter.id);
      grouped.set(promoter.id, {
        promoterId: promoter.id,
        promoterName: promoter.full_name?.trim() || "Sin nombre",
        total: 0,
        newCount: 0,
        scheduledCount: 0,
        closedCount: 0,
        firstCreatedAt: null,
        countsForGoal: session?.is_scheduled !== false,
      });
    });

    const teamPromoterIds = new Set(opcTeamPromoters.map((item) => item.id));

    leadsPorRol
      .filter((lead) => lead.source === "opc")
      .filter((lead) => {
        if (teamPromoterIds.size === 0) return true;
        return teamPromoterIds.has(lead.created_by_user_id);
      })
      .filter((lead) => (dateFilter ? soloFecha(lead.created_at) === dateFilter : true))
      .forEach((lead) => {
        const promoterId = lead.created_by_user_id || "sin_promotor";
        const current =
          grouped.get(promoterId) ||
          {
            promoterId,
            promoterName: getCreatorName(promoterId),
            total: 0,
            newCount: 0,
            scheduledCount: 0,
            closedCount: 0,
            firstCreatedAt: null,
            countsForGoal: true,
          };

        const status = getVisibleStatus(lead);
        current.total += 1;
        if (status === "nuevo") current.newCount += 1;
        if (status === "agendado") current.scheduledCount += 1;
        if (isClosed(lead)) current.closedCount += 1;
        if (!current.firstCreatedAt || Date.parse(lead.created_at) < Date.parse(current.firstCreatedAt)) {
          current.firstCreatedAt = lead.created_at;
        }

        grouped.set(promoterId, current);
      });

    const rows = Array.from(grouped.values())
      .map((item) => {
        const workSession = sessionsByUser.get(item.promoterId) || null;
        const elapsedHours =
          selectedDateHasGoal && workSession
            ? Math.min(
                OPC_DAILY_WORK_HOURS,
                Math.max(
                  0,
                  ((workSession.ended_at
                    ? Date.parse(workSession.ended_at)
                    : isToday
                      ? Date.now()
                      : Date.parse(workSession.started_at) + OPC_DAILY_WORK_HOURS * 3600000) -
                    Date.parse(workSession.started_at)) /
                    3600000
                )
              )
            : 0;
        const expectedSoFar = selectedDateHasGoal
          ? Math.min(OPC_DAILY_LEAD_GOAL, Math.ceil(elapsedHours * OPC_TARGET_LEADS_PER_HOUR))
          : 0;
        const progress = selectedDateHasGoal
          ? Math.min(100, Math.round((item.total / OPC_DAILY_LEAD_GOAL) * 100))
          : 0;
        const hourlyAverage = elapsedHours > 0 ? item.total / elapsedHours : 0;
        const expectedRatio = expectedSoFar > 0 ? item.total / expectedSoFar : 0;
        const status =
          !selectedDateHasGoal
            ? "Selecciona fecha"
            : !item.countsForGoal
              ? "No trabaja hoy"
            : !workSession
              ? "Sin iniciar"
            : item.total >= OPC_DAILY_LEAD_GOAL
              ? "Meta cumplida"
              : item.total >= expectedSoFar
                ? "Va bien"
                : expectedRatio < 0.5
                  ? "Va muy mal"
                  : "Va quedada";
        const tone =
          status === "Selecciona fecha" || status === "Sin iniciar" || status === "No trabaja hoy"
            ? "neutral"
            : status === "Meta cumplida" || status === "Va bien"
              ? "good"
              : status === "Va quedada"
                ? "warning"
                : "danger";

        return {
          ...item,
          expectedSoFar,
          progress,
          hourlyAverage,
          status,
          tone,
          workStartedAt: workSession?.started_at || null,
          elapsedHours,
          countsForGoal: item.countsForGoal,
        };
      })
      .sort((a, b) => b.total - a.total || a.promoterName.localeCompare(b.promoterName));

    const filteredRows =
      opcReportPromoterId === "todos"
        ? rows
        : rows.filter((item) => item.promoterId === opcReportPromoterId);
    const totalLeads = filteredRows.reduce((sum, item) => sum + item.total, 0);
    const goalRows = filteredRows.filter((item) => item.countsForGoal);
    const totalGoal = selectedDateHasGoal
      ? goalRows.length * OPC_DAILY_LEAD_GOAL
      : 0;
    const totalProgress =
      selectedDateHasGoal && totalGoal > 0
        ? Math.min(100, Math.round((totalLeads / totalGoal) * 100))
        : 0;

    return {
      rows,
      filteredRows,
      totalLeads,
      totalGoal,
      totalProgress,
      selectedDateHasGoal,
    };
  }, [
    canViewOpcPromoterReport,
    leadsPorRol,
    dateFilter,
    opcReportPromoterId,
    opcTeamPromoters,
    opcWorkSessions,
    creatorNames,
    activeAppointmentByLeadId,
  ]);

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
      asistio: "AsistiÃ³",
      no_asistio: "No asistió",
      vendido: "Vendido",
      cerrado: "Cerrado",
      descartado: "Descartado",
      agendada: "Agendada",
      confirmada: "Confirmada",
      en_espera: "En espera",
      reagendada: "Reagendada",
      en_atencion: "En atenciÃ³n",
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
      valoracion: "ValoraciÃ³n",
      nutricion: "NutriciÃ³n",
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
            {error || "No tienes permiso para entrar a este mÃ³dulo."}
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
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Leads</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.1rem]">
                Gestión de leads
              </h1>
              {!hideLeadHeroMeta ? (
                <>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Consulta, filtra y administra los leads visibles según el rol autenticado.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">Vista de prospección</span>
                <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">Prevital menta + hoja</span>
              </div>
                </>
              ) : null}
            </div>

            <SessionBadge />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/crm"
              className="inline-flex items-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-5 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </Link>

            {(roleCode === "super_user" ||
              roleCode === "promotor_opc" ||
              roleCode === "supervisor_opc" ||
              roleCode === "supervisor_call_center" ||
              roleCode === "confirmador" ||
              roleCode === "tmk") && (
              <Link
                href="/leads/nuevo"
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_28px_rgba(95,125,102,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Nuevo lead
              </Link>
            )}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-[linear-gradient(135deg,_#FFF5F5_0%,_#FFF0F0_100%)] p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-[#BFE0CD] bg-[linear-gradient(135deg,_#F1FBF5_0%,_#E8F7EF_100%)] p-4 text-sm text-[#2D6B4A] shadow-sm">
            {successMessage}
          </div>
        ) : null}

        {showTmkSchedulingTools ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Todos" value={resumen.total} active={quickFilter === "todos"} onClick={() => setQuickFilter("todos")} />
            <StatCard title="Pendientes" value={resumen.pendientes} active={quickFilter === "pendientes"} onClick={() => setQuickFilter("pendientes")} />
            <StatCard title="Por agendar" value={resumen.pendientesCita} active={quickFilter === "pendientes_cita"} onClick={() => setQuickFilter("pendientes_cita")} />
            <StatCard title="Agendados" value={resumen.agendados} active={quickFilter === "agendados"} onClick={() => setQuickFilter("agendados")} />
          </section>
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

        {canViewOpcPromoterReport ? (
          <section className="overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.98)_0%,_rgba(238,249,242,0.96)_100%)] shadow-[0_24px_60px_rgba(95,125,102,0.14)]">
            <div className="grid gap-5 p-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                  Reporte OPC
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#24312A]">
                  {showTeamOpcPromoterReport ? "Leads por promotor" : "Tu estadística del día"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#51695C]">
                  Meta diaria: 30 leads por promotor. Jornada: 6 horas. Ritmo esperado: 5 leads por hora desde que se inicia la jornada.
                </p>
                {roleCode === "promotor_opc" && dateFilter === hoyISO() ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {currentOpcShift ? (
                      <span className="inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                        Jornada iniciada a las{" "}
                        {new Date(currentOpcShift.started_at).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void iniciarJornadaOpc()}
                        disabled={startingOpcShift}
                        className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                      >
                        {startingOpcShift ? "Iniciando..." : "Iniciar jornada"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 rounded-[28px] border border-[#D6E8DA] bg-white/85 p-4 shadow-sm md:grid-cols-2">
                {showTeamOpcPromoterReport ? (
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#5F7D66]">
                      Promotor
                    </span>
                    <select
                      className="w-full rounded-2xl border border-[#CFE4D8] bg-white p-3 text-sm text-[#24312A] shadow-sm outline-none transition focus:border-[#A8CDBD] focus:ring-4 focus:ring-[#DDEFE4]"
                      value={opcReportPromoterId}
                      onChange={(e) => setOpcReportPromoterId(e.target.value)}
                    >
                      <option value="todos">Todos los promotores</option>
                      {opcPromoterReport.rows.map((item) => (
                        <option key={item.promoterId} value={item.promoterId}>
                          {item.promoterName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-[#E2EFE7] bg-[#F7FCF9] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F7D66]">
                      Vista personal
                    </p>
                    <p className="mt-2 text-sm text-[#51695C]">
                      Solo ves tus leads OPC del día contra tu meta.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-[#E2EFE7] bg-[#F7FCF9] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F7D66]">
                    Avance del filtro
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#24312A]">
                    {opcPromoterReport.totalLeads}
                    <span className="text-base font-semibold text-[#6A7C70]">
                      {opcPromoterReport.selectedDateHasGoal ? ` / ${opcPromoterReport.totalGoal}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[#51695C]">
                    {opcPromoterReport.selectedDateHasGoal
                      ? `${opcPromoterReport.totalProgress}% de la meta`
                      : "Selecciona una fecha para medir contra la meta diaria."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#DDEDE4] bg-white/55 p-4 md:p-6">
              {opcPromoterReport.filteredRows.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#CFE4D8] bg-white/80 p-5 text-sm text-slate-500">
                  No hay leads OPC para este filtro.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {opcPromoterReport.filteredRows.map((item) => {
                    const toneClass =
                      item.tone === "neutral"
                        ? "border-slate-200 bg-slate-50 text-slate-600"
                        : item.tone === "good"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : item.tone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-rose-200 bg-rose-50 text-rose-700";
                    const progressClass =
                      item.tone === "good"
                        ? "bg-[linear-gradient(90deg,_#7ABF93_0%,_#477D5C_100%)]"
                        : item.tone === "warning"
                          ? "bg-[linear-gradient(90deg,_#E9B86B_0%,_#B9782D_100%)]"
                          : item.tone === "danger"
                            ? "bg-[linear-gradient(90deg,_#F18B8B_0%,_#C24141_100%)]"
                            : "bg-[linear-gradient(90deg,_#CBD5E1_0%,_#64748B_100%)]";

                    return (
                      <article
                        key={item.promoterId}
                        className="rounded-[28px] border border-[#D6E8DA] bg-white p-5 shadow-[0_16px_34px_rgba(95,125,102,0.1)]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-[#24312A]">
                              {item.promoterName}
                            </h3>
                            <p className="mt-1 text-sm text-[#51695C]">
                              {item.total} leads creados
                              {opcPromoterReport.selectedDateHasGoal && item.workStartedAt
                                ? ` · esperado hasta ahora: ${item.expectedSoFar}`
                                : opcPromoterReport.selectedDateHasGoal
                                  ? " · jornada sin iniciar"
                                : ""}
                            </p>
                          </div>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {showTeamOpcPromoterReport ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void actualizarDisponibilidadOpc(item.promoterId, !item.countsForGoal)}
                              disabled={savingAvailabilityUserId === item.promoterId}
                              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                                item.countsForGoal
                                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {savingAvailabilityUserId === item.promoterId
                                ? "Guardando..."
                                : item.countsForGoal
                                  ? "No trabaja hoy"
                                  : "Marcar disponible"}
                            </button>
                          </div>
                        ) : null}

                        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E5F0E9]">
                          <div
                            className={`h-full rounded-full ${progressClass}`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-[#51695C] sm:grid-cols-5">
                          <p>
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#6A7C70]">
                              Promedio
                            </span>
                            {item.workStartedAt ? `${item.hourlyAverage.toFixed(1)}/h` : "Sin iniciar"}
                          </p>
                          <p>
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#6A7C70]">
                              Tiempo
                            </span>
                            {item.workStartedAt ? `${item.elapsedHours.toFixed(1)}h` : "0h"}
                          </p>
                          <p>
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#6A7C70]">
                              Nuevos
                            </span>
                            {item.newCount}
                          </p>
                          <p>
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#6A7C70]">
                              Agendados
                            </span>
                            {item.scheduledCount}
                          </p>
                          <p>
                            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#6A7C70]">
                              Cerrados
                            </span>
                            {item.closedCount}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {showSupervisorOpcTools ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#24312A]">
                    Leads visibles para tu rol
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[#51695C]">
                    {"Busca por nombre, teléfono o nombre del OPC y filtra por fecha."}
                  </p>
                </div>

                <button
                  onClick={cargarLeads}
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
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
                        ? "bg-[linear-gradient(135deg,_#6D9D88_0%,_#5F7D66_100%)] text-white shadow-[0_14px_26px_rgba(95,125,102,0.22)]"
                        : "border border-[#D6E8DA] bg-white/90 text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mb-6 grid gap-3">
                <input
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#A8CDBD] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />

                <input
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#A8CDBD] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="text"
                  placeholder={"Buscar por nombre, teléfono u OPC"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                  Cargando leads...
                </div>
              ) : leadsFiltrados.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                  No hay leads visibles con esos filtros.
                </div>
              ) : (
                <div className="space-y-3">
                  {leadsFiltrados.map((lead) => {
                    const estadoVisible = getVisibleStatus(lead);

                    return (
                      <div
                        key={lead.id}
                        className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
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
                            {lead.phone}
                            {" · "}
                            {lead.city || "Sin ciudad"}
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
                              className="inline-flex rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_22px_rgba(95,125,102,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                            >
                              Ver / editar
                            </a>

                            {canScheduleFromLeadsList && !isScheduled(lead) ? (
                              <a
                                href={`/recepcion?leadId=${lead.id}&view=agenda`}
                                className="inline-flex rounded-2xl border border-[#5F7D66] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:bg-[#F4FAF6]"
                              >
                                Agendar cita
                              </a>
                            ) : null}

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

            <section className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div className="mb-5">
                <h2 className="text-2xl font-bold tracking-tight text-[#24312A]">
                  Citas agendadas del equipo
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#51695C]">
                  Filtra las citas por fecha para ver la agenda futura del equipo OPC.
                </p>
              </div>

              <div className="mb-6 grid gap-3">
                <input
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#A8CDBD] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="date"
                  value={appointmentsDateFilter}
                  onChange={(e) => setAppointmentsDateFilter(e.target.value)}
                />

                <input
                  className="rounded-2xl border border-[#CFE4D8] bg-white/90 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#A8CDBD] focus:ring-4 focus:ring-[#DDEFE4]"
                  type="text"
                  placeholder={"Buscar por nombre o teléfono"}
                  value={appointmentsSearch}
                  onChange={(e) => setAppointmentsSearch(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                  Cargando citas...
                </div>
              ) : citasFiltradas.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#CFE4D8] bg-[linear-gradient(135deg,_#FAFDFB_0%,_#F3FAF6_100%)] p-6 text-sm text-slate-500">
                  No hay citas del equipo con esos filtros.
                </div>
              ) : (
                <div className="space-y-3">
                  {citasFiltradas.map((appointment) => {
                    const leadRelacionado = leads.find((lead) => lead.id === appointment.lead_id);

                    return (
                      <div
                        key={appointment.id}
                        className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
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
                            {appointment.phone || "Sin teléfono"}
                            {" · "}
                            {appointment.city || "Sin ciudad"}
                          </p>

                          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                            <p>Servicio: {translateService(appointment.service_type)}</p>
                            <p>
                              {"Fecha: "}
                              {appointment.appointment_date}
                              {" · Hora: "}
                              {appointment.appointment_time?.slice(0, 5)}
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

                              {canScheduleFromLeadsList && !isScheduled(lead) ? (
                                <a
                                  href={`/recepcion?leadId=${lead.id}&view=agenda`}
                                  className="inline-flex rounded-2xl border border-[#5F7D66] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                                >
                                  Agendar cita
                                </a>
                              ) : null}

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
      className={`group overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-0 text-left shadow-[0_18px_40px_rgba(95,125,102,0.12)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(95,125,102,0.18)] ${
        active ? "border-[#7FA287] ring-2 ring-[#A8CDBD]/40" : "border-[#D6E8DA] hover:border-[#9BC4AF]"
      }`}
    >
      <div className="h-1.5 w-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <div className="p-5">
        <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">
          {value}
        </p>
      </div>
    </button>
  );
}


