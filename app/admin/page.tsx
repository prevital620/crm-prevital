"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole, normalizeRoleCode } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

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
};

type ProfileOption = {
  id: string;
  full_name: string;
  job_title: string | null;
};

const allowedRoles = [
  "super_user",
  "administrador",
];

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

function paymentMethodLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    contado: "Contado",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    mixto: "Mixto",
    cartera: "Cartera",
    addi: "Addi",
    welly: "Welly",
    medipay: "Medipay",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

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

export default function AdminPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cases, setCases] = useState<AdminCommercialCase[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState("");

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      try {
        const auth = await getCurrentUserRole();
        const normalizedRole = normalizeRoleCode(auth?.roleCode);

        if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
          setAuthorized(false);
          setError("No tienes permiso para entrar a Admin.");
          return;
        }

        setAuthorized(true);
        return;
      } catch {
        const { data: profileFallback, error: profileError } = await supabase
          .from("profiles")
          .select("job_title")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const fallbackRole = normalizeRoleCode(profileFallback?.job_title || null);

        if (!fallbackRole || !allowedRoles.includes(fallbackRole)) {
          setAuthorized(false);
          setError("No tienes permiso para entrar a Admin.");
          return;
        }

        setAuthorized(true);
      }
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
            assigned_commercial_user_id
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
      setError(err?.message || "No se pudieron cargar los datos de admin.");
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

  const ventasReales = useMemo(() => {
    return cases.filter((item) => {
      const volume = Number(item.volume_amount || 0);
      const cash = Number(item.cash_amount || 0);
      const portfolio = Number(item.portfolio_amount || 0);
      return volume > 0 || cash > 0 || portfolio > 0;
    });
  }, [cases]);

  const ventasFiltradas = useMemo(() => {
    const q = normalizeText(search);

    return ventasReales.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const profile = item.assigned_commercial_user_id
        ? profileMap.get(item.assigned_commercial_user_id)
        : null;
      const collaboratorName = profile?.full_name || "";
      const collaboratorArea = normalizeArea(profile?.job_title);

      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesArea = areaFilter ? collaboratorArea === areaFilter : true;
      const matchesCollaborator = collaboratorFilter
        ? (item.assigned_commercial_user_id || "") === collaboratorFilter
        : true;
      const matchesSearch = q
        ? normalizeText(item.customer_name).includes(q) ||
          normalizeText(item.phone).includes(q) ||
          normalizeText(item.city).includes(q) ||
          normalizeText(collaboratorName).includes(q)
        : true;

      return (
        matchesDateFrom &&
        matchesDateTo &&
        matchesArea &&
        matchesCollaborator &&
        matchesSearch
      );
    });
  }, [ventasReales, profileMap, dateFrom, dateTo, areaFilter, collaboratorFilter, search]);

  const ventasHoy = useMemo(() => {
    const today = hoyISO();
    const items = ventasReales.filter((item) => item.created_at?.slice(0, 10) === today);

    return {
      total: items.length,
      volumen: items.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
      caja: items.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
      cartera: items.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
    };
  }, [ventasReales]);

  const resumenRango = useMemo(() => {
    return {
      total: ventasFiltradas.length,
      volumen: ventasFiltradas.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
      caja: ventasFiltradas.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
      cartera: ventasFiltradas.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
      baseNeta: ventasFiltradas.reduce((acc, item) => acc + Number(item.net_commission_base || 0), 0),
    };
  }, [ventasFiltradas]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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

      {loadingAuth ? (
        <div className="mx-auto max-w-7xl">
          <div className={panelClass}>
            <p className="text-sm font-medium text-[#607368]">Validando acceso...</p>
          </div>
        </div>
      ) : !authorized ? (
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[32px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(150,102,95,0.12)]">
            <p className="text-sm font-medium text-[#9A4E43]">
              {error || "No tienes permiso para entrar a este módulo."}
            </p>
          </div>
        </div>
      ) : (
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
                <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">Resumen administrativo</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                  Vista simple enfocada solo en ventas reales, cartera, caja y base neta.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                  <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">Visi&oacute;n ejecutiva</span>
                  <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">M&eacute;tricas claras</span>
                </div>
              </div>

              <SessionBadge />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/crm"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Inicio
              </a>

              <button
                type="button"
                onClick={() => void cargarDatos()}
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Actualizar
              </button>

              <a
                href="/admin/comisiones"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Ver comisiones
              </a>

              <a
                href="/admin/cartera"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Ver cartera
              </a>
            </div>
          </section>

          {error ? (
            <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
              {error}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Ventas del día" value={String(ventasHoy.total)} subtitle="Ventas reales hoy" />
            <StatCard title="Volumen del día" value={formatMoney(ventasHoy.volumen)} subtitle="Ventas reales hoy" />
            <StatCard title="Caja del día" value={formatMoney(ventasHoy.caja)} subtitle="Pagado hoy" />
            <StatCard title="Cartera del día" value={formatMoney(ventasHoy.cartera)} subtitle="Pendiente hoy" />
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
                <label className="mb-2 block text-sm font-medium text-slate-700">Área o rol</label>
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
                  placeholder="Cliente, teléfono, ciudad o colaborador"
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
                  setSearch("");
                }}
                className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Ventas del rango" value={String(resumenRango.total)} subtitle="Solo ventas reales" />
            <StatCard title="Volumen del rango" value={formatMoney(resumenRango.volumen)} subtitle="Suma del rango" />
            <StatCard title="Caja del rango" value={formatMoney(resumenRango.caja)} subtitle="Pagado en el rango" />
            <StatCard title="Cartera del rango" value={formatMoney(resumenRango.cartera)} subtitle="Pendiente por cobrar" />
            <StatCard title="Base neta del rango" value={formatMoney(resumenRango.baseNeta)} subtitle="Base comisionable" />
          </section>

          <section className={panelClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Ventas reales del rango</h2>
                <p className="mt-1 text-sm text-[#607368]">
                  Solo aparecen registros con volumen, caja o cartera mayor a cero.
                </p>
              </div>

              <a
                href="/admin/comisiones"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Ir a comisiones
              </a>
            </div>

            {loading ? (
              <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                Cargando ventas...
              </div>
            ) : ventasFiltradas.length === 0 ? (
              <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                No hay ventas reales para esos filtros.
              </div>
            ) : (
              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D7EADF] text-left text-[#5B6E63]">
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3">Colaborador</th>
                      <th className="px-3 py-3">Área</th>
                      <th className="px-3 py-3">Volumen</th>
                      <th className="px-3 py-3">Caja</th>
                      <th className="px-3 py-3">Cartera</th>
                      <th className="px-3 py-3">Base neta</th>
                      <th className="px-3 py-3">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasFiltradas.map((item) => {
                      const profile = item.assigned_commercial_user_id
                        ? profileMap.get(item.assigned_commercial_user_id)
                        : null;

                      return (
                        <tr key={item.id} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">{item.customer_name}</div>
                            <div className="text-slate-500">{item.phone || "Sin teléfono"}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-700">{formatDateTime(item.created_at)}</td>
                          <td className="px-3 py-3 text-slate-700">
                            {profile?.full_name || "Sin asignar"}
                          </td>
                          <td className="px-3 py-3 text-slate-700">{normalizeArea(profile?.job_title)}</td>
                          <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.volume_amount || 0))}</td>
                          <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.cash_amount || 0))}</td>
                          <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.portfolio_amount || 0))}</td>
                          <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.net_commission_base || 0))}</td>
                          <td className="px-3 py-3 text-slate-700">{paymentMethodLabel(item.payment_method)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
