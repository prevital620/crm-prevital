"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import printDailyManifest from "@/lib/print/templates/printDailyManifest";
import { inferCommercialTeamFromDate } from "@/lib/commercial/team";
import { calculateNetCommissionBase } from "@/lib/commercial/commission-base";
import {
  buildStoredCommercialNotes,
  parseStoredCommercialNotes,
} from "@/lib/commercial/notes";
import { repairMojibake } from "@/lib/text/repairMojibake";

type CommercialCaseRow = {
  id: string;
  customer_name: string;
  phone: string | null;
  city: string | null;
  assigned_commercial_user_id: string | null;
  call_user_id: string | null;
  opc_user_id: string | null;
  status: string;
  commercial_notes: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  sales_assessment: string | null;
  payment_method: string | null;
  credit_provider: string | null;
  cash_amount: number | null;
  net_commission_base: number | null;
  volume_amount: number | null;
  closing_notes: string | null;
  created_at: string;
  closed_at: string | null;
};

type SourceUserOption = {
  id: string;
  full_name: string;
  employee_code: string | null;
  role_name: string;
  role_code: string;
  is_active: boolean;
};

type ManifestShift = "all" | "am" | "pm";

const allowedRoles = [
  "super_user",
  "administrador",
  "recepcion",
  "gerencia_comercial",
  "supervisor_opc",
  "supervisor_call_center",
];

const commercialPaymentOptions = [
  { value: "contado", label: "Contado" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto" },
  { value: "cartera", label: "Cartera" },
  { value: "creditos", label: "Créditos" },
  { value: "addi", label: "Addi" },
  { value: "welly", label: "Welly" },
  { value: "medipay", label: "MediPay" },
  { value: "sumaspay", label: "SumasPay" },
] as const;

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[-]/g, "")
    .trim()
    .toLowerCase();
}

