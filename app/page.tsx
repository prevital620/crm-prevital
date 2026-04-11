"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import { getCurrentUserRole } from "@/lib/auth";
import { PrevitalBadge } from "@/components/ui/prevital-badge";
import {
  PrevitalButton,
} from "@/components/ui/prevital-button";
import {
  PrevitalCard,
  PrevitalCardContent,
  PrevitalCardHeader,
} from "@/components/ui/prevital-card";
import { PrevitalPageHeader } from "@/components/layout/prevital-page-header";
import {
  PrevitalFilterBar,
  PrevitalFilterGroup,
} from "@/components/layout/prevital-filter-bar";
import {
  Activity,
  Building2,
  LayoutGrid,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";

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
    title: "Nutrición",
    subtitle: "Ver agenda, pacientes y valoración nutricional.",
    href: "/nutricion",
    roles: ["super_user", "nutricionista"],
  },
  {
    title: "Fisioterapia",
    subtitle: "Ver agenda, pacientes y atención de fisioterapia.",
    href: "/fisioterapia",
    roles: ["super_user", "fisioterapeuta"],
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
  const [allRoleCodes, setAllRoleCodes] = useState<string[]>([]);
  const [allRoleNames, setAllRoleNames] = useState<string[]>([]);
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
    setAllRoleCodes(auth.allRoleCodes || []);
    setAllRoleNames(auth.allRoleNames || []);
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
    const effectiveRoles = Array.from(
      new Set([...(allRoleCodes || []), ...(currentRoleCode ? [currentRoleCode] : [])].filter(Boolean))
    );

    if (effectiveRoles.length === 0) return [];

    const base = quickActions.filter((action) =>
      action.roles.some((role) => effectiveRoles.includes(role))
    );

    if (effectiveRoles.includes("promotor_opc")) {
      return base.sort((a, b) => {
        const order: Record<string, number> = {
          "/leads/nuevo": 1,
          "/leads": 2,
        };
        return (order[a.href] ?? 99) - (order[b.href] ?? 99);
      });
    }

    return base;
  }, [allRoleCodes, currentRoleCode]);

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
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <PrevitalCard>
            <PrevitalCardContent className="p-8">
              <p className="text-sm text-slate-500">Validando sesión...</p>
            </PrevitalCardContent>
          </PrevitalCard>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.05] md:h-[520px] md:w-[520px]">
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
        <PrevitalPageHeader
          title="CRM Prevital"
          subtitle="Accesos y resumen según el rol autenticado."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#EAF4EC] px-5 py-3 text-[#4F6F5B]">
                <p className="text-sm font-semibold">{currentUserName || "Usuario"}</p>
                <p className="text-xs text-[#5E8F6C]">
                  {allRoleNames.length > 0 ? allRoleNames.join(" · ") : currentRoleName || "Rol"}
                </p>
              </div>
              <LogoutButton />
            </div>
          }
        />

        <PrevitalFilterBar>
          <PrevitalFilterGroup>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm text-slate-600">
              <LayoutGrid className="h-4 w-4 text-[#5E8F6C]" />
              <span>Panel principal</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-[#5E8F6C]" />
              <span>{allRoleNames.length > 0 ? allRoleNames.join(" · ") : currentRoleName || "Rol"}</span>
            </div>
          </PrevitalFilterGroup>

          <PrevitalButton
            variant="secondary"
            leftIcon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => loadDashboard(currentRoleCode, currentUserId)}
          >
            Actualizar panel
          </PrevitalButton>
        </PrevitalFilterBar>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {isSuperUser ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <StatCard
                title="D"
                value={loading ? "..." : String(totalLeads)}
                subtitle="Según tu rol"
                icon={<Activity className="h-5 w-5" />}
              />
              <StatCard
                title="Departamentos"
                value={loading ? "..." : String(totalDepartments)}
                subtitle="Estructura base"
                icon={<Building2 className="h-5 w-5" />}
              />
              <StatCard
                title="Roles"
                value={loading ? "..." : String(totalRoles)}
                subtitle="Roles configurados"
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <StatCard
                title="Usuarios"
                value={loading ? "..." : String(totalUsers)}
                subtitle="Perfiles internos"
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                title="Usuarios activos"
                value={loading ? "..." : String(activeUsers)}
                subtitle="Perfiles habilitados"
                icon={<Users className="h-5 w-5" />}
              />
            </section>

            <PrevitalCard>
              <PrevitalCardHeader
                title="Accesos disponibles"
                description="Solo ves los módulos permitidos para tu rol."
                action={
                  <PrevitalButton
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCcw className="h-4 w-4" />}
                    onClick={() => loadDashboard(currentRoleCode, currentUserId)}
                  >
                    Actualizar
                  </PrevitalButton>
                }
              />
              <PrevitalCardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleQuickActions.map((action) => (
                    <a
                      key={action.title}
                      href={action.href}
                      className="group rounded-3xl border border-[#D6E8DA] bg-[#F8F7F4] p-5 transition hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800">{action.title}</h3>
                          <p className="mt-2 text-sm text-slate-500">{action.subtitle}</p>
                        </div>
                        <span className="rounded-full border border-[#D6E8DA] bg-white px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                          Abrir
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </PrevitalCardContent>
            </PrevitalCard>

            <section className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <PrevitalCard>
                  <PrevitalCardHeader
                    title="Leads recientes"
                    description="Vista rápida según tu rol."
                  />
                  <PrevitalCardContent>
                    {loading ? (
                      <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                        Cargando leads...
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                        No hay leads visibles para este usuario.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leads.slice(0, 6).map((lead) => (
                          <LeadCard key={lead.id} lead={lead} formatDate={formatDate} />
                        ))}
                      </div>
                    )}
                  </PrevitalCardContent>
                </PrevitalCard>
              </div>

              <div className="space-y-6">
                <SimpleListCard
                  title="Departamentos"
                  subtitle="Resumen general."
                  items={departments.map((x) => x.name)}
                  loading={loading}
                  emptyText="No hay departamentos registrados."
                />
                <SimpleListCard
                  title="Roles"
                  subtitle="Estructura configurada."
                  items={roles.map((x) => `${x.name} · ${x.code}`)}
                  loading={loading}
                  emptyText="No hay roles registrados."
                />
              </div>
            </section>
          </>
        ) : (
          <PrevitalCard>
            <PrevitalCardHeader
              title="Accesos disponibles"
              description="Solo ves los módulos permitidos para tu rol."
              action={
                <PrevitalButton
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() => loadDashboard(currentRoleCode, currentUserId)}
                >
                  Actualizar
                </PrevitalButton>
              }
            />
            <PrevitalCardContent>
              {visibleQuickActions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-6 text-sm text-slate-500">
                  No hay accesos configurados para este rol.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                  {visibleQuickActions.map((action) => (
                    <a
                      key={action.title}
                      href={action.href}
                      className="group relative overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#BCD7C2] hover:shadow-md"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

                      <div className="flex items-start justify-between gap-4">
                        <div className="pr-2">
                          <h3 className="text-lg font-semibold text-[#24312A] transition group-hover:text-[#4F6F5B]">
                            {action.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {action.subtitle}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B] transition group-hover:bg-white">
                          Abrir
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </PrevitalCardContent>
          </PrevitalCard>
        )}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <PrevitalCard className="group overflow-hidden border border-[#D6E8DA] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="h-1 w-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <PrevitalCardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5E8F6C] transition group-hover:bg-white">
            {icon}
          </div>
        </div>
      </PrevitalCardContent>
    </PrevitalCard>
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
    <div className="group rounded-3xl border border-[#D6E8DA] bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[#24312A] transition group-hover:text-[#4F6F5B]">
            {displayName}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {lead.phone} · {lead.city || "Sin ciudad"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(lead.created_at)}
          </p>
        </div>

        <span className="inline-flex w-fit rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
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
    <PrevitalCard>
      <PrevitalCardHeader title={title} description={subtitle} />
      <PrevitalCardContent>
        <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">{emptyText}</p>
          ) : (
            items.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-[#F8F7F4] px-4 py-3 text-sm font-medium text-slate-700"
              >
                {item}
              </div>
            ))
          )}
        </div>
      </PrevitalCardContent>
    </PrevitalCard>
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
