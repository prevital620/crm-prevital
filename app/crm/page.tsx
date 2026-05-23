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
import { Banknote, BadgeCheck, BadgeX, LayoutGrid, RefreshCcw, ShieldCheck, ShoppingCart, WalletCards } from "lucide-react";
import {
  getVisibleQuickActions,
  quickActions,
  type QuickAction,
} from "@/lib/crm/quick-actions";

type CommercialCaseSummaryRow = {
  id: string;
  created_at: string;
  closed_at: string | null;
  commercial_notes: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  volume_amount: number | null;
};

type DailySummary = {
  presenceTotal: number;
  presenceQ: number;
  presenceNq: number;
  sales: number;
  cash: number;
  portfolio: number;
};

type QuickActionSection = {
  title: string;
  description: string;
  items: QuickAction[];
};

function getLocalDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return getLocalDateISO(date);
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString("es-CO")}`;
}

function getInitialClassification(item: CommercialCaseSummaryRow) {
  const notes = repairMojibake(item.commercial_notes || "").toLowerCase();
  const match = notes.match(/clasificaci[oó]n inicial:\s*([^|.\n]+)/i);
  const value = (match?.[1] || "").trim().toLowerCase();

  if (!value) return "";
  if (value.startsWith("no q") || value === "nq") return "nq";
  if (value.startsWith("q")) return "q";
  return "";
}

function hasRealSale(item: CommercialCaseSummaryRow) {
  return Boolean(
    item.purchased_service ||
      item.sale_result === "ganada" ||
      item.sale_result === "venta_realizada" ||
      Number(item.sale_value || 0) > 0 ||
      Number(item.volume_amount || 0) > 0 ||
      Number(item.cash_amount || 0) > 0 ||
      Number(item.portfolio_amount || 0) > 0
  );
}

function buildDailySummary(
  todayCases: CommercialCaseSummaryRow[],
  todayClosedCases: CommercialCaseSummaryRow[]
): DailySummary {
  const classified = todayCases.reduce(
    (acc, item) => {
      const classification = getInitialClassification(item);
      if (classification === "q") acc.presenceQ += 1;
      if (classification === "nq") acc.presenceNq += 1;
      return acc;
    },
    { presenceQ: 0, presenceNq: 0 }
  );

  const salesRowsById = new Map<string, CommercialCaseSummaryRow>();
  [...todayCases, ...todayClosedCases].forEach((item) => {
    if (hasRealSale(item)) {
      salesRowsById.set(item.id, item);
    }
  });
  const salesRows = Array.from(salesRowsById.values());

  return {
    presenceTotal: classified.presenceQ + classified.presenceNq,
    presenceQ: classified.presenceQ,
    presenceNq: classified.presenceNq,
    sales: salesRows.length,
    cash: salesRows.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
    portfolio: salesRows.reduce((acc, item) => acc + Number(item.portfolio_amount || 0), 0),
  };
}

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

  const [dailySummary, setDailySummary] = useState<DailySummary>({
    presenceTotal: 0,
    presenceQ: 0,
    presenceNq: 0,
    sales: 0,
    cash: 0,
    portfolio: 0,
  });

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

      const today = getLocalDateISO();
      const tomorrow = addDaysISO(today, 1);
      const todayStart = `${today}T00:00:00-05:00`;
      const tomorrowStart = `${tomorrow}T00:00:00-05:00`;

      const [todayCasesResult, todayClosedCasesResult] = await Promise.all([
        supabase
          .from("commercial_cases")
          .select(
            "id, created_at, closed_at, commercial_notes, sale_result, purchased_service, sale_value, cash_amount, portfolio_amount, volume_amount"
          )
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart),
        supabase
          .from("commercial_cases")
          .select(
            "id, created_at, closed_at, commercial_notes, sale_result, purchased_service, sale_value, cash_amount, portfolio_amount, volume_amount"
          )
          .gte("closed_at", todayStart)
          .lt("closed_at", tomorrowStart),
      ]);

      if (todayCasesResult.error) throw todayCasesResult.error;
      if (todayClosedCasesResult.error) throw todayClosedCasesResult.error;

      setDailySummary(
        buildDailySummary(
          (todayCasesResult.data as CommercialCaseSummaryRow[]) ?? [],
          (todayClosedCasesResult.data as CommercialCaseSummaryRow[]) ?? []
        )
      );
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
    return getVisibleQuickActions([
      ...(allRoleCodes || []),
      currentRoleCode,
    ]);
  }, [allRoleCodes, currentRoleCode]);

  const isSuperUser = currentRoleCode === "super_user";

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
          "/admin/comisiones",
        ],
      },
      {
        title: "Operacion y atencion",
        description: "Recepcion y modulos clinicos del dia a dia.",
        hrefs: ["/recepcion", "/consulta-cliente", "/nutricion", "/fisioterapia"],
      },
      {
        title: "Administracion",
        description: "Usuarios, historicos y control global del CRM.",
        hrefs: ["/usuarios/nuevo", "/usuarios", "/roles-vista", "/carga-historica", "/admin"],
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
                title="Total presencias"
                value={loading ? "..." : String(dailySummary.presenceTotal)}
                subtitle="Q y NQ ingresados hoy"
                icon={<LayoutGrid className="h-5 w-5" />}
              />
              <StatCard
                title="Presencias Q"
                value={loading ? "..." : String(dailySummary.presenceQ)}
                subtitle="Ingresos comerciales del dia"
                icon={<BadgeCheck className="h-5 w-5" />}
              />
              <StatCard
                title="Presencias NQ"
                value={loading ? "..." : String(dailySummary.presenceNq)}
                subtitle="Ingresos no calificados del dia"
                icon={<BadgeX className="h-5 w-5" />}
              />
              <StatCard
                title="Ventas"
                value={loading ? "..." : String(dailySummary.sales)}
                subtitle="Casos cerrados con venta hoy"
                icon={<ShoppingCart className="h-5 w-5" />}
              />
              <StatCard
                title="Caja"
                value={loading ? "..." : formatMoney(dailySummary.cash)}
                subtitle="Pago recibido hoy"
                icon={<Banknote className="h-5 w-5" />}
              />
              <StatCard
                title="Cartera"
                value={loading ? "..." : formatMoney(dailySummary.portfolio)}
                subtitle="Saldo financiado hoy"
                icon={<WalletCards className="h-5 w-5" />}
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