function getCommercialReceptionSummary(item: CommercialCaseRow) {
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

function getReceptionSummaryValue(item: CommercialCaseRow, label: string) {
  const normalizedLabel = normalizeText(label);
  const line = getCommercialReceptionSummary(item).find((entry) =>
    normalizeText(entry).startsWith(`${normalizedLabel}:`)
  );
  return line?.split(":").slice(1).join(":").trim() || "";
}

function paymentMethodLabelComercial(value: string | null | undefined) {
  const found = commercialPaymentOptions.find((item) => item.value === (value || ""));
  return found?.label || value || "Sin definir";
}

function paymentMethodSummaryComercial(
  paymentMethod: string | null | undefined,
  creditProvider: string | null | undefined
) {
  if (!paymentMethod) return "No registrado";
  if (paymentMethod === "creditos") {
    const provider = commercialPaymentOptions.find((option) => option.value === creditProvider)?.label;
    return provider ? `Créditos - ${provider}` : "Créditos";
  }
  return paymentMethodLabelComercial(paymentMethod);
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

function inferManifestShift(value: string | null | undefined): ManifestShift | null {
  const inferred = inferCommercialTeamFromDate(value);
  return inferred === "am" || inferred === "pm" ? inferred : null;
}

function getLocalDateIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinLocalDateRange(
  value: string | null | undefined,
  dateFrom: string,
  dateTo: string
) {
  const localDate = getLocalDateIso(value);
  if (!localDate) return false;
  return localDate >= dateFrom && localDate <= dateTo;
}

function manifestShiftLabel(value: ManifestShift) {
  if (value === "all") return "Todo";
  return value.toUpperCase();
}

function hasCommercialSale(item: CommercialCaseRow) {
  return !!(
    item.purchased_service ||
    (item.sale_value && Number(item.sale_value) > 0) ||
    (item.volume_amount && Number(item.volume_amount) > 0)
  );
}

function buildManifestObservation(item: CommercialCaseRow, hasSale: boolean) {
  const receptionObservation =
    getReceptionSummaryValue(item, "Observaciones recepción") || "";
  const classificationReason =
    getReceptionSummaryValue(item, "Motivo clasificación") || "";
  const initialClassification =
    getReceptionSummaryValue(item, "Clasificación inicial") || "";
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

  return (
    receptionObservation ||
    classificationReason ||
    item.sales_assessment ||
    item.closing_notes ||
    ""
  );
}

export default function ManifiestosPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [commercialCases, setCommercialCases] = useState<CommercialCaseRow[]>([]);
  const [sourceUsers, setSourceUsers] = useState<SourceUserOption[]>([]);
  const [manifestDateFrom, setManifestDateFrom] = useState(hoyISO());
  const [manifestDateTo, setManifestDateTo] = useState(hoyISO());
  const [manifestShift, setManifestShift] = useState<ManifestShift>("all");

  useEffect(() => {
    async function validarAcceso() {
      try {
        setLoadingAuth(true);
        setError("");

        const auth = await getCurrentUserRole();

        if (!auth.user) {
          router.push("/login");
          return;
        }

        const roleCodes = auth.allRoleCodes.length > 0
          ? auth.allRoleCodes
          : auth.roleCode
            ? [auth.roleCode]
            : [];

        const hasAccess = roleCodes.some((roleCode) => allowedRoles.includes(roleCode));

        if (!hasAccess) {
          setAuthorized(false);
          setError("No tienes permiso para abrir manifiestos.");
          return;
        }

        setAuthorized(true);
        setCurrentRoleCode(auth.roleCode);
      } catch (err: any) {
        setAuthorized(false);
        setError(err?.message || "No se pudo validar el acceso.");
      } finally {
        setLoadingAuth(false);
      }
    }

    void validarAcceso();
  }, [router]);

  useEffect(() => {
    async function cargarDatos() {
      if (!authorized) return;

      try {
        setLoading(true);
        setError("");
        setMensaje("");

        const [commercialCasesResult, sourceUsersResult] = await Promise.all([
          supabase
            .from("commercial_cases")
            .select(`
              id,
              customer_name,
              phone,
              city,
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
              net_commission_base,
              volume_amount,
              closing_notes,
              created_at,
              closed_at
            `)
            .order("created_at", { ascending: false }),
          supabase
            .from("user_roles")
            .select(`
              user_id,
              profiles!user_roles_user_id_fkey (
                id,
                full_name,
                employee_code,
                is_active
              ),
              roles!user_roles_role_id_fkey (
                name,
                code
              )
            `),
        ]);

        if (commercialCasesResult.error) throw commercialCasesResult.error;
        if (sourceUsersResult.error) throw sourceUsersResult.error;

        const casesData = (commercialCasesResult.data as CommercialCaseRow[]) || [];
        const sourceUserRows = (sourceUsersResult.data as any[]) || [];
        const sourceUserMap = new Map<string, SourceUserOption>();

        sourceUserRows.forEach((row) => {
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
            role_name: row.roles?.name || "",
            role_code: roleCode,
            is_active: row.profiles?.is_active !== false,
          });
        });

        setCommercialCases(casesData);
        setSourceUsers(Array.from(sourceUserMap.values()));
      } catch (err: any) {
        setError(err?.message || "No se pudieron cargar los manifiestos.");
      } finally {
        setLoading(false);
      }
    }

    void cargarDatos();
  }, [authorized]);

  const sourceUserById = useMemo(
    () => new Map(sourceUsers.map((item) => [item.id, item])),
    [sourceUsers]
  );

  const normalizedManifestDateRange = useMemo(() => {
    const start = manifestDateFrom <= manifestDateTo ? manifestDateFrom : manifestDateTo;
    const end = manifestDateFrom <= manifestDateTo ? manifestDateTo : manifestDateFrom;
    return { start, end };
  }, [manifestDateFrom, manifestDateTo]);

  const manifestPeriodLabel = useMemo(() => {
    if (normalizedManifestDateRange.start === normalizedManifestDateRange.end) {
      return normalizedManifestDateRange.start;
    }

    return `${normalizedManifestDateRange.start} al ${normalizedManifestDateRange.end}`;
  }, [normalizedManifestDateRange]);

  const manifestRows = useMemo(() => {
    return commercialCases
      .filter((item) =>
        isWithinLocalDateRange(
          item.created_at,
          normalizedManifestDateRange.start,
          normalizedManifestDateRange.end
        )
      )
      .filter((item) =>
        manifestShift === "all" ? true : inferManifestShift(item.created_at) === manifestShift
      )
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .map((item) => {
        const tmk = item.call_user_id ? sourceUserById.get(item.call_user_id) : undefined;
        const opc = item.opc_user_id ? sourceUserById.get(item.opc_user_id) : undefined;
        const analyst = item.assigned_commercial_user_id
          ? sourceUserById.get(item.assigned_commercial_user_id)
          : undefined;
        const hasSale = hasCommercialSale(item);
        const cashAmount = Number(item.cash_amount || 0);
        const commissionableAmount = Number(
          item.net_commission_base ??
            calculateNetCommissionBase({
              cashAmount,
              paymentMethod: item.payment_method,
              creditProvider: item.credit_provider,
            })
        );

        return {
          horaLlegada: formatManifestTime(item.created_at),
          horaSalida: formatManifestTime(item.closed_at),
          nombreCompleto: item.customer_name || "Sin nombre",
          analista: analyst?.full_name || "",
          codigoTMK: tmk?.employee_code || "",
          codigoOPC: opc?.employee_code || "",
          calificacion:
            hasSale || normalizeText(item.status) === "finalizado"
              ? "Q"
              : getReceptionSummaryValue(item, "Clasificación inicial") || "Sin definir",
          valorCaja: hasSale ? cashAmount.toLocaleString("es-CO") : "",
          valorComisionable: hasSale ? commissionableAmount.toLocaleString("es-CO") : "",
          ventaRealizada: hasSale,
          formaPago: hasSale
            ? paymentMethodSummaryComercial(item.payment_method, item.credit_provider)
            : "",
          observaciones: buildManifestObservation(item, hasSale),
        };
      });
  }, [commercialCases, manifestShift, normalizedManifestDateRange, sourceUserById]);

  const manifestSummary = useMemo(() => {
    let totalQ = 0;
    let totalNoQ = 0;
    let totalVentas = 0;
    let totalCaja = 0;
    let totalComisionable = 0;

    manifestRows.forEach((row) => {
      const qualification = normalizeText(row.calificacion);
      if (qualification === "q") totalQ += 1;
      if (qualification === "no q") totalNoQ += 1;

      if (row.ventaRealizada) {
        totalVentas += 1;
      }

      const cashValue = Number(String(row.valorCaja || "").replace(/\./g, "").replace(/,/g, "."));
      if (cashValue > 0) {
        totalCaja += cashValue;
      }

      const commissionableValue = Number(
        String(row.valorComisionable || "").replace(/\./g, "").replace(/,/g, ".")
      );
      if (commissionableValue > 0) {
        totalComisionable += commissionableValue;
      }
    });

    return {
      totalQ,
      totalNoQ,
      totalVentas,
      totalCaja: `$${totalCaja.toLocaleString("es-CO")}`,
      totalComisionable: `$${totalComisionable.toLocaleString("es-CO")}`,
    };
  }, [manifestRows]);

  function imprimirManifiesto() {
    printDailyManifest({
      fecha: manifestPeriodLabel,
      generatedAt: new Date().toLocaleString("es-CO"),
      shiftLabel: manifestShiftLabel(manifestShift),
      totalQ: manifestSummary.totalQ,
      totalNoQ: manifestSummary.totalNoQ,
      totalVentas: manifestSummary.totalVentas,
      totalCaja: manifestSummary.totalCaja,
      totalComisionable: manifestSummary.totalComisionable,
      rows: manifestRows,
    });
    setMensaje("Manifiesto listo para impresión.");
  }

  if (loadingAuth) {
    return <div className="min-h-screen bg-[#F6FBF7] p-8 text-[#365F49]">Validando acceso...</div>;
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F6FBF7] p-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[#E6C9C5] bg-white p-8 text-[#9A4E43] shadow-sm">
          <h1 className="text-2xl font-bold text-[#1F3128]">Manifiestos</h1>
          <p className="mt-3">{error || "No tienes permiso para abrir esta pantalla."}</p>
          <Link
            href="/crm"
            className="mt-6 inline-flex rounded-2xl border border-[#D6E8DA] bg-[#F8FCF9] px-4 py-2 text-sm font-semibold text-[#365F49]"
          >
            Volver al CRM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F6FBF7_0%,#EEF7F1_100%)] px-4 py-8 text-[#1F3128] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[32px] border border-[#CFE4D8] bg-white/95 p-6 shadow-[0_24px_58px_rgba(95,125,102,0.14)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#D7EADF] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                Impresiones
              </p>
              <h1 className="mt-3 text-3xl font-bold text-[#1F3128]">Manifiestos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#607368]">
                Consulta e imprime manifiestos por rango de fechas sin entrar al módulo completo de recepción.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#6A8376]">
                Rol actual: {currentRoleCode || "usuario"}
              </p>
            </div>

            <Link
              href="/crm"
              className="inline-flex rounded-2xl border border-[#D6E8DA] bg-[#F8FCF9] px-4 py-3 text-sm font-semibold text-[#365F49] transition hover:border-[#BDD7C5] hover:bg-white"
            >
              Volver al CRM
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="mt-6 rounded-[26px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(245,252,247,0.98)_0%,_rgba(237,248,241,0.98)_100%)] p-4 text-sm text-[#4F6F5B] shadow-[0_16px_32px_rgba(95,125,102,0.08)]">
            {mensaje}
          </div>
        ) : null}

        <section className="mt-6 rounded-[32px] border border-[#CFE4D8] bg-white/95 p-6 shadow-[0_24px_58px_rgba(95,125,102,0.14)]">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">
                Desde
              </label>
              <input
                type="date"
                value={manifestDateFrom}
                onChange={(e) => setManifestDateFrom(e.target.value)}
                className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-3 py-3 text-sm text-[#1F3128] outline-none transition focus:border-[#86B09A] focus:ring-2 focus:ring-[#DFF1E5]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">
                Hasta
              </label>
              <input
                type="date"
                value={manifestDateTo}
                onChange={(e) => setManifestDateTo(e.target.value)}
                className="w-full rounded-2xl border border-[#D6E8DA] bg-white px-3 py-3 text-sm text-[#1F3128] outline-none transition focus:border-[#86B09A] focus:ring-2 focus:ring-[#DFF1E5]"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["all", "am", "pm"] as ManifestShift[]).map((shift) => {
              const active = manifestShift === shift;
              return (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setManifestShift(shift)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                    active
                      ? "border-[#6F9480] bg-[#5F7D66] text-white shadow-sm"
                      : "border-[#D6E8DA] bg-white text-[#365F49] hover:border-[#BDD7C5] hover:bg-[#F5FBF7]"
                  }`}
                >
                  {manifestShiftLabel(shift)}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 rounded-[24px] border border-[#DCEBE1] bg-[#FCFEFC] p-4 md:grid-cols-4 lg:grid-cols-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Periodo</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestPeriodLabel}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Registros</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestRows.length}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Q</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestSummary.totalQ}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">No Q</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestSummary.totalNoQ}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Ventas</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestSummary.totalVentas}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Caja</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">{manifestSummary.totalCaja}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6A8376]">Comisionable</p>
              <p className="mt-1 text-sm font-semibold text-[#1F3128]">
                {manifestSummary.totalComisionable}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={imprimirManifiesto}
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
          >
            {loading ? "Cargando datos..." : `Imprimir manifiesto ${manifestShiftLabel(manifestShift)}`}
          </button>
        </section>
      </div>
    </main>
  );
}
