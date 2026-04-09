"use client";

import Image from "next/image";
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

const allowedRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

const gerenciaRoleCodes = [
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
];

const visibleTeamRoleCodes = [
  "comercial",
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
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [currentRoleName, setCurrentRoleName] = useState<string | null>(null);

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
      setCurrentRoleCode(auth.roleCode);
      setCurrentRoleName(auth.roleName || "Gerencia comercial");
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

      const users = profileRows
        .map((row) => {
          const rawRoles = Array.isArray(row.user_roles) ? row.user_roles : [];
          const role = rawRoles[0]?.roles;
          return {
            id: row.id,
            full_name: row.full_name || "Sin nombre",
            role_name: role?.name || "",
            role_code: role?.code || "",
          } as CommercialUser;
        })
        .filter((user) => visibleTeamRoleCodes.includes(user.role_code));

      const dedupedMap = new Map<string, CommercialUser>();
      users.forEach((user) => {
        dedupedMap.set(user.id, user);
      });

      if (
        currentUserId &&
        currentRoleCode &&
        gerenciaRoleCodes.includes(currentRoleCode) &&
        !dedupedMap.has(currentUserId)
      ) {
        dedupedMap.set(currentUserId, {
          id: currentUserId,
          full_name: "Gerencia comercial",
          role_name: currentRoleName || "Gerencia comercial",
          role_code: currentRoleCode,
        });
      }

      const teamUsers = Array.from(dedupedMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      const selected: Record<string, string> = {};
      casesData.forEach((item) => {
        selected[item.id] = item.assigned_commercial_user_id || "";
      });

      setCases(casesData);
      setCommercialUsers(teamUsers);
      setSelectedCommercialByCase(selected);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los casos comerciales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      void cargarDatos();
    }
  }, [authorized, currentUserId, currentRoleCode, currentRoleName]);

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
    if (found) return found.full_name;
    if (userId === currentUserId) return currentRoleName || "Gerencia comercial";
    return "Asignado";
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
      setError("Debes seleccionar un usuario para atender.");
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
      setMensaje(commercialId === currentUserId ? "Te asignaste este cliente correctamente." : "Cliente asignado correctamente.");
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
    setActiveTab("en_gestion");
  }

  function renderCaseList(title: string, description: string, items: CommercialCase[]) {
    return (
      <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            onClick={() => void cargarDatos()}
            className="rounded-xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
          >
            Actualizar
          </button>
        </div>

        <div className="mb-6">
          <input
            className="w-full rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
            placeholder="Buscar por nombre, teléfono o ciudad"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
            Cargando información...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
            No hay registros para esta vista.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="group rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{item.customer_name}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${estadoBadge(item.status)}`}>
                        {traducirEstado(item.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                      <InfoItem label="Teléfono" value={item.phone || "Sin teléfono"} />
                      <InfoItem label="Ciudad" value={item.city || "Sin ciudad"} />
                      <InfoItem label="Ingreso" value={formatDate(item.created_at)} />
                      <InfoItem label="Hora" value={formatHour(item.created_at)} />
                      <InfoItem label="Comercial" value={nombreComercial(item.assigned_commercial_user_id)} />
                      <InfoItem label="Espera" value={minutosEspera(item.created_at)} />
                    </div>

                    {item.status === "finalizado" ? (
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <InfoItem label="Resultado" value={esVentaReal(item) ? "Venta realizada" : "Sin venta"} />
                        <InfoItem
                          label="Valor"
                          value={
                            item.sale_value && Number(item.sale_value) > 0
                              ? `$${Number(item.sale_value).toLocaleString("es-CO")}`
                              : "No registrado"
                          }
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full rounded-2xl border border-[#E3ECE5] bg-[#F8F7F4] p-4 lg:w-[380px]">
                    <p className="mb-3 text-sm font-medium text-slate-700">
                      {item.assigned_commercial_user_id ? "Reasignar o editar" : "Asignar atención"}
                    </p>

                    <div className="space-y-3">
                      <select
                        className="w-full rounded-2xl border border-[#D6E8DA] bg-white p-4 outline-none transition focus:border-[#7FA287]"
                        value={selectedCommercialByCase[item.id] || ""}
                        onChange={(e) =>
                          setSelectedCommercialByCase((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Selecciona quién atenderá</option>
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
                          className="rounded-2xl bg-[#5F7D66] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#4F6F5B] disabled:opacity-60"
                        >
                          {savingCaseId === item.id ? "Guardando..." : item.assigned_commercial_user_id ? "Reasignar" : "Asignar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void atenderYo(item.id)}
                          disabled={savingCaseId === item.id}
                          className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                        >
                          Atender yo
                        </button>

                        <a
                          href={`/comercial?caseId=${item.id}`}
                          className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                        >
                          Editar gestión
                        </a>
                      </div>

                      <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-white p-3 text-xs text-slate-500">
                        Si el gerente toma un caso, aparecerá como atendiendo en la pestaña de equipo y el cliente quedará en En gestión.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
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
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">{error || "No tienes permiso para entrar a este módulo."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
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
              <p className="text-sm font-medium text-[#7FA287]">Gerencia comercial</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Centro de control comercial</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Asigna clientes, revisa disponibilidad del equipo y entra a la gestión solo cuando lo necesites.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]">
              Inicio
            </a>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{mensaje}</div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Pendientes" value={String(resumen.pendientes)} />
          <StatCard title="En atención" value={String(resumen.enAtencion)} />
          <StatCard title="Finalizados" value={String(resumen.finalizados)} />
          <StatCard title="Ventas" value={String(resumen.ventas)} />
          <StatCard title="Seguimientos" value={String(resumen.seguimientos)} />
          <StatCard title="Disponibles" value={String(resumen.disponibles)} />
        </section>

        <section className="mb-6 rounded-3xl border border-[#D6E8DA] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <TabButton active={activeTab === "pendientes"} onClick={() => setActiveTab("pendientes")}>
              Pendientes
            </TabButton>
            <TabButton active={activeTab === "comerciales"} onClick={() => setActiveTab("comerciales")}>
              Comerciales
            </TabButton>
            <TabButton active={activeTab === "en_gestion"} onClick={() => setActiveTab("en_gestion")}>
              En gestión
            </TabButton>
            <TabButton active={activeTab === "finalizados"} onClick={() => setActiveTab("finalizados")}>
              Finalizados
            </TabButton>
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
            "Aquí ves los clientes asignados o siendo atendidos. Si un caso ya fue tomado, aquí debe aparecer.",
            visibleCases
          )}

        {activeTab === "finalizados" &&
          renderCaseList(
            "Gestiones finalizadas",
            "Resumen de clientes cerrados hoy, con o sin venta, para control operativo.",
            visibleCases
          )}

        {activeTab === "comerciales" && (
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Equipo comercial del día</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Aquí aparece tanto el equipo comercial como gerencia comercial cuando toma casos directamente.
                </p>
              </div>

              <button
                onClick={() => void cargarDatos()}
                className="rounded-xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                Cargando equipo...
              </div>
            ) : commercialUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                No hay usuarios comerciales visibles.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {commercialUsers.map((user) => {
                  const activeCount = activeCasesByCommercial[user.id] || 0;
                  const finishedCount = finishedTodayByCommercial[user.id] || 0;
                  const salesCount = salesTodayByCommercial[user.id] || 0;

                  return (
                    <div key={user.id} className="rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#5F7D66] text-white shadow-sm"
          : "border border-[#D6E8DA] bg-white text-[#4F6F5B] hover:bg-[#F4FAF6]"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#BCD7C2] hover:shadow-md">
      <div className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E3ECE5] bg-[#F8F7F4] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#24312A]">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-[#24312A]">{label}:</span> {value}
    </p>
  );
}
