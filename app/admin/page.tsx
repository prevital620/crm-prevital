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
  status: string;
  created_at: string;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  net_commission_base: number | null;
  gross_bonus_base: number | null;
  sale_origin_type: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  is_credit_payment: boolean | null;
  credit_discount_amount: number | null;
  admin_discount_amount: number | null;
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

function sourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function leadSourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    redes_sociales: "Redes sociales",
    referido: "Referido",
    evento: "Evento",
    punto_fisico: "Punto físico",
    otro: "Otro",
  };
  if (!value) return "Sin definir";
  return map[value] || value;
}

function saleOriginLabel(value: string | null | undefined) {
  if (value === "directo") return "Directo";
  if (value === "lead") return "Lead";
  return "Sin definir";
}

function statusLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente asignación",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atención",
    seguimiento_comercial: "Seguimiento",
    seguimiento: "Seguimiento",
    finalizado: "Finalizado",
  };
  if (!value) return "Sin estado";
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
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [search, setSearch] = useState("");

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
      setMensaje("");

      const { data, error } = await supabase
        .from("commercial_cases")
        .select(`
          id,
          customer_name,
          phone,
          city,
          status,
          created_at,
          volume_amount,
          cash_amount,
          portfolio_amount,
          net_commission_base,
          gross_bonus_base,
          sale_origin_type,
          lead_source_type,
          commission_source_type,
          is_credit_payment,
          credit_discount_amount,
          admin_discount_amount
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCases((data as AdminCommercialCase[]) || []);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de admin.");
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

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return cases.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesSearch = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          (item.phone || "").toLowerCase().includes(q) ||
          (item.city || "").toLowerCase().includes(q)
        : true;

      return matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }, [cases, dateFrom, dateTo, search]);

  const resumen = useMemo(() => {
    const totalVolumen = filteredCases.reduce(
      (acc, item) => acc + Number(item.volume_amount || 0),
      0
    );
    const totalCaja = filteredCases.reduce(
      (acc, item) => acc + Number(item.cash_amount || 0),
      0
    );
    const totalCartera = filteredCases.reduce(
      (acc, item) => acc + Number(item.portfolio_amount || 0),
      0
    );
    const totalBaseNeta = filteredCases.reduce(
      (acc, item) => acc + Number(item.net_commission_base || 0),
      0
    );
    const totalDescuentoCredito = filteredCases.reduce(
      (acc, item) => acc + Number(item.credit_discount_amount || 0),
      0
    );
    const totalDescuentoAdmin = filteredCases.reduce(
      (acc, item) => acc + Number(item.admin_discount_amount || 0),
      0
    );
    const ventasCerradas = filteredCases.filter((item) => item.status === "finalizado").length;
    const ingresosComerciales = filteredCases.length;

    return {
      totalVolumen,
      totalCaja,
      totalCartera,
      totalBaseNeta,
      totalDescuentoCredito,
      totalDescuentoAdmin,
      ventasCerradas,
      ingresosComerciales,
    };
  }, [filteredCases]);

  const resumenPorFuente = useMemo(() => {
    const base = [
      { key: "opc", label: "OPC" },
      { key: "redes", label: "Redes" },
      { key: "base", label: "Base" },
      { key: "otro", label: "Otro" },
    ];

    return base.map((group) => {
      const items = filteredCases.filter(
        (item) => (item.commission_source_type || "otro") === group.key
      );

      return {
        ...group,
        cantidad: items.length,
        volumen: items.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
        caja: items.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
        cartera: items.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
      };
    });
  }, [filteredCases]);

  const resumenPorEstado = useMemo(() => {
    const estados = [
      "pendiente_asignacion_comercial",
      "asignado_comercial",
      "en_atencion_comercial",
      "seguimiento_comercial",
      "finalizado",
    ];

    return estados.map((estado) => ({
      estado,
      cantidad: filteredCases.filter((item) => item.status === estado).length,
    }));
  }, [filteredCases]);

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
                Vista general de volumen, caja, cartera y base neta comisionable para validar el negocio antes de liquidar comisiones.
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
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>
        ) : null}

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
              <label className="mb-2 block text-sm font-medium text-slate-700">Buscar</label>
              <input
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                placeholder="Cliente, teléfono o ciudad"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-3">
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
                }}
                className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Este mes
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Volumen" value={formatMoney(resumen.totalVolumen)} subtitle="Suma del rango" />
          <StatCard title="Caja" value={formatMoney(resumen.totalCaja)} subtitle="Pagado en el rango" />
          <StatCard title="Cartera" value={formatMoney(resumen.totalCartera)} subtitle="Pendiente por cobrar" />
          <StatCard title="Base neta" value={formatMoney(resumen.totalBaseNeta)} subtitle="Base comisionable" />
          <StatCard title="Desc. crédito" value={formatMoney(resumen.totalDescuentoCredito)} subtitle="10% crédito" />
          <StatCard title="Desc. admin" value={formatMoney(resumen.totalDescuentoAdmin)} subtitle="Gasto administrativo" />
          <StatCard title="Ingresos comerciales" value={String(resumen.ingresosComerciales)} subtitle="Casos en el rango" />
          <StatCard title="Ventas cerradas" value={String(resumen.ventasCerradas)} subtitle="Estado finalizado" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Ventas del rango</h2>
            <p className="mt-1 text-sm text-slate-500">
              Lista rápida para validar trazabilidad, origen y montos.
            </p>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando ventas...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay casos para ese rango.
              </div>
            ) : (
              <div className="mt-5 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3">Volumen</th>
                      <th className="px-3 py-3">Caja</th>
                      <th className="px-3 py-3">Cartera</th>
                      <th className="px-3 py-3">Fuente comisión</th>
                      <th className="px-3 py-3">Origen lead</th>
                      <th className="px-3 py-3">Venta</th>
                      <th className="px-3 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{item.customer_name}</div>
                          <div className="text-slate-500">{item.phone || "Sin teléfono"}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatDateTime(item.created_at)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.volume_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.cash_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.portfolio_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{sourceLabel(item.commission_source_type)}</td>
                        <td className="px-3 py-3 text-slate-700">{leadSourceLabel(item.lead_source_type)}</td>
                        <td className="px-3 py-3 text-slate-700">{saleOriginLabel(item.sale_origin_type)}</td>
                        <td className="px-3 py-3 text-slate-700">{statusLabel(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Resumen por fuente</h2>
              <p className="mt-1 text-sm text-slate-500">
                Así puedes ver de dónde viene el negocio para comisión.
              </p>

              <div className="mt-5 space-y-3">
                {resumenPorFuente.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold text-slate-900">{item.label}</p>
                      <span className="rounded-full border border-[#D6E8DA] bg-[#F8F7F4] px-3 py-1 text-xs text-slate-700">
                        {item.cantidad} casos
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <p>Volumen: {formatMoney(item.volumen)}</p>
                      <p>Caja: {formatMoney(item.caja)}</p>
                      <p>Cartera: {formatMoney(item.cartera)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Resumen por estado</h2>
              <p className="mt-1 text-sm text-slate-500">
                Control rápido del avance comercial.
              </p>

              <div className="mt-5 space-y-3">
                {resumenPorEstado.map((item) => (
                  <div key={item.estado} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-700">{statusLabel(item.estado)}</p>
                    <span className="text-lg font-bold text-slate-900">{item.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
