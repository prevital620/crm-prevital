"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCcw, Phone, MapPin, CalendarDays } from "lucide-react";

import LogoutButton from "@/components/logout-button";
import { PrevitalPageHeader } from "@/components/layout/prevital-page-header";
import {
  PrevitalFilterBar,
  PrevitalFilterGroup,
  PrevitalInput,
} from "@/components/layout/prevital-filter-bar";
import { PrevitalBadge } from "@/components/ui/prevital-badge";
import { PrevitalButton } from "@/components/ui/prevital-button";
import {
  PrevitalCard,
  PrevitalCardContent,
  PrevitalCardHeader,
} from "@/components/ui/prevital-card";
import { parseDeliveryRecommendation } from "@/lib/appointments/receptionDelivery";
import { getCurrentUserRole, normalizeRoleCode } from "@/lib/auth";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";
import type {
  CustomerConsultDetail,
  CustomerConsultResponse,
  CustomerConsultSummary,
} from "@/lib/customers/types";
import printReceptionRecord from "@/lib/print/templates/printReceptionRecord";
import printSalesSupport from "@/lib/print/templates/printSalesSupport";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = [
  "super_user",
  "administrador",
  "recepcion",
  "comercial",
  "gerencia_comercial",
  "gerente",
  "gerente_comercial",
  "tmk",
  "nutricionista",
  "fisioterapeuta",
  "medico_general",
  "coordinador_clinico",
  "auditor_clinico",
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function normalizeSummaryLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getReceptionSummaryValue(summary: string | null | undefined, label: string) {
  if (!summary?.trim()) return "";
  const target = normalizeSummaryLabel(label);
  const line = summary
    .split(/\n|\|/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .find((item) => {
      const [lineLabel] = item.split(":");
      return normalizeSummaryLabel(lineLabel || "") === target;
    });

  return line?.split(":").slice(1).join(":").trim() || "";
}

function getReceptionSummaryValueFromLabels(
  summary: string | null | undefined,
  labels: string[]
) {
  for (const label of labels) {
    const value = getReceptionSummaryValue(summary, label);
    if (value) return value;
  }

  return "";
}

function serviceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    valoracion: "Valoración",
    nutricion: "Nutrición",
    fisioterapia: "Fisioterapia",
    detox: "Detox",
    sueroterapia: "Sueroterapia",
    tratamiento_integral: "Tratamiento integral",
  };

  const key = String(value || "").trim().toLowerCase();
  return map[key] || value || "";
}

function isWellnessService(serviceType: string | null | undefined) {
  const value = String(serviceType || "").trim().toLowerCase();
  return value === "detox" || value === "sueroterapia";
}

function isHealthService(serviceType: string | null | undefined) {
  const value = String(serviceType || "").trim().toLowerCase();
  if (!value) return false;
  if (value === "tratamiento_integral") return false;
  return !isWellnessService(value);
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function buildPaymentMethodSummary(paymentMethod: string | null | undefined) {
  const value = String(paymentMethod || "").trim().toLowerCase();
  if (!value) return "Sin definir";
  if (["addi", "welly", "medipay", "sumaspay"].includes(value)) {
    const label = value === "sumaspay" ? "Sumaspay" : value.charAt(0).toUpperCase() + value.slice(1);
    return `Créditos - ${label}`;
  }

  const map: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    cuotas: "Cuotas",
    creditos: "Créditos",
    credito: "Crédito",
    contado: "Contado",
  };

  return map[value] || paymentMethod || "Sin definir";
}

function mapYesNoFromSummary(value: string | null | undefined) {
  const normalized = normalizeSummaryLabel(value || "");
  if (!normalized) return "";
  if (normalized === "si" || normalized === "s") return "Si";
  if (normalized === "no") return "No";
  return value || "";
}

