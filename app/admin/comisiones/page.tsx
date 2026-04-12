"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

type AdminCommercialCase = {
  id: string;
  customer_name: string;
  created_at: string;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  net_commission_base: number | null;
  assigned_commercial_user_id: string | null;
};

type Profile = {
  id: string;
  full_name: string;
};

type ProfileRole = {
  profile_id: string;
  role_id: string;
};

type Role = {
  id: string;
  name: string;
  code: string;
};

type CollaboratorRow = {
  id: string;
  full_name: string;
  roleCodes: string[];
  roleLabels: string[];
  ventas: number;
  volumen: number;
  caja: number;
  cartera: number;
  baseNeta: number;
};

const allowedRoles = [
  "super_user",
  "gerente",
  "gerente_comercial",
  "gerencia_comercial",
  "administrador",
];

const roleGroupOptions = [
  { value: "promotor_opc", label: "OPC" },
  { value: "confirmador", label: "Call center" },
  { value: "tmk", label: "TMK" },
  { value: "supervisor_opc", label: "Supervisor OPC" },
  { value: "supervisor_call_center", label: "Supervisor call" },
  { value: "comercial", label: "Comercial" },
  { value: "gerencia_comercial", label: "Gerencia comercial" },
  { value: "administrador", label: "Administrador" },
];

function normalizeRoleCode(roleCode?: string | null) {
  if (!roleCode) return null;

  if (
    roleCode === "gerente" ||
    roleCode === "gerente_comercial" ||
    roleCode === "gerencia_comercial"
  ) {
    return "gerencia_comercial";
  }

  return roleCode;
}

