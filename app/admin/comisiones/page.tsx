"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";

type AdminCommercialCase = {
  id: string;
  customer_name: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  net_commission_base: number | null;
  payment_method: string | null;
  assigned_commercial_user_id: string | null;
  commission_source_type: string | null;
  opc_user_id: string | null;
  call_user_id: string | null;
  lead_id: string | null;
  sale_origin_type: string | null;
  commercial_notes: string | null;
};

type ProfileOption = {
  id: string;
  full_name: string;
  job_title: string | null;
};

type CommissionEntry = {
  caseId: string;
  customerName: string;
  phone: string | null;
  createdAt: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryArea: string;
  commissionKind: "opc" | "tmk";
  sourceType: string | null;
  saleOriginType: "lead" | "directo";
  isQ: boolean;
  hasSale: boolean;
  volume: number;
  cash: number;
  portfolio: number;
  baseNeta: number;
  fixedCommission: number;
  saleCommission: number;
  totalCommission: number;
};

const allowedRoles = [
  "super_user",
  "administrador",
];

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inicioMesISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-CO")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function commissionSourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };

  if (!value) return "Sin definir";
  return map[value] || value;
}

function commissionKindLabel(value: CommissionEntry["commissionKind"]) {
  return value === "opc" ? "OPC" : "TMK";
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function normalizeArea(jobTitle: string | null | undefined) {
  const value = normalizeText(jobTitle);

  if (!value) return "Sin rol";
  if (value.includes("supervisor") && value.includes("opc")) return "Supervisor OPC";
  if (value.includes("supervisor") && value.includes("call")) return "Supervisor Call";
  if (value.includes("promotor") || value === "opc" || value.includes(" opc")) return "OPC";
  if (value.includes("call center") || value === "call" || value.includes("call")) return "Call center";
  if (value.includes("tmk")) return "TMK";
  if (value.includes("gerencia comercial") || value.includes("gerente comercial")) return "Gerencia comercial";
  if (value.includes("comercial")) return "Comercial";
  if (value.includes("admin")) return "Administrador";

  return jobTitle || "Sin rol";
}

function inferSaleOriginType(caseItem: AdminCommercialCase): "lead" | "directo" {
  if (caseItem.sale_origin_type === "lead" || caseItem.sale_origin_type === "directo") {
    return caseItem.sale_origin_type;
  }

  if (caseItem.lead_id || caseItem.commission_source_type === "base") {
    return "lead";
  }

  return "directo";
}

function extractInitialClassification(value: string | null | undefined) {
  const receptionSummary = parseStoredCommercialNotes(value).receptionSummary;
  const normalized = normalizeText(receptionSummary);
  const match = normalized.match(/clasificacion inicial:\s*(q|no q)/);
  if (!match) return null;
  return match[1] === "q" ? "Q" : "No Q";
}

function hasRealSale(caseItem: AdminCommercialCase) {
  return (
    Number(caseItem.volume_amount || 0) > 0 ||
    Number(caseItem.cash_amount || 0) > 0 ||
    Number(caseItem.portfolio_amount || 0) > 0
  );
}

function isCaseQ(caseItem: AdminCommercialCase) {
  if (hasRealSale(caseItem)) return true;
  return extractInitialClassification(caseItem.commercial_notes) === "Q";
}

function matchesCommissionQuickFilter(caseItem: AdminCommercialCase, quickFilter: string) {
  if (!quickFilter) return true;
  if (quickFilter === "opc") return Boolean(caseItem.opc_user_id);
  if (quickFilter === "tmk") return Boolean(caseItem.call_user_id);
  return (caseItem.commission_source_type || "") === quickFilter;
}

function buildCommissionEntries(
  caseItem: AdminCommercialCase,
  profileMap: Map<string, ProfileOption>
): CommissionEntry[] {
  const entries: CommissionEntry[] = [];
  const volume = Number(caseItem.volume_amount || 0);
  const cash = Number(caseItem.cash_amount || 0);
  const portfolio = Number(caseItem.portfolio_amount || 0);
  const baseNeta = Number(caseItem.net_commission_base || 0);
  const saleOriginType = inferSaleOriginType(caseItem);
  const sourceType = caseItem.commission_source_type || null;
  const hasSale = hasRealSale(caseItem);
  const isQ = isCaseQ(caseItem);

  if (caseItem.opc_user_id) {
    const opcProfile = profileMap.get(caseItem.opc_user_id);
    const fixedCommission =
      saleOriginType === "directo" ? (isQ ? 10000 : 0) : isQ ? 5000 : 1000;
    const saleCommission = hasSale
      ? baseNeta * (saleOriginType === "directo" ? 0.02 : 0.01)
      : 0;

    entries.push({
      caseId: caseItem.id,
      customerName: caseItem.customer_name,
      phone: caseItem.phone,
      createdAt: caseItem.created_at,
      beneficiaryId: caseItem.opc_user_id,
      beneficiaryName: opcProfile?.full_name || "OPC sin asignar",
      beneficiaryArea: normalizeArea(opcProfile?.job_title),
      commissionKind: "opc",
      sourceType,
      saleOriginType,
      isQ,
      hasSale,
      volume,
      cash,
      portfolio,
      baseNeta,
      fixedCommission,
      saleCommission,
      totalCommission: fixedCommission + saleCommission,
    });
  }

  if (caseItem.call_user_id) {
    const callProfile = profileMap.get(caseItem.call_user_id);
    const isBase = sourceType === "base";
    const fixedCommission = isQ ? (isBase ? 10000 : 5000) : 0;
    const saleCommission = hasSale ? baseNeta * (isBase ? 0.02 : 0.01) : 0;

    entries.push({
      caseId: caseItem.id,
      customerName: caseItem.customer_name,
      phone: caseItem.phone,
      createdAt: caseItem.created_at,
      beneficiaryId: caseItem.call_user_id,
      beneficiaryName: callProfile?.full_name || "TMK sin asignar",
      beneficiaryArea: normalizeArea(callProfile?.job_title),
      commissionKind: "tmk",
      sourceType,
      saleOriginType,
      isQ,
      hasSale,
      volume,
      cash,
      portfolio,
      baseNeta,
      fixedCommission,
      saleCommission,
      totalCommission: fixedCommission + saleCommission,
    });
  }

  return entries;
}

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const commissionSourceQuickFilters = [
  { value: "", label: "Todos" },
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "base", label: "Base" },
  { value: "redes", label: "Redes" },
  { value: "otro", label: "Otro" },
];

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#24312A]">{value}</p>
      <p className="mt-2 text-xs text-[#607368]">{subtitle}</p>
    </div>
  );
}

