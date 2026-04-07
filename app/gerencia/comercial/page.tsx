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
type StatusFilter =
  | "todos"
  | "pendiente_asignacion_comercial"
  | "asignado_comercial"
  | "en_atencion_comercial"
  | "seguimiento_comercial"
  | "finalizado";
type SaleFilter = "todas" | "con_venta" | "sin_venta";
type DateFilter = "hoy" | "todos";

const allowedRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

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
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "asignado_comercial":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "en_atencion_comercial":
      return "bg-cyan-100 text-cyan-800 border border-cyan-200";
    case "seguimiento_comercial":
      return "bg-violet-100 text-violet-800 border border-violet-200";
    case "finalizado":
      return "bg-slate-200 text-slate-800 border border-slate-300";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
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
  return Boolean(
    item.purchased_service ||
      item.sale_result === "venta_realizada" ||
      (item.sale_value && Number(item.sale_value) > 0)
  );
}

function esHoy(dateString: string | null | undefined) {
  if (!dateString) return false;

  try {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  } catch {
    return false;
  }
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [commercialFilter, setCommercialFilter] = useState<string>("todos");
  const [saleFilter, setSaleFilter] = useState<SaleFilter>("todas");
  const [dateFilter, setDateFilter] = useState<DateFilter>("hoy");

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
      void cargarDatos();
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
    const map: Record<string, number> = {};

    cases.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (!esHoy(item.created_at)) return;

      map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
    });

    return map;
  }, [cases]);

  const salesTodayByCommercial = useMemo(() => {
    const map: Record<string, number> = {};

    cases.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (!esVentaReal(item)) return;
      if (!esHoy(item.created_at)) return;

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
    const base = dateFilter === "hoy" ? cases.filter((item) => esHoy(item.created_at)) : cases;
    const basePendientes = base.filter((item) => item.status === "pendiente_asignacion_comercial");
    const baseActivos = base.filter((item) => activeCommercialStatuses.includes(item.status));
    const baseFinalizados = base.filter((item) => item.status === "finalizado");

    return {
      pendientes: basePendientes.length,
      enAtencion: baseActivos.length,
      finalizados: baseFinalizados.length,
      ventas: baseFinalizados.filter(esVentaReal).length,
      seguimientos: base.filter((item) => item.status === "seguimiento_comercial").length,
      disponibles: commercialUsers.filter((user) => (activeCasesByCommercial[user.id] || 0) === 0).length,
    };
  }, [cases, commercialUsers, activeCasesByCommercial, dateFilter]);

  const currentSource = useMemo(() => {
    if (activeTab === "pendientes") return pendingCases;
    if (activeTab === "en_gestion") return inProgressCases;
    if (activeTab === "finalizados") return finalizadosCases;
    return cases;
  }, [activeTab, pendingCases, inProgressCases, finalizadosCases, cases]);

  const visibleCases = useMemo(() => {
    let filtered = [...currentSource];

    if (dateFilter === "hoy") {
      filtered = filtered.filter((item) => esHoy(item.created_at));
    }

    if (statusFilter !== "todos") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    if (commercialFilter !== "todos") {
      if (commercialFilter === "sin_asignar") {
        filtered = filtered.filter((item) => !item.assigned_commercial_user_id);
      } else {
        filtered = filtered.filter((item) => item.assigned_commercial_user_id === commercialFilter);
      }
    }

    if (saleFilter === "con_venta") {
      filtered = filtered.filter((item) => esVentaReal(item));
    }

    if (saleFilter === "sin_venta") {
      filtered = filtered.filter((item) => !esVentaReal(item));
    }

    const q = search.trim().toLowerCase();
    if (!q) return filtered;

    return filtered.filter((item) => {
      return (
        (item.customer_name || "").toLowerCase().includes(q) ||
        (item.phone || "").toLowerCase().includes(q) ||
        (item.city || "").toLowerCase().includes(q)
      );
    });
  }, [currentSource, dateFilter, statusFilter, commercialFilter, saleFilter, search]);

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
    return activeCount === 0
      ? "bg-green-100 text-green-700 border border-green-200"
      : "bg-amber-100 text-amber-700 border border-amber-200";
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

    try {
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

      if (updateError) throw updateError;

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

      setMensaje(
        commercialId === currentUserId
          ? "Te asignaste este cliente correctamente."
          : "Cliente asignado correctamente."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo asignar el caso.");
    } finally {
      setSavingCaseId(null);
    }
  }

  async function atenderYo(caseId: string) {
    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    await asignarCaso(caseId, currentUserId);
  }

  function limpiarFiltros() {
    setSearch("");
    setStatusFilter("todos");
    setCommercialFilter("todos");
    setSaleFilter("todas");
    setDateFilter("hoy");
  }

  function renderCaseList(title: string, description: string, items: CommercialCase[]) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            onClick={() => void cargarDatos()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Actualizar
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
              placeholder="Buscar por nombre, teléfono o ciudad"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente_asignacion_comercial">Pendiente de asignación</option>
              <option value="asignado_comercial">Asignado</option>
              <option value="en_atencion_comercial">En atención</option>
              <option value="seguimiento_comercial">Seguimiento</option>
              <option value="finalizado">Finalizado</option>
            </select>

            <select
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
              value={commercialFilter}
              onChange={(e) => setCommercialFilter(e.target.value)}
            >
              <option value="todos">Todos los comerciales</option>
              <option value="sin_asignar">Sin asignar</option>
              {commercialUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
              value={saleFilter}
              onChange={(e) => setSaleFilter(e.target.value as SaleFilter)}
            >
              <option value="todas">Todas las ventas</option>
              <option value="con_venta">Con venta</option>
              <option value="sin_venta">Sin venta</option>
            </select>

            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              >
                <option value="hoy">Solo hoy</option>
                <option value="todos">Todos</option>
              </select>

              <button
                type="button"
                onClick={limpiarFiltros}
                className="rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          </div>
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
            {items.map((item) => {
              const tieneVenta = esVentaReal(item);

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                >
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold text-slate-900">
                            {item.customer_name}
                          </h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge(item.status)}`}>
                            {traducirEstado(item.status)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              tieneVenta
                                ? "border border-emerald-200 bg-emerald-100 text-emerald-800"
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {tieneVenta ? "Con venta" : "Sin venta"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          Ingreso: {formatDate(item.created_at)} · Espera: {minutosEspera(item.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/comercial?caseId=${item.id}`}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Abrir gestión
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 xl:grid-cols-[1.4fr_0.9fr]">
                    <div className="grid gap-4">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-800">Datos del cliente</p>

                        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                          <InfoItem label="Teléfono" value={item.phone || "Sin teléfono"} />
                          <InfoItem label="Ciudad" value={item.city || "Sin ciudad"} />
                          <InfoItem label="Hora" value={formatHour(item.created_at)} />
                          <InfoItem label="Comercial" value={nombreComercial(item.assigned_commercial_user_id)} />
                          <InfoItem label="Asignado desde" value={item.assigned_at ? formatDate(item.assigned_at) : "Aún no"} />
                          <InfoItem label="Servicio vendido" value={item.purchased_service || "No registrado"} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-800">Resumen operativo</p>

                        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                          <InfoItem label="Resultado comercial" value={tieneVenta ? "Venta realizada" : "Aún sin venta"} />
                          <InfoItem
                            label="Valor"
                            value={
                              item.sale_value && Number(item.sale_value) > 0
                                ? `$${Number(item.sale_value).toLocaleString("es-CO")}`
                                : "No registrado"
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-800">
                        {item.assigned_commercial_user_id ? "Reasignar o tomar control" : "Asignar atención"}
                      </p>

                      <div className="space-y-3">
                        <select
                          className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none"
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

                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => {
                              const commercialId = selectedCommercialByCase[item.id] || "";
                              void asignarCaso(item.id, commercialId);
                            }}
                            disabled={savingCaseId === item.id}
                            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {savingCaseId === item.id
                              ? "Guardando..."
                              : item.assigned_commercial_user_id
                                ? "Reasignar"
                                : "Asignar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void atenderYo(item.id)}
                            disabled={savingCaseId === item.id}
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
                          >
                            Atender yo
                          </button>
                        </div>

                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                          El gerente puede asignar, reasignar o entrar a la gestión del caso sin perder el control operativo.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
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
              <p className="text-sm font-medium text-slate-500">Gerencia comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Centro de control comercial</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">
                Aquí el gerente ve qué clientes llegaron desde Recepción, quién está disponible,
                qué casos siguen activos y cuáles ya cerraron.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Inicio
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Actualizar datos
            </button>
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

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            title="Pendientes"
            value={String(resumen.pendientes)}
            active={activeTab === "pendientes"}
            onClick={() => setActiveTab("pendientes")}
          />
          <StatCard
            title="En atención"
            value={String(resumen.enAtencion)}
            active={activeTab === "en_gestion"}
            onClick={() => setActiveTab("en_gestion")}
          />
          <StatCard
            title="Finalizados"
            value={String(resumen.finalizados)}
            active={activeTab === "finalizados"}
            onClick={() => setActiveTab("finalizados")}
          />
          <StatCard title="Ventas" value={String(resumen.ventas)} />
          <StatCard title="Seguimientos" value={String(resumen.seguimientos)} />
          <StatCard
            title="Disponibles"
            value={String(resumen.disponibles)}
            active={activeTab === "comerciales"}
            onClick={() => setActiveTab("comerciales")}
          />
        </section>

        <section className="mb-6 rounded-3xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("pendientes")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                activeTab === "pendientes"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
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
            "Casos ya asignados o en atención. El gerente puede corregir, reasignar o entrar a la gestión cuando haga falta.",
            visibleCases
          )}

        {activeTab === "finalizados" &&
          renderCaseList(
            "Gestiones finalizadas",
            "Resumen operativo de clientes cerrados, con o sin venta.",
            visibleCases
          )}

        {activeTab === "comerciales" && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Comerciales del día</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Revisa en tiempo real quién está disponible y cuántos movimientos lleva cada uno.
                </p>
              </div>

              <button
                onClick={() => void cargarDatos()}
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
                    <div key={user.id} className="rounded-3xl border border-slate-200 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{user.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {user.role_name || "Comercial"}
                          </p>
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

function StatCard({
  title,
  value,
  active = false,
  onClick,
}: {
  title: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const clickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`rounded-3xl bg-white p-5 text-left shadow-sm transition ${
        clickable ? "hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${active ? "ring-2 ring-slate-900" : ""} ${!clickable ? "cursor-default" : ""}`}
    >
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </button>
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-slate-700">{label}:</span> {value}
    </p>
  );
}