function hasAdminAccess(roleCode?: string | null, allRoleCodes?: string[]) {
  const roles = Array.from(
    new Set(
      [roleCode, ...(allRoleCodes || [])]
        .map((item) => normalizeRoleCode(item))
        .filter(Boolean),
    ),
  ) as string[];

  return roles.some((role) => allowedRoles.includes(role));
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
  const [error, setError] = useState("");

  const [cases, setCases] = useState<AdminCommercialCase[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [search, setSearch] = useState("");
  const [roleGroupFilter, setRoleGroupFilter] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState("");

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      if (!hasAdminAccess(auth.roleCode, auth.allRoleCodes || [])) {
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

      const [casesResult, profilesResult, profileRolesResult, rolesResult] = await Promise.all([
        supabase
          .from("commercial_cases")
          .select(
            `
            id,
            customer_name,
            created_at,
            volume_amount,
            cash_amount,
            portfolio_amount,
            net_commission_base,
            assigned_commercial_user_id
          `,
          )
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }),
        supabase.from("profile_roles").select("profile_id, role_id"),
        supabase.from("roles").select("id, name, code").order("name", { ascending: true }),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (profileRolesResult.error) throw profileRolesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      setCases((casesResult.data as AdminCommercialCase[]) || []);
      setProfiles((profilesResult.data as Profile[]) || []);
      setProfileRoles((profileRolesResult.data as ProfileRole[]) || []);
      setRoles((rolesResult.data as Role[]) || []);
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

  const roleMap = useMemo(() => {
    const map = new Map<string, Role>();
    roles.forEach((role) => map.set(role.id, role));
    return map;
  }, [roles]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((profile) => map.set(profile.id, profile));
    return map;
  }, [profiles]);

  const rolesByProfile = useMemo(() => {
    const map = new Map<string, { codes: string[]; labels: string[] }>();

    profileRoles.forEach((item) => {
      const role = roleMap.get(item.role_id);
      if (!role) return;

      const normalizedCode = normalizeRoleCode(role.code) || role.code;
      const current = map.get(item.profile_id) || { codes: [], labels: [] };

      if (!current.codes.includes(normalizedCode)) {
        current.codes.push(normalizedCode);
      }

      if (!current.labels.includes(role.name)) {
        current.labels.push(role.name);
      }

      map.set(item.profile_id, current);
    });

    return map;
  }, [profileRoles, roleMap]);

  const ventasReales = useMemo(() => {
    return cases.filter((item) => {
      const volume = Number(item.volume_amount || 0);
      const cash = Number(item.cash_amount || 0);
      const portfolio = Number(item.portfolio_amount || 0);
      return volume > 0 || cash > 0 || portfolio > 0;
    });
  }, [cases]);

  const collaboratorRows = useMemo<CollaboratorRow[]>(() => {
    const map = new Map<string, CollaboratorRow>();

    ventasReales.forEach((item) => {
      const profileId = item.assigned_commercial_user_id || "sin_asignar";
      const profile = profileMap.get(profileId);
      const roleData = rolesByProfile.get(profileId) || { codes: [], labels: [] };
      const current = map.get(profileId) || {
        id: profileId,
        full_name: profile?.full_name || (profileId === "sin_asignar" ? "Sin asignar" : "Sin nombre"),
        roleCodes: roleData.codes,
        roleLabels: roleData.labels,
        ventas: 0,
        volumen: 0,
        caja: 0,
        cartera: 0,
        baseNeta: 0,
      };

      current.ventas += 1;
      current.volumen += Number(item.volume_amount || 0);
      current.caja += Number(item.cash_amount || 0);
      current.cartera += Number(item.portfolio_amount || 0);
      current.baseNeta += Number(item.net_commission_base || 0);

      map.set(profileId, current);
    });

    return Array.from(map.values()).sort((a, b) => b.baseNeta - a.baseNeta);
  }, [ventasReales, profileMap, rolesByProfile]);

  const collaboratorOptions = useMemo(() => {
    return collaboratorRows
      .filter((item) => item.id !== "sin_asignar")
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  }, [collaboratorRows]);

  const ventasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();

    return ventasReales.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const collaboratorId = item.assigned_commercial_user_id || "sin_asignar";
      const roleData = rolesByProfile.get(collaboratorId) || { codes: [], labels: [] };
      const collaboratorName = profileMap.get(collaboratorId)?.full_name || "Sin asignar";

      const matchesSearch = q
        ? (item.customer_name || "").toLowerCase().includes(q) ||
          collaboratorName.toLowerCase().includes(q)
        : true;

      const matchesCollaborator = collaboratorFilter
        ? collaboratorId === collaboratorFilter
        : true;

      const matchesRoleGroup = roleGroupFilter
        ? roleData.codes.includes(roleGroupFilter)
        : true;

      return matchesDateFrom && matchesDateTo && matchesSearch && matchesCollaborator && matchesRoleGroup;
    });
  }, [ventasReales, dateFrom, dateTo, search, collaboratorFilter, roleGroupFilter, rolesByProfile, profileMap]);

  const resumen = useMemo(() => {
    return {
      ventas: ventasFiltradas.length,
      volumen: ventasFiltradas.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
      caja: ventasFiltradas.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
      cartera: ventasFiltradas.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
      baseNeta: ventasFiltradas.reduce((acc, item) => acc + Number(item.net_commission_base || 0), 0),
    };
  }, [ventasFiltradas]);

  const resumenPorColaborador = useMemo(() => {
    const map = new Map<string, CollaboratorRow>();

    ventasFiltradas.forEach((item) => {
      const profileId = item.assigned_commercial_user_id || "sin_asignar";
      const profile = profileMap.get(profileId);
      const roleData = rolesByProfile.get(profileId) || { codes: [], labels: [] };
      const current = map.get(profileId) || {
        id: profileId,
        full_name: profile?.full_name || (profileId === "sin_asignar" ? "Sin asignar" : "Sin nombre"),
        roleCodes: roleData.codes,
        roleLabels: roleData.labels,
        ventas: 0,
        volumen: 0,
        caja: 0,
        cartera: 0,
        baseNeta: 0,
      };

      current.ventas += 1;
      current.volumen += Number(item.volume_amount || 0);
      current.caja += Number(item.cash_amount || 0);
      current.cartera += Number(item.portfolio_amount || 0);
      current.baseNeta += Number(item.net_commission_base || 0);

      map.set(profileId, current);
    });

    return Array.from(map.values()).sort((a, b) => b.baseNeta - a.baseNeta);
  }, [ventasFiltradas, profileMap, rolesByProfile]);

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
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Comisiones</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Vista administrativa separada para revisar base neta, ventas y resumen por colaborador.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Volver a admin
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              <label className="mb-2 block text-sm font-medium text-slate-700">Área o rol</label>
              <select
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                value={roleGroupFilter}
                onChange={(e) => setRoleGroupFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {roleGroupOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Colaborador</label>
              <select
                className="w-full rounded-2xl border border-[#D6E8DA] px-4 py-3 outline-none transition focus:border-[#7FA287]"
                value={collaboratorFilter}
                onChange={(e) => setCollaboratorFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {collaboratorOptions.map((item) => (
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
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFrom(inicioMesISO());
                setDateTo(hoyISO());
                setRoleGroupFilter("");
                setCollaboratorFilter("");
                setSearch("");
              }}
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Ventas" value={String(resumen.ventas)} subtitle="Ventas reales filtradas" />
          <StatCard title="Volumen" value={formatMoney(resumen.volumen)} subtitle="Suma filtrada" />
          <StatCard title="Caja" value={formatMoney(resumen.caja)} subtitle="Pago recibido" />
          <StatCard title="Cartera" value={formatMoney(resumen.cartera)} subtitle="Saldo pendiente" />
          <StatCard title="Base neta" value={formatMoney(resumen.baseNeta)} subtitle="Base comisionable" />
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Resumen por colaborador</h2>
            <p className="mt-1 text-sm text-slate-500">
              Aquí puedes filtrar por OPC, call center, supervisores, comerciales y gerencia comercial.
            </p>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Cargando resumen...
            </div>
          ) : resumenPorColaborador.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No hay resultados para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3">Colaborador</th>
                    <th className="px-3 py-3">Roles</th>
                    <th className="px-3 py-3">Ventas</th>
                    <th className="px-3 py-3">Volumen</th>
                    <th className="px-3 py-3">Caja</th>
                    <th className="px-3 py-3">Cartera</th>
                    <th className="px-3 py-3">Base neta</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorColaborador.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.full_name}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.roleLabels.length > 0 ? item.roleLabels.join(" · ") : "Sin rol visible"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{item.ventas}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.volumen)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.caja)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.cartera)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.baseNeta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Detalle de ventas para comisiones</h2>
            <p className="mt-1 text-sm text-slate-500">
              Base operativa para revisar qué registros están alimentando las comisiones.
            </p>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              Cargando detalle...
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
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.map((item) => {
                    const collaboratorId = item.assigned_commercial_user_id || "sin_asignar";
                    const collaboratorName = profileMap.get(collaboratorId)?.full_name || "Sin asignar";

                    return (
                      <tr key={item.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3 font-medium text-slate-900">{item.customer_name}</td>
                        <td className="px-3 py-3 text-slate-700">{formatDateTime(item.created_at)}</td>
                        <td className="px-3 py-3 text-slate-700">{collaboratorName}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.volume_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.cash_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.portfolio_amount || 0))}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(Number(item.net_commission_base || 0))}</td>
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