export default function AdminComisionesPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cases, setCases] = useState<AdminCommercialCase[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [search, setSearch] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [commissionSourceFilter, setCommissionSourceFilter] = useState("");

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
        setError("No tienes permiso para entrar a Comisiones.");
        return;
      }

      setAuthorized(true);
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

      const [casesResult, profilesResult] = await Promise.all([
        supabase
          .from("commercial_cases")
          .select(`
            id,
            customer_name,
            phone,
            city,
            created_at,
            volume_amount,
            cash_amount,
            portfolio_amount,
            net_commission_base,
            payment_method,
            assigned_commercial_user_id,
            commission_source_type,
            opc_user_id,
            call_user_id,
            lead_id,
            sale_origin_type,
            commercial_notes
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, job_title")
          .order("full_name", { ascending: true }),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setCases((casesResult.data as AdminCommercialCase[]) || []);
      setProfiles((profilesResult.data as ProfileOption[]) || []);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de comisiones.");
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
  }, [authorized]);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((item) => map.set(item.id, item));
    return map;
  }, [profiles]);

  const collaboratorOptions = useMemo(() => {
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.full_name || "Sin nombre",
      area: normalizeArea(profile.job_title),
    }));
  }, [profiles]);

  const areaOptions = useMemo(() => {
    const unique = new Set<string>();

    collaboratorOptions.forEach((item) => {
      if (item.area) unique.add(item.area);
    });

    return Array.from(unique).sort((a, b) => a.localeCompare(b, "es"));
  }, [collaboratorOptions]);

  const filteredCollaboratorOptions = useMemo(() => {
    if (!areaFilter) return collaboratorOptions;
    return collaboratorOptions.filter((item) => item.area === areaFilter);
  }, [collaboratorOptions, areaFilter]);

  useEffect(() => {
    if (!collaboratorFilter) return;

    const stillExists = filteredCollaboratorOptions.some(
      (item) => item.id === collaboratorFilter
    );

    if (!stillExists) {
      setCollaboratorFilter("");
    }
  }, [areaFilter, collaboratorFilter, filteredCollaboratorOptions]);

  const casosFiltrados = useMemo(() => {
    const q = normalizeText(search);

    return cases.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const commercialProfile = item.assigned_commercial_user_id
        ? profileMap.get(item.assigned_commercial_user_id)
        : null;
      const opcProfile = item.opc_user_id ? profileMap.get(item.opc_user_id) : null;
      const callProfile = item.call_user_id ? profileMap.get(item.call_user_id) : null;
      const collaboratorName = commercialProfile?.full_name || "";
      const collaboratorArea = normalizeArea(commercialProfile?.job_title);
      const opcName = item.opc_user_id ? profileMap.get(item.opc_user_id)?.full_name || "" : "";
      const callName = item.call_user_id ? profileMap.get(item.call_user_id)?.full_name || "" : "";
      const opcArea = normalizeArea(opcProfile?.job_title);
      const callArea = normalizeArea(callProfile?.job_title);

      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesCollaborator = collaboratorFilter
        ? [
            item.assigned_commercial_user_id || "",
            item.opc_user_id || "",
            item.call_user_id || "",
          ].includes(collaboratorFilter)
        : true;
      const matchesArea = areaFilter
        ? [collaboratorArea, opcArea, callArea].includes(areaFilter)
        : true;
      const matchesCommissionSource = matchesCommissionQuickFilter(item, commissionSourceFilter);
      const matchesSearch = q
        ? normalizeText(item.customer_name).includes(q) ||
          normalizeText(item.phone).includes(q) ||
          normalizeText(item.city).includes(q) ||
          normalizeText(collaboratorName).includes(q) ||
          normalizeText(opcName).includes(q) ||
          normalizeText(callName).includes(q)
        : true;

      return (
        matchesDateFrom &&
        matchesDateTo &&
        matchesCollaborator &&
        matchesArea &&
        matchesCommissionSource &&
        matchesSearch
      );
    });
  }, [
    cases,
    profileMap,
    dateFrom,
    dateTo,
    collaboratorFilter,
    areaFilter,
    commissionSourceFilter,
    search,
  ]);

  const commissionEntries = useMemo(() => {
    return casosFiltrados.flatMap((item) => buildCommissionEntries(item, profileMap));
  }, [casosFiltrados, profileMap]);

  const ventasFiltradas = useMemo(() => {
    return casosFiltrados.filter((item) => hasRealSale(item));
  }, [casosFiltrados]);

  const resumen = useMemo(() => {
    return {
      total: ventasFiltradas.length,
      volumen: ventasFiltradas.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
      caja: ventasFiltradas.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
      cartera: ventasFiltradas.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
      baseNeta: ventasFiltradas.reduce((acc, item) => acc + Number(item.net_commission_base || 0), 0),
      comisionTotal: commissionEntries.reduce((acc, item) => acc + item.totalCommission, 0),
    };
  }, [ventasFiltradas, commissionEntries]);

  const resumenPorColaborador = useMemo(() => {
    const map = new Map<
      string,
      {
        collaboratorId: string;
        collaboratorName: string;
        area: string;
        tipoComision: string;
        casosQ: number;
        ventas: number;
        fijo: number;
        variable: number;
        baseNeta: number;
        totalComision: number;
      }
    >();

    commissionEntries.forEach((item) => {
      const collaboratorId = item.beneficiaryId;

      if (!map.has(collaboratorId)) {
        map.set(collaboratorId, {
          collaboratorId,
          collaboratorName: item.beneficiaryName,
          area: item.beneficiaryArea,
          tipoComision: commissionKindLabel(item.commissionKind),
          casosQ: 0,
          ventas: 0,
          fijo: 0,
          variable: 0,
          baseNeta: 0,
          totalComision: 0,
        });
      }

      const current = map.get(collaboratorId)!;
      if (item.isQ) current.casosQ += 1;
      if (item.hasSale) current.ventas += 1;
      current.fijo += item.fixedCommission;
      current.variable += item.saleCommission;
      current.baseNeta += item.baseNeta;
      current.totalComision += item.totalCommission;
    });

    return Array.from(map.values()).sort((a, b) => b.totalComision - a.totalComision);
  }, [commissionEntries]);

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
          <p className="text-sm font-medium text-[#9A4E43]">
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
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Admin</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">Comisiones</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Vista separada para revisar base neta, ventas y resumen por colaborador.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Volver a admin
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Actualizar
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

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
              <label className="mb-2 block text-sm font-medium text-slate-700">Ãrea o rol</label>
              <select
                className={inputClass}
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {areaOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Colaborador</label>
              <select
                className={inputClass}
                value={collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {filteredCollaboratorOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Buscar</label>
              <input
                className={inputClass}
                placeholder="Cliente o colaborador"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setDateFrom(hoyISO());
                setDateTo(hoyISO());
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFrom(inicioMesISO());
                setDateTo(hoyISO());
                setAreaFilter("");
                setCollaboratorFilter("");
                setCommissionSourceFilter("");
                setSearch("");
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {commissionSourceQuickFilters.map((item) => {
              const isActive = commissionSourceFilter === item.value;

              return (
                <button
                  key={item.value || "all"}
                  type="button"
                  onClick={() => setCommissionSourceFilter(item.value)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] text-white shadow-[0_14px_28px_rgba(95,125,102,0.18)]"
                      : "border border-[#CFE4D8] bg-white/88 text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Ventas" value={String(resumen.total)} subtitle="Ventas reales filtradas" />
          <StatCard title="Volumen" value={formatMoney(resumen.volumen)} subtitle="Suma filtrada" />
          <StatCard title="Caja" value={formatMoney(resumen.caja)} subtitle="Pago recibido" />
          <StatCard title="Cartera" value={formatMoney(resumen.cartera)} subtitle="Saldo pendiente" />
          <StatCard title="Base neta" value={formatMoney(resumen.baseNeta)} subtitle="Base comisionable" />
          <StatCard title="Comisión" value={formatMoney(resumen.comisionTotal)} subtitle="Total calculado" />
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Resumen por colaborador</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Agrupado según la comisión calculada para el rango filtrado.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Cargando resumen...
            </div>
          ) : resumenPorColaborador.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              No hay datos para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D7EADF] text-left text-[#5B6E63]">
                    <th className="px-3 py-3">Colaborador</th>
                    <th className="px-3 py-3">Área</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Casos Q</th>
                    <th className="px-3 py-3">Ventas</th>
                    <th className="px-3 py-3">Fijo</th>
                    <th className="px-3 py-3">Venta</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Total comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorColaborador.map((item) => (
                    <tr key={item.collaboratorId} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.collaboratorName}</td>
                      <td className="px-3 py-3 text-slate-700">{item.area}</td>
                      <td className="px-3 py-3 text-slate-700">{item.tipoComision}</td>
                      <td className="px-3 py-3 text-slate-700">{item.casosQ}</td>
                      <td className="px-3 py-3 text-slate-700">{item.ventas}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.fijo)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.variable)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.baseNeta)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalComision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Detalle de comisión calculada</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Una fila por beneficiario con su fijo, variable y total.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Cargando detalle...
            </div>
          ) : commissionEntries.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              No hay comisiones para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D7EADF] text-left text-[#5B6E63]">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Beneficiario</th>
                    <th className="px-3 py-3">Área</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Fuente</th>
                    <th className="px-3 py-3">Origen</th>
                    <th className="px-3 py-3">Q</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Fijo</th>
                    <th className="px-3 py-3">Venta</th>
                    <th className="px-3 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionEntries.map((item) => (
                    <tr
                      key={`${item.caseId}-${item.commissionKind}-${item.beneficiaryId}`}
                      className="border-b border-slate-100 align-top"
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.customerName}</div>
                        <div className="text-slate-500">{item.phone || "Sin teléfono"}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTime(item.createdAt)}</td>
                      <td className="px-3 py-3 text-slate-700">{item.beneficiaryName}</td>
                      <td className="px-3 py-3 text-slate-700">{item.beneficiaryArea}</td>
                      <td className="px-3 py-3 text-slate-700">{commissionKindLabel(item.commissionKind)}</td>
                      <td className="px-3 py-3 text-slate-700">{commissionSourceLabel(item.sourceType)}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.saleOriginType === "directo" ? "Directo" : "Lead"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{item.isQ ? "Q" : "No Q"}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.baseNeta)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.fixedCommission)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.saleCommission)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalCommission)}</td>
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


