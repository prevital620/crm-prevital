"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

type CommercialCase = {
  id: string;
  customer_name: string;
  created_at: string;
  status: string;
  assigned_commercial_user_id: string | null;
  volume_amount: number | null;
  cash_amount: number | null;
  net_commission_base: number | null;
  gross_bonus_base: number | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role_code: string;
  role_name: string;
};

const allowedRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
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

function formatDate(value: string | null | undefined) {
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

function getCommercialRate(netBase: number) {
  if (netBase <= 500000) return 0.05;
  if (netBase <= 1200000) return 0.06;
  if (netBase <= 2300000) return 0.07;
  if (netBase <= 3000000) return 0.10;
  if (netBase <= 4000000) return 0.12;
  return 0.15;
}

function getCommercialBonus(grossVolume: number) {
  if (grossVolume >= 52000000) return 3000000;
  if (grossVolume >= 42000000) return 2100000;
  if (grossVolume >= 32000000) return 1500000;
  if (grossVolume >= 27000000) return 1000000;
  if (grossVolume >= 21000000) return 600000;
  return 0;
}

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
    <div className="overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm">
      <div className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#24312A]">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

export default function AdminComisionesPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [cases, setCases] = useState<CommercialCase[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [collaboratorFilter, setCollaboratorFilter] = useState("");

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
            created_at,
            status,
            assigned_commercial_user_id,
            volume_amount,
            cash_amount,
            net_commission_base,
            gross_bonus_base
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select(`
            id,
            full_name,
            user_roles!user_roles_user_id_fkey (
              roles (
                code,
                name
              )
            )
          `),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      const rawProfiles = (profilesResult.data as any[]) || [];
      const mappedProfiles: ProfileRow[] = rawProfiles.map((row) => {
        const role = row.user_roles?.[0]?.roles;
        return {
          id: row.id,
          full_name: row.full_name || "Sin nombre",
          role_code: role?.code || "",
          role_name: role?.name || "",
        };
      });

      setCases((casesResult.data as CommercialCase[]) || []);
      setProfiles(mappedProfiles);
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

  const advisorProfiles = useMemo(() => {
    return profiles.filter((item) => item.role_code === "comercial");
  }, [profiles]);

  const managerProfiles = useMemo(() => {
    return profiles.filter((item) =>
      ["gerente", "gerente_comercial", "gerencia_comercial"].includes(item.role_code)
    );
  }, [profiles]);

  const finalizedCases = useMemo(() => {
    return cases.filter((item) => item.status === "finalizado");
  }, [cases]);

  const filteredCases = useMemo(() => {
    return finalizedCases.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesCollaborator = collaboratorFilter
        ? item.assigned_commercial_user_id === collaboratorFilter
        : true;

      return matchesDateFrom && matchesDateTo && matchesCollaborator;
    });
  }, [finalizedCases, dateFrom, dateTo, collaboratorFilter]);

  const advisorsTable = useMemo(() => {
    const grouped = new Map<string, CommercialCase[]>();

    filteredCases.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      const key = item.assigned_commercial_user_id;
      const current = grouped.get(key) || [];
      current.push(item);
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([userId, items]) => {
        const profile = advisorProfiles.find((item) => item.id === userId);
        const salesCount = items.length;
        const grossVolume = items.reduce((acc, item) => acc + Number(item.gross_bonus_base || item.volume_amount || 0), 0);
        const totalCash = items.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0);
        const totalNetBase = items.reduce((acc, item) => acc + Number(item.net_commission_base || 0), 0);

        const perSaleCommission = items.reduce((acc, item) => {
          const netBase = Number(item.net_commission_base || 0);
          const rate = getCommercialRate(netBase);
          return acc + Math.round(netBase * rate);
        }, 0);

        const effectiveRate =
          totalNetBase > 0 ? perSaleCommission / totalNetBase : 0;

        const bonus = getCommercialBonus(grossVolume);
        const totalCommission = perSaleCommission + bonus;

        return {
          user_id: userId,
          full_name: profile?.full_name || "Sin nombre",
          role_name: profile?.role_name || "Comercial",
          salesCount,
          grossVolume,
          totalCash,
          totalNetBase,
          effectiveRate,
          commission: perSaleCommission,
          bonus,
          totalCommission,
        };
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [filteredCases, advisorProfiles]);

  const managerSummary = useMemo(() => {
    const totalNetBase = filteredCases.reduce(
      (acc, item) => acc + Number(item.net_commission_base || 0),
      0
    );
    const managerCommission = Math.round(totalNetBase * 0.035);

    return {
      managers: managerProfiles,
      totalNetBase,
      managerCommission,
    };
  }, [filteredCases, managerProfiles]);

  const totals = useMemo(() => {
    const totalCommercialCommission = advisorsTable.reduce(
      (acc, item) => acc + item.commission,
      0
    );
    const totalCommercialBonus = advisorsTable.reduce(
      (acc, item) => acc + item.bonus,
      0
    );
    const totalCommercialToPay = advisorsTable.reduce(
      (acc, item) => acc + item.totalCommission,
      0
    );

    return {
      totalCommercialCommission,
      totalCommercialBonus,
      totalCommercialToPay,
      totalManagerCommission: managerSummary.managerCommission,
      totalAreaToPay: totalCommercialToPay + managerSummary.managerCommission,
    };
  }, [advisorsTable, managerSummary]);

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
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
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
              <p className="text-sm font-medium text-[#7FA287]">Admin</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Comisiones comerciales</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Primera versión para liquidar el área comercial y la comisión del gerente comercial en el rango elegido.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Volver a Admin
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Actualizar
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
              <input
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Colaborador</label>
              <select
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                value={collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {advisorProfiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Comisión comercial" value={formatMoney(totals.totalCommercialCommission)} subtitle="Por venta escalonada" />
          <StatCard title="Bono comercial" value={formatMoney(totals.totalCommercialBonus)} subtitle="Por volumen bruto" />
          <StatCard title="Comisión gerente" value={formatMoney(totals.totalManagerCommission)} subtitle="3.5% sobre caja neta" />
          <StatCard title="Total área comercial" value={formatMoney(totals.totalAreaToPay)} subtitle="Comercial + gerente" />
          <StatCard title="Ventas finalizadas" value={String(filteredCases.length)} subtitle="Casos dentro del rango" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Asesores comerciales</h2>
            <p className="mt-1 text-sm text-slate-500">
              Comisión escalonada por venta y bono por volumen bruto acumulado.
            </p>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando comisiones...
              </div>
            ) : advisorsTable.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay ventas finalizadas para ese filtro.
              </div>
            ) : (
              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-3 py-3">Colaborador</th>
                      <th className="px-3 py-3">Ventas</th>
                      <th className="px-3 py-3">Volumen bruto</th>
                      <th className="px-3 py-3">Caja</th>
                      <th className="px-3 py-3">Base neta</th>
                      <th className="px-3 py-3">% efectivo</th>
                      <th className="px-3 py-3">Comisión</th>
                      <th className="px-3 py-3">Bono</th>
                      <th className="px-3 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advisorsTable.map((item) => (
                      <tr key={item.user_id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{item.full_name}</div>
                          <div className="text-slate-500">{item.role_name}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{item.salesCount}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.grossVolume)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.totalCash)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.totalNetBase)}</td>
                        <td className="px-3 py-3 text-slate-700">{(item.effectiveRate * 100).toFixed(2)}%</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.commission)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.bonus)}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalCommission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Gerente comercial</h2>
              <p className="mt-1 text-sm text-slate-500">
                Comisión del 3.5% sobre la caja neta del rango.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Base neta del rango</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {formatMoney(managerSummary.totalNetBase)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Comisión gerente</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {formatMoney(managerSummary.managerCommission)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Perfiles gerente</p>
                  <div className="mt-3 space-y-2">
                    {managerSummary.managers.length === 0 ? (
                      <p className="text-sm text-slate-500">No se encontró perfil gerente.</p>
                    ) : (
                      managerSummary.managers.map((item) => (
                        <div key={item.id} className="rounded-xl bg-[#F8F7F4] px-3 py-2 text-sm text-slate-700">
                          {item.full_name} · {item.role_name}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Reglas usadas</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>Hasta 500.000 → 5%</p>
                <p>500.001 a 1.200.000 → 6%</p>
                <p>1.200.001 a 2.300.000 → 7%</p>
                <p>2.300.001 a 3.000.000 → 10%</p>
                <p>3.000.001 a 4.000.000 → 12%</p>
                <p>4.000.000 en adelante → 15%</p>
                <hr className="my-3 border-slate-200" />
                <p>Bono 21M → 600.000</p>
                <p>Bono 27M → 1.000.000</p>
                <p>Bono 32M → 1.500.000</p>
                <p>Bono 42M → 2.100.000</p>
                <p>Bono 52M → 3.000.000</p>
                <hr className="my-3 border-slate-200" />
                <p>Gerente comercial → 3.5% sobre caja neta</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Ventas incluidas en el cálculo</h2>
          <p className="mt-1 text-sm text-slate-500">
            Soporte rápido para revisar qué casos están entrando en la liquidación.
          </p>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Cargando ventas...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No hay ventas finalizadas para ese filtro.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Asesor</th>
                    <th className="px-3 py-3">Volumen</th>
                    <th className="px-3 py-3">Caja</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Comisión venta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((item) => {
                    const netBase = Number(item.net_commission_base || 0);
                    const rate = getCommercialRate(netBase);
                    const commission = Math.round(netBase * rate);
                    const advisor =
                      advisorProfiles.find((profile) => profile.id === item.assigned_commercial_user_id)?.full_name ||
                      "Sin asignar";

                    return (
                      <tr key={item.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{item.customer_name}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatDate(item.created_at)}</td>
                        <td className="px-3 py-3 text-slate-700">{advisor}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.volume_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.cash_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(netBase)}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {formatMoney(commission)} · {(rate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
