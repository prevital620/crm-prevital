"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

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
  "contactado",
  "agendado",
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

export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(hoyISO());

  const showCreatorColumn =
    roleCode === "super_user" ||
    roleCode === "supervisor_opc" ||
    roleCode === "supervisor_call_center";

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

      const { data, error } = await supabase
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
        .order("created_at", { ascending: false });

      if (error) throw error;

      const leadsData = (data as LeadRow[]) || [];
      setLeads(leadsData);

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

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      cargarLeads();
    }
  }, [authorized]);

  const leadsPorRol = useMemo(() => {
    if (!roleCode || !currentUserId) return [];

    if (roleCode === "super_user") return leads;
    if (roleCode === "supervisor_call_center") return leads;

    if (roleCode === "supervisor_opc") {
      return leads.filter((lead) => opcVisibleStatuses.includes(lead.status));
    }

    if (roleCode === "promotor_opc") {
      return leads.filter(
        (lead) =>
          lead.created_by_user_id === currentUserId &&
          opcVisibleStatuses.includes(lead.status)
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
  }, [leads, roleCode, currentUserId]);

  const leadsFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    return leadsPorRol.filter((lead) => {
      const fechaOk = dateFilter ? soloFecha(lead.created_at) === dateFilter : true;

      const nombreCompleto =
        lead.full_name?.toLowerCase() ||
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim().toLowerCase();

      const telefono = (lead.phone || "").toLowerCase();

      const creador =
        (creatorNames[lead.created_by_user_id] || "").toLowerCase();

      const busquedaOk = q
        ? nombreCompleto.includes(q) ||
          telefono.includes(q) ||
          creador.includes(q)
        : true;

      return fechaOk && busquedaOk;
    });
  }, [leadsPorRol, search, dateFilter, creatorNames]);

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
      pendiente_contacto: "Pendiente de contacto",
      contactado: "Contactado",
      agendado: "Agendado",
      asistio: "Asistió",
      no_asistio: "No asistió",
      vendido: "Vendido",
      cerrado: "Cerrado",
      descartado: "Descartado",
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
    if (!source) return "Sin origen";

    const map: Record<string, string> = {
      opc: "OPC",
      redes_sociales: "Redes sociales",
      referido: "Referido",
      punto_fisico: "Punto físico",
      otro: "Otro",
    };

    return map[source] || source;
  }

  function getCreatorName(userId: string) {
    return creatorNames[userId] || "Sin nombre";
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
              <p className="text-sm font-medium text-slate-500">Leads</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Gestión de leads
              </h1>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700"
            >
              Inicio
            </a>

            {(roleCode === "super_user" ||
              roleCode === "promotor_opc" ||
              roleCode === "supervisor_opc" ||
              roleCode === "confirmador" ||
              roleCode === "tmk") && (
              <a
                href="/leads/nuevo"
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium !text-white"
              >
                Nuevo lead
              </a>
            )}
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Leads visibles para tu rol
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Busca por nombre, teléfono o nombre del OPC y filtra por fecha.
              </p>
            </div>

            <button
              onClick={cargarLeads}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>

          <div className="mb-6 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
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
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Cargando leads...
            </div>
          ) : leadsFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No hay leads visibles con esos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500">
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
                  {leadsFiltrados.map((lead) => (
                    <tr key={lead.id} className="rounded-2xl bg-slate-50">
                      <td className="rounded-l-2xl px-4 py-4 font-semibold text-slate-900">
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

                      <td className="px-4 py-4 text-sm text-slate-700">
                        {translateStatus(lead.status)}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatDate(lead.created_at)}
                      </td>

                      <td
                        className={`px-4 py-4 ${
                          showCreatorColumn ? "rounded-r-2xl" : "rounded-r-2xl"
                        }`}
                      >
                        <a
                          href={`/leads/${lead.id}`}
                          className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium !text-white"
                        >
                          Ver / editar
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}