export default function ConsultaClientePage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [currentRoleLabel, setCurrentRoleLabel] = useState("Rol");
  const [scopeLabel, setScopeLabel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<CustomerConsultSummary[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerConsultDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedCommercialNotes = useMemo(() => {
    if (!detail?.commercial_cases?.length) {
      return null;
    }

    const primaryCase = detail.commercial_cases[0];
    const parsed = parseStoredCommercialNotes(primaryCase.commercial_notes);

    return {
      receptionSummary: parsed.receptionSummary,
      commercialNotes: parsed.commercialNotes,
      assessment: primaryCase.sales_assessment,
      proposal: primaryCase.proposal_text,
      closingNotes: primaryCase.closing_notes,
    };
  }, [detail]);

  function printSupportFromCase(caseItem: CustomerConsultDetail["commercial_cases"][number]) {
    if (!detail) return;

    const parsed = parseStoredCommercialNotes(caseItem.commercial_notes);
    const receptionSummary = parsed.receptionSummary;
    const documentNumber = getReceptionSummaryValue(receptionSummary, "Documento");
    const email = getReceptionSummaryValue(receptionSummary, "Correo");
    const eps =
      getReceptionSummaryValue(receptionSummary, "Afiliación") ||
      getReceptionSummaryValue(receptionSummary, "EPS");
    const address = getReceptionSummaryValue(receptionSummary, "Dirección");
    const birthDate =
      getReceptionSummaryValue(receptionSummary, "Fecha nacimiento") ||
      getReceptionSummaryValue(receptionSummary, "F. Nacimiento");
    const validity = getReceptionSummaryValue(receptionSummary, "Vigencia");

    const nutraceuticals = uniqueNonEmpty(
      detail.appointments.flatMap((appointment) => {
        const recommendation = parseDeliveryRecommendation(appointment.notes, "nutricion");
        if (!recommendation?.productName) return [];
        return [
          `${recommendation.productName}${recommendation.quantity > 1 ? ` x${recommendation.quantity}` : ""}`,
        ];
      })
    );

    const appointmentHealthServices = detail.appointments
      .filter((appointment) => isHealthService(appointment.service))
      .map((appointment) => serviceLabel(appointment.service));
    const appointmentWellnessServices = detail.appointments
      .filter((appointment) => isWellnessService(appointment.service))
      .map((appointment) => serviceLabel(appointment.service));

    const purchasedServiceLabel = serviceLabel(caseItem.purchased_service);
    const healthServices = uniqueNonEmpty([
      ...appointmentHealthServices,
      ...(isHealthService(caseItem.purchased_service) ? [purchasedServiceLabel] : []),
    ]);
    const wellnessServices = uniqueNonEmpty([
      ...appointmentWellnessServices,
      ...(isWellnessService(caseItem.purchased_service) ? [purchasedServiceLabel] : []),
    ]);

    const totalAmount = Number(caseItem.volume_amount || caseItem.sale_value || 0);
    const hasWellness =
      wellnessServices.length > 0 || isWellnessService(caseItem.purchased_service);
    const hasHealth = healthServices.length > 0 || isHealthService(caseItem.purchased_service);
    const supportDate = caseItem.created_at ? caseItem.created_at.slice(0, 10) : "";
    const supportTime = new Date(caseItem.created_at).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    printSalesSupport({
      supportCode: caseItem.support_code || "Pendiente",
      documentDate: supportDate,
      documentTime: supportTime,
      analystName: caseItem.commercial_name || "",
      preparedBy: caseItem.commercial_name || "",
      managerName: caseItem.assigned_by_name || "",
      internalNumber: caseItem.id.slice(-6).toUpperCase(),
      customerName: detail.identity.full_name,
      documentNumber,
      phone: detail.identity.phone,
      email,
      city: detail.identity.city,
      birthDate,
      eps,
      address,
      nutraceuticals,
      healthServices,
      wellnessServices,
      orderingRequired: nutraceuticals.length > 0 ? "Sí" : "No",
      prescriberName: detail.appointments.some((appointment) => appointment.service === "nutricion")
        ? "Nutrición"
        : "",
      sessionsUnits:
        detail.appointments.length > 0 ? String(detail.appointments.length) : "",
      validity,
      healthServicesAmount: hasHealth && !hasWellness ? totalAmount : null,
      wellnessServicesAmount: hasWellness && !hasHealth ? totalAmount : null,
      totalAmount,
      paymentMethod: buildPaymentMethodSummary(caseItem.payment_method),
    });
  }

  function printReceptionFromCase(caseItem: CustomerConsultDetail["commercial_cases"][number]) {
    if (!detail) return;

    const parsed = parseStoredCommercialNotes(caseItem.commercial_notes);
    const receptionSummary = parsed.receptionSummary;

    if (!receptionSummary?.trim()) {
      setErrorMessage("Este caso no tiene resumen de recepción guardado para imprimir el registro.");
      return;
    }

    const source =
      getReceptionSummaryValue(receptionSummary, "Fuente") ||
      caseItem.commission_source_type ||
      caseItem.lead_source_type ||
      detail.lead?.source ||
      "Sin fuente";

    const sourceDetail =
      getReceptionSummaryValueFromLabels(receptionSummary, [
        "Detalle OPC",
        "Detalle TMK",
        "Detalle red",
        "Referido por",
        "Detalle lugar",
        "Detalle evento",
        "Detalle cliente directo",
        "Detalle fuente",
      ]) || "No aplica";

    printReceptionRecord({
      radicado: caseItem.reception_code || null,
      customerName: detail.identity.full_name,
      phone: detail.identity.phone || null,
      city:
        getReceptionSummaryValueFromLabels(receptionSummary, ["Ciudad", "Vive en"]) ||
        detail.identity.city ||
        null,
      document:
        getReceptionSummaryValueFromLabels(receptionSummary, ["Documento", "C.C. / NIT"]) || null,
      analystName: caseItem.assigned_by_name || caseItem.commercial_name || null,
      source,
      sourceDetail,
      hasEps: mapYesNoFromSummary(
        getReceptionSummaryValueFromLabels(receptionSummary, ["Tiene EPS", "EPS"])
      ),
      affiliation:
        getReceptionSummaryValueFromLabels(receptionSummary, ["Afiliación", "EPS"]) || null,
      age: getReceptionSummaryValue(receptionSummary, "Edad") || null,
      bringsId: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Trae cédula")),
      smartphone: mapYesNoFromSummary(
        getReceptionSummaryValue(receptionSummary, "Celular inteligente")
      ),
      occupation: getReceptionSummaryValue(receptionSummary, "Ocupación") || null,
      hasDetoxTime: mapYesNoFromSummary(
        getReceptionSummaryValue(receptionSummary, "Tiempo disponible para terapia detox 30 min")
      ),
      hypertension: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Hipertenso")),
      diabetes: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Diabético")),
      surgeries: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Cirugías")),
      surgeriesDetail: getReceptionSummaryValue(receptionSummary, "Cirugías cuáles") || null,
      medications: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Medicamentos")),
      medicationsDetail: getReceptionSummaryValue(receptionSummary, "Medicamentos cuáles") || null,
      diseases: mapYesNoFromSummary(getReceptionSummaryValue(receptionSummary, "Enfermedades")),
      diseasesDetail: getReceptionSummaryValue(receptionSummary, "Enfermedades cuáles") || null,
      companionName: getReceptionSummaryValue(receptionSummary, "Acompañante") || null,
      companionRelationship:
        getReceptionSummaryValue(receptionSummary, "Acompañante parentesco") || null,
      observations:
        getReceptionSummaryValue(receptionSummary, "Observaciones recepción") || null,
    });
  }

  async function ensureAccess() {
    try {
      setCheckingSession(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const auth = await getCurrentUserRole();
      const effectiveRoles = Array.from(
        new Set(
          [auth.roleCode, ...(auth.allRoleCodes || [])]
            .map((role) => normalizeRoleCode(role))
            .filter(Boolean)
        )
      ) as string[];

      const allowed = effectiveRoles.some((role) =>
        (ALLOWED_ROLES as readonly string[]).includes(role)
      );

      if (!allowed) {
        router.push("/crm");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setCurrentUserName(profile?.full_name || "Usuario");
      setCurrentRoleLabel(auth.allRoleNames?.join(" / ") || auth.roleName || "Rol");
    } catch (error: any) {
      setErrorMessage(error?.message || "No fue posible validar el acceso.");
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadData(query = searchTerm, ref = selectedRef) {
    try {
      setLoading(true);
      setErrorMessage("");

      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (ref) params.set("ref", ref);

      const response = await fetch(`/api/consulta-cliente?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as
        | CustomerConsultResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "No fue posible consultar clientes.");
      }

      const data = payload as CustomerConsultResponse;
      setItems(data.items || []);
      setDetail(data.detail || null);
      setScopeLabel(
        data.scope === "full"
          ? "Vista completa autorizada."
          : data.scope === "team"
            ? "Mostrando solo clientes del equipo autorizado."
            : data.scope === "self"
              ? "Mostrando solo clientes vinculados a tu gestión."
              : ""
      );

      if (!ref && data.items?.length) {
        const firstRef = data.items[0].ref;
        setSelectedRef(firstRef);
        void loadData(query, firstRef);
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo cargar la consulta de clientes.");
      setItems([]);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void ensureAccess();
  }, []);

  useEffect(() => {
    if (!checkingSession) {
      void loadData();
    }
  }, [checkingSession]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <PrevitalCard>
            <PrevitalCardContent className="p-8 text-sm text-slate-500">
              Validando acceso a consulta cliente...
            </PrevitalCardContent>
          </PrevitalCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PrevitalPageHeader
          title="Consulta cliente"
          subtitle="Trazabilidad operativa y comercial del cliente, sin mostrar contenido clínico."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#EAF4EC] px-5 py-3 text-[#4F6F5B]">
                <p className="text-sm font-semibold">{currentUserName}</p>
                <p className="text-xs text-[#5E8F6C]">{currentRoleLabel}</p>
              </div>
              <LogoutButton />
            </div>
          }
        />

        <PrevitalFilterBar>
          <PrevitalFilterGroup>
            <PrevitalInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por cliente, teléfono o ciudad"
              className="min-w-[280px] flex-1"
            />
          </PrevitalFilterGroup>

          <div className="flex flex-wrap gap-3">
            <PrevitalButton
              variant="secondary"
              leftIcon={<Search className="h-4 w-4" />}
              onClick={() => void loadData(searchTerm, selectedRef)}
            >
              Buscar
            </PrevitalButton>
            <PrevitalButton
              variant="secondary"
              leftIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => {
                setSearchTerm("");
                void loadData("", selectedRef);
              }}
            >
              Actualizar
            </PrevitalButton>
            <PrevitalButton variant="secondary" onClick={() => router.push("/crm")}>
              Inicio
            </PrevitalButton>
          </div>
        </PrevitalFilterBar>

        {scopeLabel ? (
          <div className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm text-[#4F6F5B]">
            {scopeLabel}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <PrevitalCard>
            <PrevitalCardHeader
              title="Clientes"
              description="Selecciona un cliente para ver su trazabilidad completa."
            />
            <PrevitalCardContent className="space-y-3">
              {loading && items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-4 text-sm text-slate-500">
                  Cargando clientes...
                </div>
              ) : null}

              {!loading && items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-4 text-sm text-slate-500">
                  No hay clientes para esos filtros.
                </div>
              ) : null}

              {items.map((item) => (
                <button
                  key={item.ref}
                  type="button"
                  onClick={() => {
                    setSelectedRef(item.ref);
                    void loadData(searchTerm, item.ref);
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    selectedRef === item.ref
                      ? "border-[#7FA287] bg-[#F4FAF6]"
                      : "border-[#D6E8DA] bg-white hover:border-[#BCD7C2]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#24312A]">{item.display_name}</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{item.phone || "Sin teléfono"}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{item.city || "Sin ciudad"}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          <span>{formatDateTime(item.latest_created_at)}</span>
                        </p>
                      </div>
                    </div>
                    <PrevitalBadge status={item.latest_status || undefined}>
                      {item.latest_status || "Sin estado"}
                    </PrevitalBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <PrevitalBadge>{item.origin_label}</PrevitalBadge>
                    {item.has_lead ? <PrevitalBadge>Lead</PrevitalBadge> : null}
                    {item.has_appointments ? <PrevitalBadge>Citas</PrevitalBadge> : null}
                    {item.has_commercial_case ? <PrevitalBadge>Comercial</PrevitalBadge> : null}
                  </div>
                </button>
              ))}
            </PrevitalCardContent>
          </PrevitalCard>

          <div className="space-y-6">
            <PrevitalCard>
              <PrevitalCardHeader
                title={detail?.identity.full_name || "Detalle del cliente"}
                description="Resumen operativo del cliente seleccionado."
              />
              <PrevitalCardContent>
                {!detail ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                    Selecciona un cliente a la izquierda para consultar su trazabilidad.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <InfoTile label="Teléfono" value={detail.identity.phone || "Sin teléfono"} />
                    <InfoTile label="Ciudad" value={detail.identity.city || "Sin ciudad"} />
                    <InfoTile
                      label="Citas"
                      value={String(detail.appointments.length)}
                      icon={<CalendarDays className="h-4 w-4" />}
                    />
                  </div>
                )}
              </PrevitalCardContent>
            </PrevitalCard>

            {detail?.lead ? (
              <PrevitalCard>
                <PrevitalCardHeader title="Lead" description="Origen y datos de captación." />
                <PrevitalCardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <InfoTile label="Origen" value={detail.lead.source || "Sin origen"} />
                  <InfoTile label="Estado" value={detail.lead.status || "Sin estado"} />
                  <InfoTile
                    label="Servicio de interés"
                    value={detail.lead.interest_service || "Sin servicio"}
                  />
                  <InfoTile
                    label="Captación"
                    value={detail.lead.capture_location || "Sin lugar"}
                  />
                  <InfoTile
                    label="Creado por"
                    value={detail.lead.created_by_name || "Sin registro"}
                  />
                  <InfoTile
                    label="Fecha lead"
                    value={formatDateTime(detail.lead.created_at)}
                  />
                </PrevitalCardContent>
              </PrevitalCard>
            ) : null}

            <PrevitalCard>
              <PrevitalCardHeader
                title="Citas"
                description="Agenda y seguimiento operativo del cliente."
              />
              <PrevitalCardContent className="space-y-3">
                {!detail?.appointments?.length ? (
                  <EmptyBlock message="Este cliente no tiene citas registradas." />
                ) : (
                  detail.appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1 text-sm text-slate-600">
                          <p className="font-semibold text-[#24312A]">
                            {appointment.service || "Sin servicio"}
                          </p>
                          <p>
                            {appointment.date} · {appointment.time}
                          </p>
                          <p>{appointment.city || "Sin ciudad"}</p>
                        </div>
                        <PrevitalBadge status={appointment.status}>
                          {appointment.status}
                        </PrevitalBadge>
                      </div>
                      {appointment.notes ? (
                        <div className="mt-3 rounded-2xl bg-[#F8F7F4] px-3 py-3 text-sm text-slate-600">
                          {appointment.notes}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </PrevitalCardContent>
            </PrevitalCard>

            <PrevitalCard>
              <PrevitalCardHeader
                title="Gestión comercial"
                description="Ventas, seguimiento y notas comerciales del cliente."
              />
              <PrevitalCardContent className="space-y-4">
                {!detail?.commercial_cases?.length ? (
                  <EmptyBlock message="Este cliente no tiene casos comerciales registrados." />
                ) : (
                  <>
                    {selectedCommercialNotes ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <TextBlock
                          title="Resumen de recepción"
                          value={selectedCommercialNotes.receptionSummary}
                        />
                        <TextBlock
                          title="Notas comerciales"
                          value={selectedCommercialNotes.commercialNotes}
                        />
                        <TextBlock
                          title="Valoración comercial"
                          value={selectedCommercialNotes.assessment}
                        />
                        <TextBlock
                          title="Propuesta comercial"
                          value={selectedCommercialNotes.proposal}
                        />
                        <TextBlock
                          title="Notas de cierre"
                          value={selectedCommercialNotes.closingNotes}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {detail.commercial_cases.map((caseItem) => (
                        <div
                          key={caseItem.id}
                          className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1 text-sm text-slate-600">
                              <p className="font-semibold text-[#24312A]">
                                {caseItem.purchased_service || "Sin servicio definido"}
                              </p>
                              <p>{formatDateTime(caseItem.created_at)}</p>
                              <p>
                                Comercial: {caseItem.commercial_name || "Sin asignar"} · Resultado:{" "}
                                {caseItem.sale_result || "Sin resultado"}
                              </p>
                            </div>
                            <div className="text-right text-sm text-slate-600">
                              <p className="font-semibold text-[#24312A]">
                                {formatMoney(caseItem.sale_value ?? caseItem.volume_amount ?? 0)}
                              </p>
                              <PrevitalBadge status={caseItem.status || undefined}>
                                {caseItem.status || "Sin estado"}
                              </PrevitalBadge>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <PrevitalButton
                              variant="secondary"
                              onClick={() => printSupportFromCase(caseItem)}
                            >
                              Imprimir soporte de venta
                            </PrevitalButton>
                            <PrevitalButton
                              variant="secondary"
                              onClick={() => printReceptionFromCase(caseItem)}
                            >
                              Imprimir registro de recepción
                            </PrevitalButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </PrevitalCardContent>
            </PrevitalCard>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[#6C8A77]">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-base font-semibold text-[#24312A]">
        {icon}
        <span>{value}</span>
      </p>
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;

  return (
    <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[#6C8A77]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-4 text-sm text-slate-500">
      {message}
    </div>
  );
}
