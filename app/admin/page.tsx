"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
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
        setError("No tienes permiso para entrar a Admin.");
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
            assigned_commercial_user_id
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name")
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
    const map = new Map<string, string>();
    profiles.forEach((item) => map.set(item.id, item.full_name || "Sin nombre"));
    return map;
  }, [profiles]);

  const ventasReales = useMemo(() => {
    return cases.filter((item) => {
      const volume = Number(item.volume_amount || 0);
      const cash = Number(item.cash_amount || 0);
      const portfolio = Number(item.portfolio_amount || 0);
      return volume > 0 || cash > 0 || portfolio > 0;
    });
  }, [cases]);

  const ventasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();

    return ventasReales.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesSearch = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q)
        : true;
      const matchesCollaborator = collaboratorFilter
        ? (item.assigned_commercial_user_id || "") === collaboratorFilter
        : true;

      return matchesDateFrom && matchesDateTo && matchesSearch && matchesCollaborator;
    });
  }, [ventasReales, dateFrom, dateTo, search, collaboratorFilter]);

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
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Resumen administrativo</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Vista simple enfocada solo en ventas reales, cartera, caja y base neta.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Inicio
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Actualizar
            </button>

            <a
              href="/admin/comisiones"
              className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
            >
              Ver comisiones
            </a>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Ventas del día" value={String(ventasHoy.total)} subtitle="Ventas reales hoy" />
          <StatCard title="Volumen del día" value={formatMoney(ventasHoy.volumen)} subtitle="Ventas reales hoy" />
          <StatCard title="Caja del día" value={formatMoney(ventasHoy.caja)} subtitle="Pagado hoy" />
          <StatCard title="Cartera del día" value={formatMoney(ventasHoy.cartera)} subtitle="Pendiente hoy" />
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Buscar</label>
              <input
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                placeholder="Cliente, teléfono o ciudad"
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
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFrom(inicioMesISO());
                setDateTo(hoyISO());
                setSearch("");
                setCollaboratorFilter("");
              }}
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
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

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Ventas reales del rango</h2>
              <p className="mt-1 text-sm text-slate-500">
                Solo aparecen registros con volumen, caja o cartera mayor a cero.
              </p>
            </div>

            <a
              href="/admin/comisiones"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Ir a comisiones
            </a>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Cargando ventas...
            </div>
          ) : ventasFiltradas.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No hay ventas reales para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Colaborador</th>
                    <th className="px-3 py-3">Volumen</th>
                    <th className="px-3 py-3">Caja</th>
                    <th className="px-3 py-3">Cartera</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.customer_name}</div>
                        <div className="text-slate-500">{item.phone || "Sin teléfono"}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTime(item.created_at)}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.assigned_commercial_user_id
                          ? profileMap.get(item.assigned_commercial_user_id) || "Sin nombre"
                          : "Sin asignar"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.volume_amount || 0))}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.cash_amount || 0))}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.portfolio_amount || 0))}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.net_commission_base || 0))}</td>
                      <td className="px-3 py-3 text-slate-700">{paymentMethodLabel(item.payment_method)}</td>
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
