"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import {
  CommercialTeamKey,
  getCommercialTeamLabel,
  inferCommercialTeam,
  inferCommercialTeamFromDate,
} from "@/lib/commercial/team";
import { hoyISO, dateToLocalISO } from "@/lib/datetime/dateHelpers";

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
  closed_at: string | null;
  created_at: string;
};

type CommercialUser = {
  id: string;
  full_name: string;
  role_name: string;
  role_code: string;
  job_title: string | null;
  departments: { name: string | null }[] | null;
  team_key: CommercialTeamKey | null;
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

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

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

function formatMoney(value: number | null | undefined) {
  return `$${Number(value || 0).toLocaleString("es-CO")}`;
}

function getCaseReferenceDate(item: CommercialCase) {
  return item.closed_at || item.assigned_at || item.created_at;
}

function inferCaseTeamKey(
  item: Pick<CommercialCase, "assigned_commercial_user_id" | "assigned_by_user_id" | "assigned_at" | "created_at">,
  profileMap: Map<string, CommercialUser>
) {
  const assignedTeam = item.assigned_commercial_user_id
    ? profileMap.get(item.assigned_commercial_user_id)?.team_key || null
    : null;

  if (assignedTeam) return assignedTeam;

  const managerTeam = item.assigned_by_user_id
    ? profileMap.get(item.assigned_by_user_id)?.team_key || null
    : null;

  if (managerTeam) return managerTeam;

  return inferCommercialTeamFromDate(item.assigned_at || item.created_at);
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
  const [currentTeamKey, setCurrentTeamKey] = useState<CommercialTeamKey | null>(null);

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<CommercialUser[]>([]);

  const [activeTab, setActiveTab] = useState<GerenciaTab>("pendientes");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(hoyISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [commercialFilter, setCommercialFilter] = useState("");
  const [saleValueMin, setSaleValueMin] = useState("");
  const [saleValueMax, setSaleValueMax] = useState("");
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
            closed_at,
            created_at
          `)
          .order("created_at", { ascending: false }),

        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            job_title,
            departments (
              name
            ),
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
            job_title: row.job_title || null,
            departments: Array.isArray(row.departments) ? row.departments : [],
            team_key: inferCommercialTeam({
              job_title: row.job_title || null,
              departments: Array.isArray(row.departments) ? row.departments : [],
            }),
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
          job_title: null,
          departments: [],
          team_key: null,
        });
      }

      const teamUsers = Array.from(dedupedMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      );

      const detectedTeam =
        currentRoleCode === "super_user"
          ? null
          : dedupedMap.get(currentUserId || "")?.team_key || null;
      setCurrentTeamKey(detectedTeam);

      const visibleUsers =
        currentRoleCode === "super_user"
          ? teamUsers
          : teamUsers.filter((user) => {
              if (user.id === currentUserId) return true;
              if (detectedTeam) return user.team_key === detectedTeam;
              return user.role_code === "comercial";
            });

      const visibleUserIds = new Set(visibleUsers.map((user) => user.id));
      const visibleCaseRows =
        currentRoleCode === "super_user"
          ? casesData
          : casesData.filter((item) => {
              const caseTeam = inferCaseTeamKey(item, dedupedMap);

              if (detectedTeam) {
                return caseTeam === detectedTeam;
              }

              return (
                item.assigned_by_user_id === currentUserId ||
                item.assigned_commercial_user_id === currentUserId
              );
            });

      const selected: Record<string, string> = {};
      visibleCaseRows.forEach((item) => {
        selected[item.id] = item.assigned_commercial_user_id || "";
      });

      setCases(visibleCaseRows);
      setCommercialUsers(visibleUsers);
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

  const filteredCasesByRange = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minValue = saleValueMin ? Number(saleValueMin) : null;
    const maxValue = saleValueMax ? Number(saleValueMax) : null;

    return cases.filter((item) => {
      const referenceDate = dateToLocalISO(getCaseReferenceDate(item));
      const matchesDateFrom = dateFrom ? (referenceDate || "") >= dateFrom : true;
      const matchesDateTo = dateTo ? (referenceDate || "") <= dateTo : true;
      const matchesCommercial = commercialFilter
        ? item.assigned_commercial_user_id === commercialFilter
        : true;
      const saleValue = Number(item.sale_value || 0);
      const matchesMinValue = minValue !== null ? saleValue >= minValue : true;
      const matchesMaxValue = maxValue !== null ? saleValue <= maxValue : true;
      const commercialName = nombreComercial(item.assigned_commercial_user_id).toLowerCase();
      const matchesSearch = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q) ||
          commercialName.includes(q)
        : true;

      return (
        matchesDateFrom &&
        matchesDateTo &&
        matchesCommercial &&
        matchesMinValue &&
        matchesMaxValue &&
        matchesSearch
      );
    });
  }, [
    cases,
    search,
    dateFrom,
    dateTo,
    commercialFilter,
    saleValueMin,
    saleValueMax,
    commercialUsers,
    currentUserId,
    currentRoleName,
  ]);

  const activeCasesByCommercial = useMemo(() => {
    const map: Record<string, number> = {};

    filteredCasesByRange.forEach((item) => {
      if (item.assigned_commercial_user_id && activeCommercialStatuses.includes(item.status)) {
        map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
      }
    });

    return map;
  }, [filteredCasesByRange]);

  const finishedTodayByCommercial = useMemo(() => {
    const map: Record<string, number> = {};

    filteredCasesByRange.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (!esHoy(getCaseReferenceDate(item))) return;

      map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
    });

    return map;
  }, [filteredCasesByRange]);

  const salesTodayByCommercial = useMemo(() => {
    const map: Record<string, number> = {};

    filteredCasesByRange.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (item.status !== "finalizado") return;
      if (!esVentaReal(item)) return;
      if (!esHoy(getCaseReferenceDate(item))) return;

      map[item.assigned_commercial_user_id] = (map[item.assigned_commercial_user_id] || 0) + 1;
    });

    return map;
  }, [filteredCasesByRange]);

  const pendingCases = useMemo(
    () => filteredCasesByRange.filter((item) => item.status === "pendiente_asignacion_comercial"),
    [filteredCasesByRange]
  );

  const inProgressCases = useMemo(
    () => filteredCasesByRange.filter((item) => activeCommercialStatuses.includes(item.status)),
    [filteredCasesByRange]
  );

  const finalizadosCases = useMemo(
    () => filteredCasesByRange.filter((item) => item.status === "finalizado"),
    [filteredCasesByRange]
  );

  const resumen = useMemo(() => {
    return {
      pendientes: pendingCases.length,
      enAtencion: inProgressCases.length,
      finalizados: finalizadosCases.length,
      ventas: finalizadosCases.filter(esVentaReal).length,
      seguimientos: filteredCasesByRange.filter((x) => x.status === "seguimiento_comercial").length,
      disponibles: commercialUsers.filter((user) => (activeCasesByCommercial[user.id] || 0) === 0).length,
    };
  }, [pendingCases, inProgressCases, finalizadosCases, filteredCasesByRange, commercialUsers, activeCasesByCommercial]);

  const visibleCases = useMemo(() => {
    if (activeTab === "pendientes") return pendingCases;
    if (activeTab === "en_gestion") return inProgressCases;
    if (activeTab === "finalizados") return finalizadosCases;
    return filteredCasesByRange;
  }, [activeTab, pendingCases, inProgressCases, finalizadosCases, filteredCasesByRange]);

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
      <section className={panelClass}>
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#24312A]">{title}</h2>
            <p className="mt-1 text-sm text-[#607368]">{description}</p>
          </div>

          <button
            onClick={() => void cargarDatos()}
            className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
          >
            Actualizar
          </button>
        </div>

        <div className="mb-6">
          <input
            className={inputClass}
            placeholder="Buscar por nombre, teléfono o ciudad"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
            Cargando información...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
            No hay registros para esta vista.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#24312A]">{item.customer_name}</h3>
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

                    <div className="w-full rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner lg:w-[380px]">
                    <p className="mb-3 text-sm font-medium text-[#32453A]">
                      {item.assigned_commercial_user_id ? "Reasignar o editar" : "Asignar atención"}
                    </p>

                    <div className="space-y-3">
                      <select
                        className={inputClass}
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
                          className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                        >
                          {savingCaseId === item.id ? "Guardando..." : item.assigned_commercial_user_id ? "Reasignar" : "Asignar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void atenderYo(item.id)}
                          disabled={savingCaseId === item.id}
                          className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:opacity-60"
                        >
                          Atender yo
                        </button>

                        <a
                          href={`/comercial?caseId=${item.id}`}
                          className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                        >
                          Editar gestión
                        </a>
                      </div>

                      <div className="rounded-2xl border border-dashed border-[#CFE4D8] bg-white/88 p-3 text-xs text-[#607368]">
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
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className={`mx-auto max-w-7xl ${panelClass}`}>
          <p className="text-sm font-medium text-[#607368]">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(150,102,95,0.12)]">
          <p className="text-sm font-medium text-red-700">{error || "No tienes permiso para entrar a este módulo."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Gerencia comercial</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">Centro de control comercial</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Asigna clientes, revisa disponibilidad del equipo y entra a la gestión solo cuando lo necesites.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">
                  {currentTeamKey ? getCommercialTeamLabel(currentTeamKey) : "Vista comercial"}
                </span>
                <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">
                  Resultados del dÃ­a por defecto
                </span>
              </div>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]">
              Inicio
            </a>
            <Link
              href="/comercial"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Ir a Comercial
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">{error}</div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-[26px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(245,252,247,0.98)_0%,_rgba(237,248,241,0.98)_100%)] p-4 text-sm text-[#4F6F5B] shadow-[0_16px_32px_rgba(95,125,102,0.08)]">{mensaje}</div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Pendientes" value={String(resumen.pendientes)} />
          <StatCard title="En atención" value={String(resumen.enAtencion)} />
          <StatCard title="Finalizados" value={String(resumen.finalizados)} />
          <StatCard title="Ventas" value={String(resumen.ventas)} />
          <StatCard title="Seguimientos" value={String(resumen.seguimientos)} />
          <StatCard title="Disponibles" value={String(resumen.disponibles)} />
        </section>

        <section className={panelClass}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
              <input
                className={inputClass}
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                className={inputClass}
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Comercial</label>
              <select
                className={inputClass}
                value={commercialFilter}
                onChange={(e) => setCommercialFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {commercialUsers
                  .filter((user) => user.role_code === "comercial")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Valor mínimo</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={saleValueMin}
                onChange={(e) => setSaleValueMin(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Valor máximo</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={saleValueMax}
                onChange={(e) => setSaleValueMax(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <input
              className={inputClass}
              placeholder="Buscar por cliente, teléfono, ciudad o comercial"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              type="button"
              onClick={() => {
                const today = hoyISO();
                setDateFrom(today);
                setDateTo(today);
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => {
                const today = hoyISO();
                setDateFrom(today);
                setDateTo(today);
                setCommercialFilter("");
                setSaleValueMin("");
                setSaleValueMax("");
                setSearch("");
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Limpiar
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-4 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
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
          <section className={panelClass}>
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
          ? "bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)]"
          : "border border-[#CFE4D8] bg-white/90 text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="group overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)] transition duration-200 hover:-translate-y-1 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]">
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-3 shadow-inner">
      <p className="text-xs text-[#607368]">{label}</p>
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
