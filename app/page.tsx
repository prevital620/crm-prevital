"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LogoutButton from "@/components/logout-button";
import { getCurrentUserRole, normalizeRoleCode } from "@/lib/auth";
import { repairMojibake } from "@/lib/text/repairMojibake";
import { PrevitalButton } from "@/components/ui/prevital-button";
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
import { Activity, LayoutGrid, RefreshCcw, ShieldCheck, Users } from "lucide-react";

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

type QuickActionSection = {
  title: string;
  description: string;
  items: QuickAction[];
};

const quickActions: QuickAction[] = [
  {
    title: "Nuevo lead",
    subtitle: "Registrar un lead nuevo.",
    href: "/leads/nuevo",
    roles: ["super_user", "promotor_opc", "supervisor_opc", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Consultar leads",
    subtitle: "Revisar leads creados y su estado.",
    href: "/leads",
    roles: ["super_user", "promotor_opc", "supervisor_opc", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Importar leads",
    subtitle: "Subir plantilla CSV de redes con repetidos ignorados.",
    href: "/leads/importar",
    roles: ["super_user", "supervisor_call_center", "confirmador", "tmk"],
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
    title: "Carga historica",
    subtitle: "Registrar casos anteriores con fechas reales.",
    href: "/carga-historica",
    roles: ["super_user"],
  },
  {
    title: "Gestion de leads",
    subtitle: "Asignar y gestionar leads del call center.",
    href: "/call-center",
    roles: ["super_user", "supervisor_call_center", "confirmador"],
  },
  {
    title: "Ver agenda",
    subtitle: "Consultar agenda visible y gestionar citas.",
    href: "/recepcion?view=agenda",
    roles: ["super_user", "supervisor_call_center", "confirmador", "tmk"],
  },
  {
    title: "Configurar cupos",
    subtitle: "Abrir agenda y organizar cupos del dia.",
    href: "/recepcion?view=config",
    roles: ["super_user", "supervisor_call_center"],
  },
  {
    title: "Recepcion",
    subtitle: "Incluye agenda, citas, admision y configuracion de cupos.",
    href: "/recepcion",
    roles: ["super_user", "recepcion"],
  },
  {
    title: "Nutricion",
    subtitle: "Ver agenda, pacientes y valoracion nutricional.",
    href: "/nutricion",
    roles: ["super_user", "nutricionista"],
  },
  {
    title: "Fisioterapia",
    subtitle: "Ver agenda, pacientes y atencion de fisioterapia.",
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
    title: "Retractos y renegociaciones",
    subtitle: "Preparar ajustes de ventas con impacto financiero y comisional.",
    href: "/comercial/ajustes",
    roles: ["super_user", "gerente", "gerente_comercial", "gerencia_comercial"],
  },
  {
    title: "Gerencia comercial",
    subtitle: "Supervisar cartera, ventas y desempeno comercial.",
    href: "/gerencia/comercial",
    roles: ["super_user", "gerencia_comercial"],
  },
  {
    title: "Admin",
    subtitle: "Ver resumen administrativo, ventas, cartera y base comisionable.",
    href: "/admin",
    roles: ["super_user", "administrador"],
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

  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  async function checkSessionAndLoad() {
    try {
      setCheckingSession(true);
      setErrorMessage("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        router.push("/login");
        return;
      }

      let auth: any = null;

      try {
        auth = await getCurrentUserRole();
      } catch (error: any) {
        setCurrentUserId(session.user.id);

        const { data: profileFallback } = await supabase
          .from("profiles")
          .select("full_name, job_title")
          .eq("id", session.user.id)
          .maybeSingle();

        const fallbackRole = normalizeRoleCode(profileFallback?.job_title || null);

        setCurrentRoleCode(fallbackRole);
        setCurrentRoleName(profileFallback?.job_title || "Usuario");
        setAllRoleCodes(fallbackRole ? [fallbackRole] : []);
        setAllRoleNames(profileFallback?.job_title ? [profileFallback.job_title] : ["Usuario"]);
        setCurrentUserName(profileFallback?.full_name || "Usuario");

        if (fallbackRole === "administrador") {
          router.push("/admin");
          return;
        }

        setCheckingSession(false);
        setLoading(false);
        setErrorMessage(error?.message || "No se pudieron cargar los roles del usuario.");
        return;
      }

      const normalizedRole = normalizeRoleCode(auth?.roleCode);
      const normalizedAllRoles = Array.from(
        new Set(
          (auth?.allRoleCodes || [])
            .map((role: string) => normalizeRoleCode(role))
            .filter(Boolean)
        )
      ) as string[];

      setCurrentRoleCode(normalizedRole);
      setCurrentRoleName(auth?.roleName || null);
      setAllRoleCodes(normalizedAllRoles);
      setAllRoleNames(auth?.allRoleNames || []);
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setCurrentUserName(profile?.full_name || "Usuario");

      const singleReceptionAccess = normalizedRole === "recepcion" && normalizedAllRoles.length === 1;
      const singleCommercialAccess = normalizedRole === "comercial" && normalizedAllRoles.length === 1;
      const singleAdminAccess = normalizedRole === "administrador" && normalizedAllRoles.length === 1;

      if (singleReceptionAccess) {
        router.push("/recepcion");
        return;
      }

      if (singleCommercialAccess) {
        router.push("/comercial");
        return;
      }

      if (singleAdminAccess) {
        router.push("/admin");
        return;
      }

      setCheckingSession(false);
      await loadDashboard(normalizedRole, session.user.id);
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo validar la sesion.");
      setCheckingSession(false);
      setLoading(false);
    }
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

      let leadsCountQuery = supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      if (effectiveRole === "promotor_opc" && effectiveUserId) {
        leadsQuery = supabase
          .from("leads")
          .select("id, full_name, first_name, last_name, phone, city, status, created_at")
          .eq("created_by_user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(20);

        leadsCountQuery = supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("created_by_user_id", effectiveUserId);
      }

      if (
        (effectiveRole === "confirmador" ||
          effectiveRole === "tmk" ||
          effectiveRole === "supervisor_call_center") &&
        effectiveUserId
      ) {
        leadsQuery = supabase
          .from("leads")
          .select("id, full_name, first_name, last_name, phone, city, status, created_at")
          .or(`assigned_to_user_id.eq.${effectiveUserId},created_by_user_id.eq.${effectiveUserId}`)
          .order("created_at", { ascending: false })
          .limit(20);

        leadsCountQuery = supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .or(`assigned_to_user_id.eq.${effectiveUserId},created_by_user_id.eq.${effectiveUserId}`);
      }

      const [leadsResult, leadsCountResult, profilesResult] = await Promise.all([
        leadsQuery,
        leadsCountQuery,
        supabase
          .from("profiles")
          .select("id, full_name, job_title, is_active, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (leadsResult.error) throw leadsResult.error;
      if (leadsCountResult.error) throw leadsCountResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setTotalLeadCount(leadsCountResult.count ?? 0);
      setLeads((leadsResult.data as Lead[]) ?? []);
      setProfiles((profilesResult.data as Profile[]) ?? []);
    } catch (error: any) {
      setErrorMessage(error?.message || "Ocurrio un error cargando el panel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkSessionAndLoad();
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

    if (effectiveRoles.includes("super_user")) {
      return base.filter(
        (action) => !["/recepcion?view=agenda", "/recepcion?view=config"].includes(action.href)
      );
    }

    return base;
  }, [allRoleCodes, currentRoleCode]);

  const isSuperUser = currentRoleCode === "super_user";
  const totalLeads = totalLeadCount || leads.length;
  const totalUsers = profiles.length;

  const activeUsers = useMemo(() => {
    return profiles.filter((item) => item.is_active).length;
  }, [profiles]);

  const superUserSections = useMemo<QuickActionSection[]>(() => {
    if (!isSuperUser) return [];

    const sectionMap: Array<{ title: string; description: string; hrefs: string[] }> = [
      {
        title: "Captacion y seguimiento",
        description: "Leads, call center y gestion comercial.",
        hrefs: [
          "/leads/nuevo",
          "/leads",
          "/leads/importar",
          "/call-center",
          "/comercial",
          "/comercial/ajustes",
          "/gerencia/comercial",
        ],
      },
      {
        title: "Operacion y atencion",
        description: "Recepcion y modulos clinicos del dia a dia.",
        hrefs: ["/recepcion", "/nutricion", "/fisioterapia"],
      },
      {
        title: "Administracion",
        description: "Usuarios, historicos y control global del CRM.",
        hrefs: ["/usuarios/nuevo", "/usuarios", "/carga-historica", "/admin"],
      },
    ];

    return sectionMap
      .map((section) => ({
        title: section.title,
        description: section.description,
        items: section.hrefs
          .map((href) => visibleQuickActions.find((action) => action.href === href))
          .filter(Boolean) as QuickAction[],
      }))
      .filter((section) => section.items.length > 0);
  }, [isSuperUser, visibleQuickActions]);

  const superUserActionCount = useMemo(() => {
    return superUserSections.reduce((acc, section) => acc + section.items.length, 0);
  }, [superUserSections]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-4xl">
          <PrevitalCard>
            <PrevitalCardContent className="p-8">
              <p className="text-sm text-slate-500">Validando sesion...</p>
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
          <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain" priority />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
            <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain p-1" priority />
          </div>
        </div>

        <PrevitalPageHeader
          title="CRM Prevital"
          subtitle="Accesos y resumen segun el rol autenticado."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#EAF4EC] px-5 py-3 text-[#4F6F5B]">
                <p className="text-sm font-semibold">{currentUserName || "Usuario"}</p>
                <p className="text-xs text-[#5E8F6C]">
                  {allRoleNames.length > 0 ? allRoleNames.join(" / ") : currentRoleName || "Rol"}
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
              <span>{allRoleNames.length > 0 ? allRoleNames.join(" / ") : currentRoleName || "Rol"}</span>
            </div>
          </PrevitalFilterGroup>

          <PrevitalButton
            variant="secondary"
            leftIcon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => void loadDashboard(currentRoleCode, currentUserId)}
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
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <StatCard
                title="Leads totales"
                value={loading ? "..." : String(totalLeads)}
                subtitle="Conteo real en la base de datos"
                icon={<Activity className="h-5 w-5" />}
              />
              <StatCard
                title="Usuarios"
                value={loading ? "..." : String(totalUsers)}
                subtitle={`${activeUsers} activos actualmente`}
                icon={<Users className="h-5 w-5" />}
              />
              <StatCard
                title="Accesos clave"
                value={loading ? "..." : String(superUserActionCount)}
                subtitle="Atajos principales del super usuario"
                icon={<LayoutGrid className="h-5 w-5" />}
              />
            </section>

            <PrevitalCard>
              <PrevitalCardHeader
                title="Centro de control"
                description="Recepcion ya incluye agenda visible y configuracion de cupos. Desde aqui organizas los accesos por bloque."
                action={
                  <PrevitalButton
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCcw className="h-4 w-4" />}
                    onClick={() => void loadDashboard(currentRoleCode, currentUserId)}
                  >
                    Actualizar
                  </PrevitalButton>
                }
              />
              <PrevitalCardContent>
                <div className="grid gap-6 xl:grid-cols-3">
                  {superUserSections.map((section) => (
                    <div key={section.title} className="rounded-3xl border border-[#D6E8DA] bg-[#F8F7F4] p-5">
                      <h3 className="text-lg font-semibold text-[#24312A]">{section.title}</h3>
                      <p className="mt-2 text-sm text-slate-500">{section.description}</p>

                      <div className="mt-4 space-y-3">
                        {section.items.map((action) => (
                          <Link
                            key={action.href}
                            href={action.href}
                            className="group block rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#BCD7C2]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-base font-semibold text-slate-800">
                                  {repairMojibake(action.title)}
                                </h4>
                                <p className="mt-1 text-sm text-slate-500">
                                  {repairMojibake(action.subtitle)}
                                </p>
                              </div>
                              <span className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                                Abrir
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PrevitalCardContent>
            </PrevitalCard>
          </>
        ) : (
          <PrevitalCard>
            <PrevitalCardHeader
              title="Accesos disponibles"
              description="Solo ves los modulos permitidos para tu rol."
              action={
                <PrevitalButton
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCcw className="h-4 w-4" />}
                  onClick={() => void loadDashboard(currentRoleCode, currentUserId)}
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
                    <Link
                      key={action.title}
                      href={action.href}
                      className="group relative overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#BCD7C2] hover:shadow-md"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

                      <div className="flex items-start justify-between gap-4">
                        <div className="pr-2">
                          <h3 className="text-lg font-semibold text-[#24312A] transition group-hover:text-[#4F6F5B]">
                            {repairMojibake(action.title)}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {repairMojibake(action.subtitle)}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B] transition group-hover:bg-white">
                          Abrir
                        </span>
                      </div>
                    </Link>
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
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
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
