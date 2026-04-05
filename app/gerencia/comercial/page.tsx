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
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  created_at: string;
};

type CommercialUser = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
};

const allowedRoles = ["super_user", "gerente"];

const activeCommercialStatuses = [
  "asignado_comercial",
  "en_atencion_comercial",
  "seguimiento_comercial",
];

const caseStatusOptions = [
  { value: "pendiente_asignacion_comercial", label: "Pendiente asignación" },
  { value: "asignado_comercial", label: "Asignado" },
  { value: "en_atencion_comercial", label: "En atención" },
  { value: "seguimiento_comercial", label: "Seguimiento" },
  { value: "finalizado", label: "Finalizado" },
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

function esVentaReal(item: CommercialCase) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0)
  );
}

export default function GerenciaComercialPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<CommercialUser[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedCommercialByCase, setSelectedCommercialByCase] = useState<
    Record<string, string>
  >({});
  const [savingCaseId, setSavingCaseId] = useState<string | null>(null);

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
            sale_result,
            purchased_service,
            sale_value,
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

      const casesData = (casesResult.data as CommercialCase[]) || [];
      const profileRows = (profilesResult.data as any[]) || [];

      const commercials: CommercialUser[] = profileRows
        .map((row) => {
          const role = row.user_roles?.[0]?.roles;
          return {
            id: row.id,
            full_name: row.full_name,
            role_name: role?.name || "",
            role_code: role?.code || "",
          };
        })
        .filter((user) => user.role_code === "comercial")
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      const selected: Record<string, string> = {};
      casesData.forEach((item) => {
        selected[item.id] = item.assigned_commercial_user_id || "";
      });

      setCases(casesData);
      setCommercialUsers(commercials);
      setSelectedCommercialByCase(selected);
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
      cargarDatos();
    }
  }, [authorized]);

  const activeCasesByCommercial = useMemo(() => {
    const map: Record<string, number> = {};

    cases.forEach((item) => {
      if (
        item.assigned_commercial_user_id &&
        activeCommercialStatuses.includes(item.status)
      ) {
        map[item.assigned_commercial_user_id] =
          (map[item.assigned_commercial_user_id] || 0) + 1;
      }
    });

    return map;
  }, [cases]);

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
      pendientes: cases.filter(
        (x) => x.status === "pendiente_asignacion_comercial"
      ).length,
      activos: cases.filter((x) =>
        activeCommercialStatuses.includes(x.status)
      ).length,
      vendidos: cases.filter(
        (x) => x.status === "finalizado" && esVentaReal(x)
      ).length,
      noVendidos: cases.filter(
        (x) => x.status === "finalizado" && !esVentaReal(x)
      ).length,
    };
  }, [cases]);

  function nombreComercial(userId: string | null) {
    if (!userId) return "Sin asignar";
    const found = commercialUsers.find((x) => x.id === userId);
    return found ? found.full_name : "Sin asignar";
  }

  function disponibilidadComercial(userId: string) {
    const activeCount = activeCasesByCommercial[userId] || 0;
    return activeCount === 0 ? "Disponible" : `Ocupado (${activeCount})`;
  }

  function disponibilidadBadge(userId: string) {
    const activeCount = activeCasesByCommercial[userId] || 0;
    return activeCount === 0
      ? "bg-green-100 text-green-700"
      : "bg-amber-100 text-amber-700";
  }

  async function asignarComercial(caseId: string) {
    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    const commercialId = selectedCommercialByCase[caseId] || null;

    if (!commercialId) {
      setError("Debes seleccionar un comercial.");
      return;
    }

    setSavingCaseId(caseId);
    setError("");
    setMensaje("");

    const { error } = await supabase
      .from("commercial_cases")
      .update({
        assigned_commercial_user_id: commercialId,
        assigned_by_user_id: currentUserId,
        assigned_at: new Date().toISOString(),
        status: "asignado_comercial",
        updated_by_user_id: currentUserId,
      })
      .eq("id", caseId);

    if (error) {
      setError("No se pudo asignar el comercial.");
      setSavingCaseId(null);
      return;
    }

    setMensaje("Comercial asignado correctamente.");

    setCases((prev) =>
      prev.map((item) =>
        item.id === caseId
          ? {
              ...item,
              assigned_commercial_user_id: commercialId,
              assigned_by_user_id: currentUserId,
              assigned_at: new Date().toISOString(),
              status: "asignado_comercial",
            }
          : item
      )
    );

    setSavingCaseId(null);
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
              <p className="text-sm font-medium text-slate-500">Gerencia</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Asignación comercial
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Asigna comerciales, revisa disponibilidad y controla los casos activos.
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
          <StatCard title="Pendientes" value={String(resumen.pendientes)} />
          <StatCard title="Activos" value={String(resumen.activos)} />
          <StatCard title="Vendidos" value={String(resumen.vendidos)} />
          <StatCard title="No vendidos" value={String(resumen.noVendidos)} />
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Casos comerciales
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Busca por cliente o teléfono y filtra por estado.
                </p>
              </div>

              <button
                onClick={cargarDatos}
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
                Cargando casos comerciales...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay casos con esos filtros.
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
                            Comercial: {nombreComercial(item.assigned_commercial_user_id)}
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
                              Valor: ${item.sale_value.toLocaleString("es-CO")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="mb-3 text-sm font-medium text-slate-700">
                          Asignar o reasignar comercial
                        </p>

                        <div className="flex flex-col gap-3 md:flex-row">
                          <select
                            className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none"
                            value={selectedCommercialByCase[item.id] || ""}
                            onChange={(e) =>
                              setSelectedCommercialByCase((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Selecciona un comercial</option>
                            {commercialUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name} · {disponibilidadComercial(user.id)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => asignarComercial(item.id)}
                            disabled={savingCaseId === item.id}
                            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {savingCaseId === item.id
                              ? "Guardando..."
                              : "Asignar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Comerciales</h2>
            <p className="mt-1 text-sm text-slate-500">
              Disponibilidad calculada según casos activos.
            </p>

            <div className="mt-5 space-y-3">
              {commercialUsers.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay usuarios con rol comercial.
                </p>
              ) : (
                commercialUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {user.full_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.role_name}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${disponibilidadBadge(
                          user.id
                        )}`}
                      >
                        {disponibilidadComercial(user.id)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
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