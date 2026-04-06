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

type GerenciaTab = "pendientes" | "comerciales" | "en_gestion" | "finalizados";

const allowedRoles = ["super_user", "gerente"];

const activeCommercialStatuses = [
  "asignado_comercial",
  "en_atencion_comercial",
  "seguimiento_comercial",
];

function traducirEstado(status: string | null) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente de asignación",
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

function formatHour(dateString: string | null | undefined) {
  if (!dateString) return "Sin hora";

  try {
    return new Date(dateString).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function minutosEspera(dateString: string | null | undefined) {
  if (!dateString) return "-";

  const createdAt = new Date(dateString).getTime();
  if (Number.isNaN(createdAt)) return "-";

  const diffMinutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min`;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours} h ${minutes} min`;
}

function esVentaReal(item: CommercialCase) {
  return !!(
    item.purchased_service ||
    item.sale_result === "venta_realizada" ||
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

  const [activeTab, setActiveTab] = useState<GerenciaTab>("pendientes");
  const [search, setSearch] = useState("");
  const [selectedCommercialByCase, setSelectedCommercialByCase] = useState<Record<string, string>>({});
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
            full_name: row.full_name || "Sin nombre",
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
      if (item.assigned_commercial_user_id && activeCommercialStatuses.includes(item.status)) {
        map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
      }
    });

    return map;
  }, [cases]);

  const finishedTodayByCommercial = useMemo(() => {
    const today = new Date().toDateString();
    const map: Record<string, number> = {};

    cases.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (new Date(item.created_at).toDateString() !== today) return;

      map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
    });

    return map;
  }, [cases]);

  const salesTodayByCommercial = useMemo(() => {
    const today = new Date().toDateString();
    const map: Record<string, number> = {};

    cases.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (!esVentaReal(item)) return;
      if (new Date(item.created_at).toDateString() !== today) return;

      map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
    });

    return map;
  }, [cases]);

  const pendingCases = useMemo(
    () => cases.filter((item) => item.status === "pendiente_asignacion_comercial"),
    [cases]
  );

  const inProgressCases = useMemo(
    () => cases.filter((item) => activeCommercialStatuses.includes(item.status)),
    [cases]
  );

  const finalizadosCases = useMemo(
    () => cases.filter((item) => item.status === "finalizado"),
    [cases]
  );

  const resumen = useMemo(() => {
    return {
      pendientes: pendingCases.length,
      enAtencion: inProgressCases.length,
      finalizados: finalizadosCases.length,
      ventas: finalizadosCases.filter(esVentaReal).length,
      seguimientos: cases.filter((x) => x.status === "seguimiento_comercial").length,
      disponibles: commercialUsers.filter((user) => (activeCasesByCommercial[user.id] || 0) === 0).length,
    };
  }, [pendingCases, inProgressCases, finalizadosCases, cases, commercialUsers, activeCasesByCommercial]);

  const visibleCases = useMemo(() => {
    const source =
      activeTab === "pendientes"
        ? pendingCases
        : activeTab === "en_gestion"
          ? inProgressCases
          : activeTab === "finalizados"
            ? finalizadosCases
            : cases;

    const q = search.trim().toLowerCase();
    if (!q) return source;

    return source.filter((item) => {
      return (
        (item.customer_name || "").toLowerCase().includes(q) ||
        (item.phone || "").toLowerCase().includes(q) ||
        (item.city || "").toLowerCase().includes(q)
      );
    });
  }, [activeTab, pendingCases, inProgressCases, finalizadosCases, cases, search]);

  function nombreComercial(userId: string | null) {
    if (!userId) return "Sin asignar";
    const found = commercialUsers.find((x) => x.id === userId);
    return found ? found.full_name : userId === currentUserId ? "Gerente" : "Asignado";
  }

  function disponibilidadComercial(userId: string) {
    const activeCount = activeCasesByCommercial[userId] || 0;
    return activeCount === 0 ? "Disponible" : "Atendiendo";
  }

  function disponibilidadBadge(userId: string) {
    const activeCount = activeCasesByCommercial[userId] || 0;
    return activeCount === 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700";
  }

  async function asignarCaso(caseId: string, commercialId: string) {
    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    if (!commercialId) {
      setError("Debes seleccionar un comercial.");
      return;
    }

    setSavingCaseId(caseId);
    setError("");
    setMensaje("");

    const assignedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("commercial_cases")
      .update({
        assigned_commercial_user_id: commercialId,
        assigned_by_user_id: currentUserId,
        assigned_at: assignedAt,
        status: "asignado_comercial",
        updated_by_user_id: currentUserId,
      })
      .eq("id", caseId);

    if (updateError) {
      setError("No se pudo asignar el caso.");
      setSavingCaseId(null);
      return;
    }

    setCases((prev) =>
      prev.map((item) =>
        item.id === caseId
          ? {
              ...item,
              assigned_commercial_user_id: commercialId,
              assigned_by_user_id: currentUserId,
              assigned_at: assignedAt,
              status: "asignado_comercial",
            }
          : item
      )
    );

    setSelectedCommercialByCase((prev) => ({ ...prev, [caseId]: commercialId }));
    setMensaje(commercialId === currentUserId ? "Te asignaste este cliente correctamente." : "Cliente asignado correctamente.");
    setSavingCaseId(null);
  }

  async function atenderYo(caseId: string) {
    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    await asignarCaso(caseId, currentUserId);
  }

  function renderCaseList(title: string, description: string, items: CommercialCase[]) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            onClick={cargarDatos}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        <div className="mb-6">
          <input
            className="w-full rounded-2xl border border-slate-300 p-4 outline-none"
            placeholder="Buscar por nombre, teléfono o ciudad"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            Cargando información...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
            No hay registros para esta vista.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{item.customer_name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs ${estadoBadge(item.status)}`}>
                        {traducirEstado(item.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                      <p><span className="font-medium text-slate-700">Teléfono:</span> {item.phone || "Sin teléfono"}</p>
                      <p><span className="font-medium text-slate-700">Ciudad:</span> {item.city || "Sin ciudad"}</p>
                      <p><span className="font-medium text-slate-700">Ingreso:</span> {formatDate(item.created_at)}</p>
                      <p><span className="font-medium text-slate-700">Hora:</span> {formatHour(item.created_at)}</p>
                      <p><span className="font-medium text-slate-700">Comercial:</span> {nombreComercial(item.assigned_commercial_user_id)}</p>
                      <p><span className="font-medium text-slate-700">Espera:</span> {minutosEspera(item.created_at)}</p>
                    </div>

                    {item.status === "finalizado" ? (
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <p>
                          <span className="font-medium text-slate-700">Resultado:</span>{" "}
                          {esVentaReal(item) ? "Venta realizada" : "Sin venta"}
                        </p>
                        <p>
                          <span className="font-medium text-slate-700">Valor:</span>{" "}
                          {item.sale_value ? `$${item.sale_value.toLocaleString("es-CO")}` : "No registrado"}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full rounded-2xl bg-slate-50 p-4 lg:w-[360px]">
                    <p className="mb-3 text-sm font-medium text-slate-700">
                      {item.assigned_commercial_user_id ? "Reasignar o editar" : "Asignar atención"}
                    </p>

                    <div className="space-y-3">
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

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const commercialId = selectedCommercialByCase[item.id] || "";
                            void asignarCaso(item.id, commercialId);
                          }}
                          disabled={savingCaseId === item.id}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                        >
                          {savingCaseId === item.id ? "Guardando..." : item.assigned_commercial_user_id ? "Reasignar" : "Asignar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void atenderYo(item.id)}
                          disabled={savingCaseId === item.id}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
                        >
                          Atender yo
                        </button>

                        <a
                          href={`/comercial?caseId=${item.id}`}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                        >
                          Editar gestión
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
          <p className="text-sm font-medium text-red-700">{error || "No tienes permiso para entrar a este módulo."}</p>
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
              <p className="text-sm font-medium text-slate-500">Gerencia comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Centro de control comercial</h1>
              <p className="mt-3 text-sm text-slate-600">
                Asigna clientes, revisa disponibilidad del equipo y entra a la gestión solo cuando lo necesites.
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
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{mensaje}</div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Pendientes" value={String(resumen.pendientes)} />
          <StatCard title="En atención" value={String(resumen.enAtencion)} />
          <StatCard title="Finalizados" value={String(resumen.finalizados)} />
          <StatCard title="Ventas" value={String(resumen.ventas)} />
          <StatCard title="Seguimientos" value={String(resumen.seguimientos)} />
          <StatCard title="Disponibles" value={String(resumen.disponibles)} />
        </section>

        <section className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("pendientes")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeTab === "pendientes"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("comerciales")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeTab === "comerciales"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Comerciales
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("en_gestion")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeTab === "en_gestion"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              En gestión
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("finalizados")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeTab === "finalizados"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700"
              }`}
            >
              Finalizados
            </button>
          </div>
        </section>

        {activeTab === "pendientes" &&
          renderCaseList(
            "Clientes pendientes",
            "Aquí ves quién llegó al área comercial y todavía no tiene atención asignada.",
            visibleCases
          )}

        {activeTab === "en_gestion" &&
          renderCaseList(
            "Clientes en gestión",
            "Casos ya asignados o en atención. El gerente puede corregir, reasignar o atender directamente.",
            visibleCases
          )}

        {activeTab === "finalizados" &&
          renderCaseList(
            "Gestiones finalizadas",
            "Resumen de clientes cerrados hoy, con o sin venta, para control operativo.",
            visibleCases
          )}

        {activeTab === "comerciales" && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Comerciales del día</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revisa en tiempo real quién está disponible y cuántos clientes ha movido hoy.
                </p>
              </div>

              <button
                onClick={cargarDatos}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando comerciales...
              </div>
            ) : commercialUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay usuarios con rol comercial.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {commercialUsers.map((user) => {
                  const activeCount = activeCasesByCommercial[user.id] || 0;
                  const finishedCount = finishedTodayByCommercial[user.id] || 0;
                  const salesCount = salesTodayByCommercial[user.id] || 0;

                  return (
                    <div key={user.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{user.role_name || "Comercial"}</p>
                        </div>

                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${disponibilidadBadge(user.id)}`}>
                          {disponibilidadComercial(user.id)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                        <MiniStat label="Activos" value={String(activeCount)} />
                        <MiniStat label="Finalizados" value={String(finishedCount)} />
                        <MiniStat label="Ventas" value={String(salesCount)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
