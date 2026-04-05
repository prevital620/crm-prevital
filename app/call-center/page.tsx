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
  status: string;
  observations: string | null;
  created_at: string;
  assigned_to_user_id: string | null;
};

type CallCenterUser = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};

const statusOptions = [
  { value: "nuevo", label: "Nuevo" },
  { value: "pendiente_contacto", label: "Pendiente de contacto" },
  { value: "contactado", label: "Contactado" },
  { value: "agendado", label: "Agendado" },
  { value: "asistio", label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
  { value: "vendido", label: "Vendido" },
  { value: "cerrado", label: "Cerrado" },
  { value: "descartado", label: "Descartado" },
];

const allowedRoles = [
  "super_user",
  "supervisor_call_center",
  "confirmador",
  "tmk",
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
      return "bg-slate-100 text-slate-700";
    case "pendiente_contacto":
      return "bg-blue-100 text-blue-700";
    case "contactado":
      return "bg-indigo-100 text-indigo-700";
    case "agendado":
      return "bg-emerald-100 text-emerald-700";
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
    nuevo: "Nuevo",
    pendiente_contacto: "Pendiente de contacto",
    contactado: "Contactado",
    agendado: "Agendado",
    asistio: "Asistió",
    no_asistio: "No asistió",
    vendido: "Vendido",
    cerrado: "Cerrado",
    descartado: "Descartado",
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

export default function CallCenterPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callCenterUsers, setCallCenterUsers] = useState<CallCenterUser[]>([]);
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

  async function cargarLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, full_name, phone, city, interest_service, capture_location, status, observations, created_at, assigned_to_user_id"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando leads:", error);
      throw new Error("No se pudieron cargar los leads.");
    }

    return (data as Lead[]) || [];
  }

  async function cargarUsuariosCallCenter() {
    const { data, error } = await supabase
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
      `);

    if (error) {
      console.error("Error cargando usuarios call center:", error);
      throw new Error("No se pudieron cargar los usuarios de Call Center.");
    }

    const rows = (data || []) as any[];

    const filtered: CallCenterUser[] = rows
      .map((row) => {
        const role = row.user_roles?.[0]?.roles?.[0];
        return {
          id: row.id,
          full_name: row.full_name || "Sin nombre",
          role_name: role?.name || "",
          role_code: role?.code || "",
        };
      })
      .filter((user) =>
        ["supervisor_call_center", "confirmador", "tmk"].includes(user.role_code)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return filtered;
  }

  async function cargarTodo() {
    try {
      setCargando(true);
      setMensaje("");
      setError("");

      const [leadsData, usersData] = await Promise.all([
        cargarLeads(),
        cargarUsuariosCallCenter(),
      ]);

      setLeads(leadsData);
      setCallCenterUsers(usersData);

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

  const leadsFiltrados = useMemo(() => {
    let base = leads;
    const q = busqueda.trim().toLowerCase();

    if (currentRoleCode === "confirmador" || currentRoleCode === "tmk") {
      base = base.filter((lead) => lead.assigned_to_user_id === currentUserId);
    }

    if (!q) {
      base = base.filter((lead) => soloFecha(lead.created_at) === fechaFiltro);
    }

    return base.filter((lead) => {
      if (!q) return true;

      const nombre =
        lead.full_name?.toLowerCase() ||
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim().toLowerCase();

      return (
        (lead.phone || "").toLowerCase().includes(q) ||
        nombre.includes(q)
      );
    });
  }, [leads, fechaFiltro, busqueda, currentRoleCode, currentUserId]);

  const resumen = useMemo(() => {
    let base = leads;

    if (currentRoleCode === "confirmador" || currentRoleCode === "tmk") {
      base = base.filter((lead) => lead.assigned_to_user_id === currentUserId);
    }

    const delDia = base.filter((lead) => soloFecha(lead.created_at) === fechaFiltro);

    return {
      total: delDia.length,
      pendientes: delDia.filter(
        (lead) => lead.status === "nuevo" || lead.status === "pendiente_contacto"
      ).length,
      contactados: delDia.filter((lead) => lead.status === "contactado").length,
      agendados: delDia.filter((lead) => lead.status === "agendado").length,
      cerrados: delDia.filter(
        (lead) => lead.status === "vendido" || lead.status === "cerrado"
      ).length,
    };
  }, [leads, fechaFiltro, currentRoleCode, currentUserId]);

  function obtenerNombreAsignado(userId: string | null) {
    if (!userId) return "Sin asignar";
    const user = callCenterUsers.find((u) => u.id === userId);
    return user ? `${user.full_name} · ${user.role_name}` : "Sin asignar";
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
                  ? "Puedes consultar, asignar y actualizar el estado de los leads."
                  : "Puedes consultar tus leads asignados y actualizar su estado."}
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/leads"
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white text-center"
            >
              Leads
            </a>

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

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Leads del día</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.total}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pendientes</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.pendientes}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Contactados</p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">{resumen.contactados}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Agendados</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{resumen.agendados}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cerrados/Vendidos</p>
            <p className="mt-2 text-3xl font-bold text-green-700">{resumen.cerrados}</p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Buscar por teléfono o nombre"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {cargando ? (
            <p className="mt-6 text-slate-600">Cargando leads...</p>
          ) : leadsFiltrados.length === 0 ? (
            <p className="mt-6 text-slate-600">No hay leads para el filtro actual.</p>
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
                              className={`rounded-full px-3 py-1 text-xs ${estadoBadge(
                                lead.status
                              )}`}
                            >
                              {traducirEstado(lead.status)}
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
                            Captación: {lead.capture_location || "No registrado"}
                          </p>

                          {lead.observations && (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-medium text-slate-800">Observaciones:</span>{" "}
                              {lead.observations}
                            </p>
                          )}

                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-medium">Asignado a:</span>{" "}
                            {obtenerNombreAsignado(lead.assigned_to_user_id)}
                          </p>
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
                            Agendar cita
                          </a>
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