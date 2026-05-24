"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LogoutButton from "@/components/logout-button";
import { getCurrentUserRole, normalizeRoleCode } from "@/lib/auth";
import { repairMojibake } from "@/lib/text/repairMojibake";
import printDailyManifest from "@/lib/print/templates/printDailyManifest";
import { calculateNetCommissionBase } from "@/lib/commercial/commission-base";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";
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
import { Banknote, BadgeCheck, BadgeX, LayoutGrid, Printer, RefreshCcw, ShieldCheck, ShoppingCart, WalletCards } from "lucide-react";
import {
  getVisibleQuickActions,
  quickActions,
  type QuickAction,
} from "@/lib/crm/quick-actions";

type CommercialCaseSummaryRow = {
  id: string;
  customer_name?: string;
  created_at: string;
  updated_at?: string | null;
  closed_at: string | null;
  assigned_commercial_user_id?: string | null;
  call_user_id?: string | null;
  opc_user_id?: string | null;
  status?: string | null;
  commercial_notes: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  sales_assessment?: string | null;
  payment_method?: string | null;
  credit_provider?: string | null;
  cash_amount: number | null;
  net_commission_base?: number | null;
  portfolio_amount: number | null;
  volume_amount: number | null;
  closing_notes?: string | null;
};

type ManifestSourceUser = {
  id: string;
  full_name: string;
  employee_code: string;
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

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatManifestTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCommercialReceptionSummary(item: CommercialCaseSummaryRow) {
  const source =
    item.sale_result && !["ganada", "perdida", "pendiente"].includes(item.sale_result)
      ? item.sale_result
      : parseStoredCommercialNotes(item.commercial_notes).receptionSummary;

  if (!source) return [];
  return source
    .split("|")
    .map((part) => repairMojibake(part).trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

function getReceptionSummaryValue(item: CommercialCaseSummaryRow, label: string) {
  const normalizedLabel = normalizeText(label);
  const line = getCommercialReceptionSummary(item).find((entry) =>
    normalizeText(entry).startsWith(`${normalizedLabel}:`)
  );
  return line?.split(":").slice(1).join(":").trim() || "";
}

function paymentMethodSummary(
  paymentMethod: string | null | undefined,
  creditProvider: string | null | undefined
) {
  if (!paymentMethod) return "No registrado";
  if (paymentMethod === "creditos") return creditProvider ? `Créditos - ${creditProvider}` : "Créditos";
  return paymentMethod;
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

function buildManifestObservation(item: CommercialCaseSummaryRow, hasSale: boolean) {
  const receptionObservation = getReceptionSummaryValue(item, "Observaciones recepción") || "";
  const classificationReason = getReceptionSummaryValue(item, "Motivo clasificación") || "";
  const initialClassification = getReceptionSummaryValue(item, "Clasificación inicial") || "";
  const isInitialNoQ = normalizeText(initialClassification) === "no q";

  if (hasSale) {
    const finalQualificationNote =
      isInitialNoQ && classificationReason
        ? `Inicial: ${classificationReason} Final: Q por venta.`
        : "Q por venta.";

    return (
      [receptionObservation, finalQualificationNote].filter(Boolean).join(" ") ||
      item.sales_assessment ||
      item.closing_notes ||
      finalQualificationNote
    );
  }

  return receptionObservation || classificationReason || item.sales_assessment || item.closing_notes || "";
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

  async function imprimirManifiestoHoy() {
    try {
      setErrorMessage("");

      const today = getLocalDateISO();
      const tomorrow = addDaysISO(today, 1);
      const todayStart = `${today}T00:00:00-05:00`;
      const tomorrowStart = `${tomorrow}T00:00:00-05:00`;

      const [casesResult, sourceUsersResult] = await Promise.all([
        supabase
          .from("commercial_cases")
          .select(
            `
              id,
              customer_name,
              assigned_commercial_user_id,
              call_user_id,
              opc_user_id,
              status,
              commercial_notes,
              sale_result,
              purchased_service,
              sale_value,
              sales_assessment,
              payment_method,
              credit_provider,
              cash_amount,
              portfolio_amount,
              net_commission_base,
              volume_amount,
              closing_notes,
              created_at,
              updated_at,
              closed_at
            `
          )
          .gte("created_at", todayStart)
          .lt("created_at", tomorrowStart)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_roles")
          .select(
            `
              user_id,
              profiles!user_roles_user_id_fkey (
                id,
                full_name,
                employee_code
              ),
              roles!user_roles_role_id_fkey (
                code
              )
            `
          ),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (sourceUsersResult.error) throw sourceUsersResult.error;

      const sourceUserMap = new Map<string, ManifestSourceUser>();
      ((sourceUsersResult.data as any[]) || []).forEach((row) => {
        const roleCode = row.roles?.code || "";
        const id = row.profiles?.id || row.user_id;
        if (!id) return;
        if (
          ![
            "promotor_opc",
            "supervisor_opc",
            "tmk",
            "confirmador",
            "supervisor_call_center",
            "comercial",
          ].includes(roleCode)
        ) {
          return;
        }
        if (sourceUserMap.has(id)) return;
        sourceUserMap.set(id, {
          id,
          full_name: row.profiles?.full_name || "Sin nombre",
          employee_code: row.profiles?.employee_code || "",
        });
      });

      const rows = (((casesResult.data as CommercialCaseSummaryRow[]) || [])).map((item) => {
        const tmk = item.call_user_id ? sourceUserMap.get(item.call_user_id) : undefined;
        const opc = item.opc_user_id ? sourceUserMap.get(item.opc_user_id) : undefined;
        const analyst = item.assigned_commercial_user_id
          ? sourceUserMap.get(item.assigned_commercial_user_id)
          : undefined;
        const hasSale = hasRealSale(item);
        const cashAmount = Number(item.cash_amount || 0);
        const commissionableAmount = Number(
          item.net_commission_base ??
            calculateNetCommissionBase({
              cashAmount,
              paymentMethod: item.payment_method || null,
              creditProvider: item.credit_provider || null,
            })
        );
        const receptionClassification = getReceptionSummaryValue(item, "Clasificación inicial");
        const finalizedSale = hasSale && Boolean(item.closed_at || normalizeText(item.status) === "finalizado");

        return {
          horaLlegada: formatManifestTime(item.created_at),
          horaSalida: formatManifestTime(item.closed_at || (hasSale ? item.updated_at || null : null)),
          nombreCompleto: item.customer_name || "Sin nombre",
          analista: analyst?.full_name || "",
          codigoTMK: tmk?.employee_code || "",
          codigoOPC: opc?.employee_code || "",
          calificacion:
            finalizedSale
              ? "Q"
              : receptionClassification || "Sin definir",
          valorCaja: hasSale ? cashAmount.toLocaleString("es-CO") : "",
          valorComisionable: hasSale ? commissionableAmount.toLocaleString("es-CO") : "",
          ventaRealizada: hasSale,
          formaPago: hasSale ? paymentMethodSummary(item.payment_method, item.credit_provider) : "",
          observaciones: buildManifestObservation(item, hasSale),
        };
      });

      let totalQ = 0;
      let totalNoQ = 0;
      let totalVentas = 0;
      let totalCaja = 0;
      let totalComisionable = 0;

      rows.forEach((row) => {
        const qualification = normalizeText(row.calificacion);
        if (qualification === "q") totalQ += 1;
        if (qualification === "no q") totalNoQ += 1;
        if (row.ventaRealizada) totalVentas += 1;

        const cashValue = Number(String(row.valorCaja || "").replace(/\./g, "").replace(/,/g, "."));
        if (cashValue > 0) totalCaja += cashValue;

        const commissionableValue = Number(
          String(row.valorComisionable || "").replace(/\./g, "").replace(/,/g, ".")
        );
        if (commissionableValue > 0) totalComisionable += commissionableValue;
      });

      printDailyManifest({
        fecha: today,
        generatedAt: new Date().toLocaleString("es-CO"),
        shiftLabel: "Todo",
        totalQ,
        totalNoQ,
        totalVentas,
        totalCaja: `$${totalCaja.toLocaleString("es-CO")}`,
        totalComisionable: `$${totalComisionable.toLocaleString("es-CO")}`,
        rows,
      });
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo imprimir el manifiesto.");
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
  const canPrintManifest = [
    ...(allRoleCodes || []),
    currentRoleCode,
  ].some((roleCode) =>
    [
      "super_user",
      "administrador",
      "recepcion",
      "gerencia_comercial",
      "supervisor_opc",
      "supervisor_call_center",
      "confirmador",
    ].includes(roleCode || "")
  );

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
          <Image src="/prevital-logo-vivo.png" alt="Prevital" fill className="object-contain" priority />
        </div>
      </div>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-24 w-36 overflow-hidden rounded-[24px] border border-[#D6E8DA] bg-white shadow-sm">
            <Image src="/prevital-logo-vivo.png" alt="Prevital" fill className="object-contain" priority />
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

          <div className="flex flex-wrap gap-3">
            {canPrintManifest ? (
              <PrevitalButton
                variant="secondary"
                leftIcon={<Printer className="h-4 w-4" />}
                onClick={() => void imprimirManifiestoHoy()}
              >
                Imprimir manifiesto
              </PrevitalButton>
            ) : null}
            <PrevitalButton
              variant="secondary"
              leftIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => void loadDashboard(currentRoleCode, currentUserId)}
            >
              Actualizar panel
            </PrevitalButton>
          </div>
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
