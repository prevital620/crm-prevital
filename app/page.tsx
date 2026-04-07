"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import { getCurrentUserRole } from "@/lib/auth";

type Lead = {
  id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  phone: string;
  city: string | null;
  status: string;
  created_at: string;
};

type Department = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  code: string;
};

type Profile = {
  id: string;
  full_name: string;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
};

type QuickAction = {
  title: string;
  subtitle: string;
  href: string;
  roles: string[];
};

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

const quickActions: QuickAction[] = [
  {
    title: "Nuevo lead",
    subtitle: "Registrar un lead nuevo.",
    href: "/leads/nuevo",
    roles: ["super_user", "promotor_opc", "supervisor_opc", "confirmador", "tmk"],
  },
  {
    title: "Consultar leads",
    subtitle: "Revisar leads creados y su estado.",
    href: "/leads",
    roles: [
      "super_user",
      "promotor_opc",
      "supervisor_opc",
      "supervisor_call_center",
      "confirmador",
      "tmk",
    ],
  },
  {
    title: "Crear usuario",
    subtitle: "Registrar usuario y asignar departamento y rol.",
    href: "/usuarios/nuevo",
    roles: ["super_user"],
  },
  {
    title: "Usuarios y roles",
    subtitle: "Consultar usuarios creados en el sistema.",
    href: "/usuarios",
    roles: ["super_user"],
  },
  {
    title: "Call Center",
    subtitle: "Asignar y gestionar leads del call center.",
    href: "/call-center",
    roles: ["super_user", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Configurar cupos",
    subtitle: "Abrir agenda y organizar cupos del día.",
    href: "/recepcion",
    roles: ["super_user", "supervisor_call_center"],
  },
  {
    title: "Recepción",
    subtitle: "Ver agenda, citas y admisión del sistema.",
    href: "/recepcion",
    roles: ["super_user", "recepcion"],
  },
  {
    title: "Comercial",
    subtitle: "Gestionar seguimiento y cierre comercial.",
    href: "/comercial",
    roles: ["super_user", "comercial", "gerencia_comercial"],
  },
  {
    title: "Gerencia comercial",
    subtitle: "Supervisar cartera, ventas y desempeño comercial.",
    href: "/gerencia/comercial",
    roles: ["super_user", "gerencia_comercial"],
  },
];

export default function HomePage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(true);

  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [currentRoleName, setCurrentRoleName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  async function checkSessionAndLoad() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const auth = await getCurrentUserRole();
    const normalizedRole = normalizeRoleCode(auth.roleCode);

    setCurrentRoleCode(normalizedRole);
    setCurrentRoleName(auth.roleName);
    setCurrentUserId(session.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();

    setCurrentUserName(profile?.full_name || "Usuario");

    setCheckingSession(false);
    loadDashboard(normalizedRole, session.user.id);
  }

  async function loadDashboard(roleCode?: string | null, userId?: string | null) {
    try {
      setLoading(true);
      setErrorMessage("");

      const effectiveRole = normalizeRoleCode(roleCode ?? currentRoleCode);
      const effectiveUserId = userId ?? currentUserId ?? null;

      let leadsQuery = supabase
        .from("leads")
        .select("id, full_name, first_name, last_name, phone, city, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (effectiveRole === "promotor_opc" && effectiveUserId) {
        leadsQuery = supabase
          .from("leads")
          .select("id, full_name, first_name, last_name, phone, city, status, created_at")
          .eq("created_by_user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(20);
      }

      if ((effectiveRole === "confirmador" || effectiveRole === "tmk") && effectiveUserId) {
        leadsQuery = supabase
          .from("leads")
          .select("id, full_name, first_name, last_name, phone, city, status, created_at")
          .or(`assigned_to_user_id.eq.${effectiveUserId},created_by_user_id.eq.${effectiveUserId}`)
          .order("created_at", { ascending: false })
          .limit(20);
      }

      const [leadsResult, departmentsResult, rolesResult, profilesResult] =
        await Promise.all([
          leadsQuery,
          supabase.from("departments").select("id, name").order("name", { ascending: true }),
          supabase.from("roles").select("id, name, code").order("name", { ascending: true }),
          supabase
            .from("profiles")
            .select("id, full_name, job_title, is_active, created_at")
            .order("created_at", { ascending: false }),
        ]);

      if (leadsResult.error) throw leadsResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setLeads((leadsResult.data as Lead[]) ?? []);
      setDepartments((departmentsResult.data as Department[]) ?? []);
      setRoles((rolesResult.data as Role[]) ?? []);
      setProfiles((profilesResult.data as Profile[]) ?? []);
    } catch (error: any) {
      setErrorMessage(error?.message || "Ocurrió un error cargando el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkSessionAndLoad();
  }, []);

  const visibleQuickActions = useMemo(() => {
    if (!currentRoleCode) return [];

    const base = quickActions.filter((action) => action.roles.includes(currentRoleCode));

    if (currentRoleCode === "promotor_opc") {
      return base.sort((a, b) => {
        const order: Record<string, number> = {
          "/leads/nuevo": 1,
          "/leads": 2,
        };
        return (order[a.href] ?? 99) - (order[b.href] ?? 99);
      });
    }

    return base;
  }, [currentRoleCode]);

  const isSuperUser = currentRoleCode === "super_user";

  const totalLeads = leads.length;
  const totalDepartments = departments.length;
  const totalRoles = roles.length;
  const totalUsers = profiles.length;

  const activeUsers = useMemo(() => {
    return profiles.filter((item) => item.is_active).length;
  }, [profiles]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Panel principal</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                CRM Prevital
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 md:text-base">
                Accesos y resumen según el rol autenticado.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
                <p className="text-sm font-semibold">{currentUserName || "Usuario"}</p>
                <p className="text-xs text-slate-200">{currentRoleName || "Rol"}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {isSuperUser ? (
          <>
            <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <DashboardCard title="Leads visibles" value={loading ? "..." : String(totalLeads)} subtitle="Según tu rol" />
              <DashboardCard title="Departamentos" value={loading ? "..." : String(totalDepartments)} subtitle="Estructura base" />
              <DashboardCard title="Roles" value={loading ? "..." : String(totalRoles)} subtitle="Roles configurados" />
              <DashboardCard title="Usuarios" value={loading ? "..." : String(totalUsers)} subtitle="Perfiles internos" />
              <DashboardCard title="Usuarios activos" value={loading ? "..." : String(activeUsers)} subtitle="Perfiles habilitados" />
            </section>

            <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm">
              <HeaderActions title="Accesos disponibles" subtitle="Solo ves los módulos permitidos para tu rol." onRefresh={() => loadDashboard(currentRoleCode, currentUserId)} />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleQuickActions.map((action) => (
                  <a key={action.title} href={action.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{action.subtitle}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">Abrir</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-2xl font-bold text-slate-900">Leads recientes</h2>
                    <p className="mt-1 text-sm text-slate-500">Vista rápida según tu rol.</p>
                  </div>

                  {loading ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Cargando leads...</div>
                  ) : leads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">No hay leads visibles para este usuario.</div>
                  ) : (
                    <div className="space-y-4">
                      {leads.slice(0, 6).map((lead) => (
                        <LeadCard key={lead.id} lead={lead} formatDate={formatDate} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <SimpleListCard title="Departamentos" subtitle="Resumen general." items={departments.map((x) => x.name)} loading={loading} emptyText="No hay departamentos registrados." />
                <SimpleListCard title="Roles" subtitle="Estructura configurada." items={roles.map((x) => `${x.name} · ${x.code}`)} loading={loading} emptyText="No hay roles registrados." />
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <HeaderActions title="Accesos disponibles" subtitle="Solo ves los módulos permitidos para tu rol." onRefresh={() => loadDashboard(currentRoleCode, currentUserId)} />

            {visibleQuickActions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No hay accesos configurados para este rol.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {visibleQuickActions.map((action) => (
                  <a key={action.title} href={action.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
                        <p className="mt-2 text-sm text-slate-600">{action.subtitle}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">Abrir</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function HeaderActions({
  title,
  subtitle,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <button
        onClick={onRefresh}
        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Actualizar
      </button>
    </div>
  );
}

function DashboardCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function LeadCard({
  lead,
  formatDate,
}: {
  lead: Lead;
  formatDate: (value: string | null | undefined) => string;
}) {
  const displayName =
    lead.full_name?.trim() ||
    `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
    "Sin nombre";

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{displayName}</h3>
          <p className="mt-1 text-sm text-slate-600">{lead.phone} · {lead.city || "Sin ciudad"}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(lead.created_at)}</p>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {lead.status || "Sin estado"}
        </span>
      </div>
    </div>
  );
}

function SimpleListCard({
  title,
  subtitle,
  items,
  loading,
  emptyText,
}: {
  title: string;
  subtitle: string;
  items: string[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-5 max-h-[320px] space-y-3 overflow-auto pr-1">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
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
