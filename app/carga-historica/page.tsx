"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import SessionBadge from "@/components/session-badge";
import Field from "@/components/ui/Field";
import { getCurrentUserRole } from "@/lib/auth";
import {
  leadSourceOptions,
  normalizeCommercialCaseLeadSource,
} from "@/lib/lead-source";
import { supabase } from "@/lib/supabase";

type RoleUserOption = {
  id: string;
  full_name: string;
  employee_code: string | null;
  role_code: string;
  role_name: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  updated_at: string;
};

type InventoryMovement = {
  id: string;
  product_id: string;
  product_name: string;
  type: "entrada" | "salida" | "ajuste";
  quantity: number;
  movement_date?: string;
  lot_number?: string;
  notes: string;
  created_at: string;
};

type DeliveryLog = {
  id: string;
  patient_name: string;
  phone: string;
  product: string;
  quantity: number;
  notes: string;
  created_at: string;
};

type HistoricalForm = {
  customer_name: string;
  document: string;
  phone: string;
  city: string;
  lead_origin: string;
  commission_source: string;
  source_user_id: string;
  capture_location: string;
  interest_service: string;
  lead_status: string;
  lead_date: string;
  lead_time: string;
  lead_notes: string;
  was_client: boolean;
  create_appointment: boolean;
  appointment_date: string;
  appointment_time: string;
  appointment_status: string;
  appointment_service: string;
  specialist_user_id: string;
  appointment_notes: string;
  create_sale: boolean;
  commercial_date: string;
  commercial_time: string;
  commercial_status: string;
  assigned_commercial_user_id: string;
  purchased_service: string;
  payment_method: string;
  volume_amount: string;
  cash_amount: string;
  portfolio_amount: string;
  commercial_notes: string;
  has_delivery: boolean;
  delivery_product: string;
  delivery_quantity: string;
  delivery_date: string;
  delivery_notes: string;
  nutrition_history_pending: boolean;
};

const inputClass =
  "w-full rounded-[22px] border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const cardClass =
  "rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const leadStatusOptions = [
  { value: "nuevo", label: "Nuevo" },
  { value: "pendiente_contacto", label: "Pendiente" },
  { value: "interesado", label: "Interesado" },
  { value: "no_responde", label: "No responde" },
  { value: "contactado", label: "Contactado" },
  { value: "agendado", label: "Agendado" },
  { value: "no_asistio", label: "No asistio" },
  { value: "dato_falso", label: "Dato falso" },
  { value: "no_interesa", label: "No interesa" },
];

const commissionSourceOptions = [
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "redes", label: "Redes" },
  { value: "base", label: "Base" },
  { value: "otro", label: "Otro" },
];

const appointmentStatusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "en_espera", label: "En espera" },
  { value: "asistio", label: "Asistio" },
  { value: "no_asistio", label: "No asistio" },
  { value: "reagendada", label: "Reagendada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "en_atencion", label: "En atencion" },
  { value: "finalizada", label: "Finalizada" },
];

const commercialStatusOptions = [
  { value: "pendiente_asignacion_comercial", label: "Pendiente de asignacion" },
  { value: "asignado_comercial", label: "Asignado" },
  { value: "en_atencion_comercial", label: "En atencion" },
  { value: "finalizado", label: "Finalizado" },
];

const serviceOptions = [
  { value: "", label: "Selecciona" },
  { value: "valoracion", label: "Valoracion" },
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "nutricion", label: "Nutricion" },
  { value: "medico", label: "Medico" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "tratamiento_integral", label: "Tratamiento integral" },
];

const paymentOptions = [
  { value: "", label: "Selecciona" },
  { value: "contado", label: "Contado" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto" },
  { value: "cartera", label: "Cartera" },
  { value: "addi", label: "Addi" },
  { value: "welly", label: "Welly" },
  { value: "medipay", label: "MediPay" },
];

function hoyISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function toIso(date: string, time: string) {
  if (!date) return new Date().toISOString();
  const candidate = new Date(`${date}T${time || "12:00"}:00`);
  if (Number.isNaN(candidate.getTime())) return new Date().toISOString();
  return candidate.toISOString();
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: null as string | null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null as string | null };
  return {
    firstName: parts.slice(0, 2).join(" "),
    lastName: parts.slice(2).join(" ") || null,
  };
}

function normalizeMoneyString(value: string) {
  return value.replace(/[^\d,-.]/g, "").replace(/\./g, "").replace(",", ".");
}

function numberFromString(value: string) {
  const raw = normalizeMoneyString(value || "");
  if (!raw) return 0;
  return Number(raw);
}

function buildHistoricalNotes(parts: Array<string | null | undefined>) {
  return (
    parts
      .map((item) => (item || "").trim())
      .filter(Boolean)
      .join(" | ") || null
  );
}

function formatMoneyPreview(value: number) {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function formatRoleUserLabel(user: RoleUserOption) {
  const roleLabel = user.role_name || user.role_code;
  return user.employee_code
    ? `${user.employee_code} · ${user.full_name} - ${roleLabel}`
    : `${user.full_name} - ${roleLabel}`;
}

function initialForm(): HistoricalForm {
  return {
    customer_name: "",
    document: "",
    phone: "",
    city: "",
    lead_origin: "opc",
    commission_source: "opc",
    source_user_id: "",
    capture_location: "",
    interest_service: "valoracion",
    lead_status: "agendado",
    lead_date: hoyISO(),
    lead_time: "08:00",
    lead_notes: "",
    was_client: false,
    create_appointment: true,
    appointment_date: hoyISO(),
    appointment_time: "08:00",
    appointment_status: "asistio",
    appointment_service: "valoracion",
    specialist_user_id: "",
    appointment_notes: "",
    create_sale: false,
    commercial_date: hoyISO(),
    commercial_time: "09:00",
    commercial_status: "finalizado",
    assigned_commercial_user_id: "",
    purchased_service: "tratamiento_integral",
    payment_method: "contado",
    volume_amount: "",
    cash_amount: "",
    portfolio_amount: "",
    commercial_notes: "",
    has_delivery: false,
    delivery_product: "",
    delivery_quantity: "1",
    delivery_date: hoyISO(),
    delivery_notes: "",
    nutrition_history_pending: false,
  };
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#66826F]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#24312A]">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#587366]">
        {description}
      </p>
    </div>
  );
}

function ToggleCard({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-[26px] border p-5 text-left transition ${
        checked
          ? "border-[#7FA287] bg-[#EEF7F1] shadow-[0_16px_30px_rgba(95,125,102,0.12)]"
          : "border-[#D7E8DC] bg-white/90 hover:border-[#BCD7C2]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#24312A]">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#5C7568]">{description}</p>
        </div>
        <span
          className={`mt-1 inline-flex h-6 w-11 rounded-full p-1 transition ${
            checked ? "bg-[#5F7D66]" : "bg-[#D9E7DD]"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow transition ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </div>
    </button>
  );
}

export default function CargaHistoricaPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sourceUsers, setSourceUsers] = useState<RoleUserOption[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<RoleUserOption[]>([]);
  const [specialists, setSpecialists] = useState<RoleUserOption[]>([]);
  const [form, setForm] = useState<HistoricalForm>(initialForm);

  useEffect(() => {
    async function loadContext() {
      try {
        setLoadingAuth(true);
        setError("");

        const auth = await getCurrentUserRole();

        if (!auth.user || auth.roleCode !== "super_user") {
          setAuthorized(false);
          setError("No tienes permiso para entrar a carga historica.");
          return;
        }

        setAuthorized(true);
        setCurrentUserId(auth.user.id);
      } catch (err: any) {
        setAuthorized(false);
        setError(err?.message || "No se pudo validar el acceso.");
      } finally {
        setLoadingAuth(false);
      }
    }

    void loadContext();
  }, []);

  useEffect(() => {
    if (!authorized) return;

    async function loadUsers() {
      try {
        setLoadingOptions(true);

        const { data, error: rolesError } = await supabase
          .from("user_roles")
          .select(`
            user_id,
            profiles!user_roles_user_id_fkey (
              id,
              full_name,
              employee_code
            ),
            roles!user_roles_role_id_fkey (
              name,
              code
            )
          `);

        if (rolesError) throw rolesError;

        const rows = (data || []) as any[];
        const normalized = rows
          .map((row) => ({
            id: row.profiles?.id || row.user_id,
            full_name: row.profiles?.full_name || "Sin nombre",
            employee_code: row.profiles?.employee_code || null,
            role_name: row.roles?.name || "",
            role_code: row.roles?.code || "",
          }))
          .filter((item) => item.id);

        const uniqueMap = new Map<string, RoleUserOption>();
        normalized.forEach((item) => {
          if (!uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        });

        const allUsers = Array.from(uniqueMap.values()).sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        );

        setSourceUsers(
          allUsers.filter((item) =>
            [
              "promotor_opc",
              "supervisor_opc",
              "tmk",
              "confirmador",
              "supervisor_call_center",
            ].includes(item.role_code)
          )
        );

        setCommercialUsers(
          allUsers.filter((item) =>
            ["comercial", "gerencia_comercial", "super_user"].includes(
              item.role_code
            )
          )
        );

        setSpecialists(
          allUsers.filter((item) =>
            [
              "nutricionista",
              "medico_general",
              "medico",
              "fisioterapeuta",
            ].includes(item.role_code)
          )
        );
      } catch (err: any) {
        setError(err?.message || "No se pudieron cargar las opciones.");
      } finally {
        setLoadingOptions(false);
      }
    }

    void loadUsers();
  }, [authorized]);

  useEffect(() => {
    if (!form.was_client) {
      setForm((prev) => ({
        ...prev,
        create_sale: false,
        has_delivery: false,
        nutrition_history_pending: false,
      }));
    }
  }, [form.was_client]);

  useEffect(() => {
    if (!form.create_sale) {
      setForm((prev) => ({
        ...prev,
        has_delivery: false,
      }));
    }
  }, [form.create_sale]);

  const selectedSourceUser = useMemo(
    () => sourceUsers.find((item) => item.id === form.source_user_id) || null,
    [form.source_user_id, sourceUsers]
  );

  const selectedCommercialUser = useMemo(
    () =>
      commercialUsers.find((item) => item.id === form.assigned_commercial_user_id) ||
      null,
    [commercialUsers, form.assigned_commercial_user_id]
  );

  const calculatedVolume = useMemo(
    () => numberFromString(form.volume_amount),
    [form.volume_amount]
  );

  const calculatedCash = useMemo(
    () => numberFromString(form.cash_amount),
    [form.cash_amount]
  );

  const calculatedPortfolio = useMemo(() => {
    const explicit = numberFromString(form.portfolio_amount);
    if (explicit > 0) return explicit;
    return Math.max(0, calculatedVolume - calculatedCash);
  }, [calculatedCash, calculatedVolume, form.portfolio_amount]);

  const leadOriginLabel =
    leadSourceOptions.find((item) => item.value === form.lead_origin)?.label ||
    form.lead_origin;
  const commissionLabel =
    commissionSourceOptions.find((item) => item.value === form.commission_source)
      ?.label || form.commission_source;

  function setValue<K extends keyof HistoricalForm>(
    key: K,
    value: HistoricalForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function createOrFindCustomerUser() {
    const trimmedDocument = form.document.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedName = form.customer_name.trim();

    let query = supabase
      .from("users")
      .select("id, nombre, documento, telefono")
      .limit(1);

    if (trimmedDocument && trimmedPhone) {
      query = query.or(
        `documento.eq.${trimmedDocument},telefono.eq.${trimmedPhone}`
      );
    } else if (trimmedDocument) {
      query = query.eq("documento", trimmedDocument);
    } else if (trimmedPhone) {
      query = query.eq("telefono", trimmedPhone);
    } else {
      query = query.eq("nombre", trimmedName);
    }

    const { data: existing, error } = await query;
    if (error) throw error;

    if (existing && existing.length > 0) {
      return existing[0].id as string;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert([
        {
          nombre: trimmedName,
          documento: trimmedDocument || null,
          telefono: trimmedPhone || null,
          ciudad: form.city.trim() || null,
          ocupacion: "historico",
          estado_actual: form.nutrition_history_pending
            ? "historia clinica pendiente"
            : "cliente historico",
        },
      ])
      .select("id")
      .single();

    if (insertError) throw insertError;
    return inserted.id as string;
  }

  function registerHistoricalDeliveryLocal() {
    if (typeof window === "undefined" || !form.has_delivery) return;

    const rawItems = window.localStorage.getItem("recepcion_inventory_items");
    const rawMovements = window.localStorage.getItem(
      "recepcion_inventory_movements"
    );
    const rawLogs = window.localStorage.getItem("recepcion_delivery_logs");

    const items = rawItems ? (JSON.parse(rawItems) as InventoryItem[]) : [];
    const movements = rawMovements
      ? (JSON.parse(rawMovements) as InventoryMovement[])
      : [];
    const logs = rawLogs ? (JSON.parse(rawLogs) as DeliveryLog[]) : [];

    const quantity = Number(form.delivery_quantity || "0");
    const now = new Date().toISOString();
    const productName = form.delivery_product.trim();
    const movementDate = form.delivery_date || hoyISO();

    const existingItem = items.find(
      (item) => normalizeText(item.name) === normalizeText(productName)
    );

    const productId =
      existingItem?.id ||
      `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const nextItems = existingItem
      ? items.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                stock: Math.max(item.stock - quantity, 0),
                updated_at: now,
              }
            : item
        )
      : [
          {
            id: productId,
            name: productName,
            category: "historico",
            stock: 0,
            min_stock: 0,
            updated_at: now,
          },
          ...items,
        ];

    const deliveryLog: DeliveryLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      patient_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      product: productName,
      quantity,
      notes: `Entrega historica. ${form.delivery_notes.trim()}`.trim(),
      created_at: toIso(movementDate, "12:00"),
    };

    const movement: InventoryMovement = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      product_id: productId,
      product_name: productName,
      type: "salida",
      quantity,
      movement_date: movementDate,
      notes: `Salida historica para ${form.customer_name.trim()}. ${form.delivery_notes.trim()}`.trim(),
      created_at: now,
    };

    window.localStorage.setItem(
      "recepcion_inventory_items",
      JSON.stringify(nextItems)
    );
    window.localStorage.setItem(
      "recepcion_inventory_movements",
      JSON.stringify([movement, ...movements].slice(0, 100))
    );
    window.localStorage.setItem(
      "recepcion_delivery_logs",
      JSON.stringify([deliveryLog, ...logs].slice(0, 30))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!authorized || !currentUserId) {
        throw new Error("No se pudo identificar el usuario actual.");
      }

      if (!form.customer_name.trim()) {
        throw new Error("Debes escribir el nombre del cliente.");
      }

      if (!form.phone.trim()) {
        throw new Error("Debes escribir el telefono.");
      }

      if (
        ["opc", "tmk"].includes(form.commission_source) &&
        !form.source_user_id
      ) {
        throw new Error(
          "Debes seleccionar el usuario responsable de la comision."
        );
      }

      if (form.create_sale && !form.was_client) {
        throw new Error(
          "No puedes registrar venta si marcas que no fue cliente."
        );
      }

      if (form.has_delivery && !form.create_sale) {
        throw new Error(
          "La entrega historica debe quedar asociada a una venta o ingreso comercial."
        );
      }

      const { firstName, lastName } = splitFullName(form.customer_name);
      const leadCreatedAt = toIso(form.lead_date, form.lead_time);
      const appointmentIso = toIso(form.appointment_date, form.appointment_time);
      const commercialIso = toIso(form.commercial_date, form.commercial_time);
      const volumeNumber = calculatedVolume;
      const cashNumber = calculatedCash;
      const portfolioNumber = calculatedPortfolio;
      const isCreditPayment = ["cartera", "addi", "welly", "medipay"].includes(
        form.payment_method
      );
      const netCommissionBase = Math.max(0, cashNumber);
      const grossBonusBase = volumeNumber || 0;
      const hayVenta =
        form.create_sale && (volumeNumber > 0 || Boolean(form.purchased_service));

      let leadId: string | null = null;
      let appointmentId: string | null = null;

      if (form.was_client) {
        await createOrFindCustomerUser();
      }

      const leadCreatedByUserId = form.source_user_id || currentUserId;
      const leadAssignedUserId =
        form.commission_source === "tmk" ? form.source_user_id || null : null;
      const leadNotes = buildHistoricalNotes([
        "Registro historico cargado por super user.",
        form.lead_notes,
      ]);

      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .insert([
          {
            first_name: firstName,
            last_name: lastName,
            phone: form.phone.trim(),
            city: form.city.trim() || null,
            capture_location: form.capture_location.trim() || null,
            interest_service: form.interest_service.trim() || null,
            source: form.lead_origin || null,
            observations: leadNotes,
            status: form.lead_status,
            created_by_user_id: leadCreatedByUserId,
            assigned_to_user_id: leadAssignedUserId,
            commission_source_type: form.commission_source || null,
            created_at: leadCreatedAt,
          },
        ])
        .select("id")
        .single();

      if (leadError) throw leadError;
      leadId = leadData.id as string;

      if (form.create_appointment) {
        const appointmentNotes = buildHistoricalNotes([
          "Registro historico.",
          form.appointment_notes,
          form.nutrition_history_pending
            ? "Historia clinica de nutricion pendiente por completar."
            : "",
          form.has_delivery
            ? `Entrega historica: ${form.delivery_product.trim()} x ${form.delivery_quantity}.`
            : "",
        ]);

        const appointmentPayload: Record<string, unknown> = {
          lead_id: leadId,
          patient_name: form.customer_name.trim(),
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          appointment_date: form.appointment_date,
          appointment_time: form.appointment_time,
          status: form.appointment_status,
          service_type: form.appointment_service || null,
          specialist_user_id: form.specialist_user_id || null,
          notes: appointmentNotes,
          created_by_user_id: currentUserId,
          updated_by_user_id: currentUserId,
          created_at: appointmentIso,
        };

        if (form.appointment_status === "en_espera") {
          appointmentPayload.checked_in_at = appointmentIso;
        }

        if (
          ["asistio", "en_atencion", "finalizada"].includes(
            form.appointment_status
          )
        ) {
          appointmentPayload.attended_at = appointmentIso;
        }

        const { data: appointmentData, error: appointmentError } = await supabase
          .from("appointments")
          .insert([appointmentPayload])
          .select("id")
          .single();

        if (appointmentError) throw appointmentError;
        appointmentId = appointmentData.id as string;
      }

      if (form.create_sale) {
        const historicalSummary = buildHistoricalNotes([
          "Registro historico cargado por super user.",
          form.nutrition_history_pending
            ? "Historia clinica de nutricion pendiente por completar."
            : "",
        ]);

        const commercialNotes = buildHistoricalNotes([
          form.commercial_notes,
          form.has_delivery
            ? `Entrega historica: ${form.delivery_product.trim()} x ${form.delivery_quantity}.`
            : "",
        ]);

        const { error: commercialError } = await supabase
          .from("commercial_cases")
          .insert([
            {
              lead_id: leadId,
              appointment_id: appointmentId,
              customer_name: form.customer_name.trim(),
              phone: form.phone.trim() || null,
              city: form.city.trim() || null,
              status: form.commercial_status,
              commercial_notes: buildHistoricalNotes([
                historicalSummary,
                commercialNotes,
              ]),
              sale_result: hayVenta ? "venta_historica" : null,
              purchased_service: form.purchased_service || null,
              sale_value: volumeNumber || null,
              payment_method: form.payment_method || null,
              cash_amount: cashNumber || null,
              portfolio_amount: portfolioNumber || null,
              volume_amount: volumeNumber || null,
              closing_notes: buildHistoricalNotes([
                form.commercial_notes,
                form.nutrition_history_pending
                  ? "Pendiente historia clinica nutricion."
                  : "",
              ]),
              sale_origin_type: leadId ? "lead" : "directo",
              lead_source_type: normalizeCommercialCaseLeadSource(
                form.lead_origin
              ),
              commission_source_type: form.commission_source || null,
              call_contact_result: form.lead_status || null,
              call_user_id:
                form.commission_source === "tmk"
                  ? form.source_user_id || null
                  : null,
              opc_user_id:
                form.commission_source === "opc"
                  ? form.source_user_id || null
                  : null,
              assigned_commercial_user_id:
                form.assigned_commercial_user_id || null,
              assigned_by_user_id:
                form.assigned_commercial_user_id ? currentUserId : null,
              assigned_at: form.assigned_commercial_user_id ? commercialIso : null,
              is_credit_payment: isCreditPayment,
              credit_provider: isCreditPayment ? form.payment_method : null,
              credit_discount_amount: 0,
              admin_discount_amount: 0,
              net_commission_base: netCommissionBase || null,
              counts_for_commission: hayVenta,
              counts_for_commercial_bonus: hayVenta,
              gross_bonus_base: grossBonusBase || null,
              created_by_user_id: currentUserId,
              updated_by_user_id: currentUserId,
              created_at: commercialIso,
              closed_by_user_id:
                form.commercial_status === "finalizado" ? currentUserId : null,
              closed_at:
                form.commercial_status === "finalizado" ? commercialIso : null,
            },
          ]);

        if (commercialError) throw commercialError;
      }

      if (form.has_delivery) {
        if (!form.delivery_product.trim()) {
          throw new Error("Debes escribir el producto entregado.");
        }

        if (Number(form.delivery_quantity || "0") < 1) {
          throw new Error("La cantidad entregada debe ser mayor que cero.");
        }

        registerHistoricalDeliveryLocal();
      }

      setMessage(
        [
          "Caso historico guardado correctamente.",
          "Ya quedo en leads.",
          form.create_appointment ? "Tambien quedo en agenda." : null,
          form.create_sale ? "Tambien quedo en comercial." : null,
          form.has_delivery ? "Tambien quedo en inventario local." : null,
        ]
          .filter(Boolean)
          .join(" ")
      );
      setForm(initialForm());
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el caso historico.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#F6FBF7] p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className={cardClass}>
            <p className="text-sm text-[#587366]">Validando acceso...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F6FBF7] p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className={cardClass}>
            <p className="text-sm font-medium text-red-700">
              {error || "No tienes permiso para entrar a esta vista."}
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,236,221,0.52),_rgba(246,251,247,0.98)_46%,_rgba(244,249,245,1)_100%)] p-6 md:p-8">
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

        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-[#D6E8DA] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#66826F] shadow-sm">
                Historicos
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-[#24312A] md:text-6xl">
                Carga historica
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-9 text-[#4F675C]">
                Registra uno por uno los casos reales de dias anteriores con sus
                fechas originales, conservando origen, comision, cita, venta e
                inventario sin inventar la historia clinica de nutricion.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                >
                  Inicio
                </Link>
                <Link
                  href="/recepcion?view=agenda"
                  className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                >
                  Ver agenda
                </Link>
              </div>
            </div>

            <SessionBadge />
          </div>
        </section>

        {error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-[24px] border border-[#BFE0C8] bg-[#EDF8F0] px-5 py-4 text-sm text-[#335343]">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className={cardClass}>
            <p className="text-sm font-medium text-[#66826F]">Responsables</p>
            <p className="mt-3 text-3xl font-semibold text-[#24312A]">
              {loadingOptions ? "..." : sourceUsers.length}
            </p>
            <p className="mt-2 text-sm text-[#5C7568]">
              OPC, TMK y supervision disponibles para comision.
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-[#66826F]">Comerciales</p>
            <p className="mt-3 text-3xl font-semibold text-[#24312A]">
              {loadingOptions ? "..." : commercialUsers.length}
            </p>
            <p className="mt-2 text-sm text-[#5C7568]">
              Usuarios que pueden quedar asignados historicamente.
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-[#66826F]">Especialistas</p>
            <p className="mt-3 text-3xl font-semibold text-[#24312A]">
              {loadingOptions ? "..." : specialists.length}
            </p>
            <p className="mt-2 text-sm text-[#5C7568]">
              Se usan solo para enlazar la cita historica.
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-[#66826F]">Inventario</p>
            <p className="mt-3 text-3xl font-semibold text-[#24312A]">
              {form.has_delivery ? "Activo" : "Opcional"}
            </p>
            <p className="mt-2 text-sm text-[#5C7568]">
              La salida historica se registra en el inventario local del CRM.
            </p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={cardClass}>
            <SectionTitle
              eyebrow="Cliente"
              title="Datos base del caso"
              description="Primero define a quien pertenece el historico. Si ya fue cliente real, el sistema intentara enlazar o crear su ficha en la base de clientes."
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Nombre completo"
                input={
                  <input
                    className={inputClass}
                    value={form.customer_name}
                    onChange={(e) => setValue("customer_name", e.target.value)}
                    placeholder="Ej: Maria Lopez"
                  />
                }
              />
              <Field
                label="Documento"
                input={
                  <input
                    className={inputClass}
                    value={form.document}
                    onChange={(e) => setValue("document", e.target.value)}
                    placeholder="Ej: 1035000000"
                  />
                }
              />
              <Field
                label="Telefono"
                input={
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => setValue("phone", e.target.value)}
                    placeholder="Ej: 3001234567"
                  />
                }
              />
              <Field
                label="Ciudad"
                input={
                  <input
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => setValue("city", e.target.value)}
                    placeholder="Ej: Medellin"
                  />
                }
              />
            </div>
          </section>

          <section className={cardClass}>
            <SectionTitle
              eyebrow="Lead y comision"
              title="Trazabilidad historica"
              description="Aqui defines la fecha real del lead, el origen, la fuente para comision y el responsable historico para que luego los reportes de OPC y call center tengan sentido."
            />

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Origen del lead"
                input={
                  <select
                    className={inputClass}
                    value={form.lead_origin}
                    onChange={(e) => setValue("lead_origin", e.target.value)}
                  >
                    {leadSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />
              <Field
                label="Fuente para comision"
                input={
                  <select
                    className={inputClass}
                    value={form.commission_source}
                    onChange={(e) => setValue("commission_source", e.target.value)}
                  >
                    {commissionSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />
              <Field
                label="Responsable historico"
                helperText={
                  form.commission_source === "opc" || form.commission_source === "tmk"
                    ? "Obligatorio para conservar comision."
                    : "Opcional si el lead venia de otra fuente."
                }
                input={
                  <select
                    className={inputClass}
                    value={form.source_user_id}
                    onChange={(e) => setValue("source_user_id", e.target.value)}
                  >
                      <option value="">Selecciona</option>
                      {sourceUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {formatRoleUserLabel(user)}
                        </option>
                      ))}
                  </select>
                }
              />
              <Field
                label="Estado historico del lead"
                input={
                  <select
                    className={inputClass}
                    value={form.lead_status}
                    onChange={(e) => setValue("lead_status", e.target.value)}
                  >
                    {leadStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <Field
                label="Fecha del lead"
                input={
                  <input
                    type="date"
                    className={inputClass}
                    value={form.lead_date}
                    onChange={(e) => setValue("lead_date", e.target.value)}
                  />
                }
              />
              <Field
                label="Hora del lead"
                input={
                  <input
                    type="time"
                    className={inputClass}
                    value={form.lead_time}
                    onChange={(e) => setValue("lead_time", e.target.value)}
                  />
                }
              />
              <Field
                label="Lugar de captacion"
                input={
                  <input
                    className={inputClass}
                    value={form.capture_location}
                    onChange={(e) => setValue("capture_location", e.target.value)}
                    placeholder="Ej: Punto fisico Laureles"
                  />
                }
              />
              <Field
                label="Servicio de interes"
                input={
                  <select
                    className={inputClass}
                    value={form.interest_service}
                    onChange={(e) => setValue("interest_service", e.target.value)}
                  >
                    {serviceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>

            <div className="mt-5">
              <Field
                label="Notas del lead"
                input={
                  <textarea
                    className={`${inputClass} min-h-[120px] resize-y`}
                    value={form.lead_notes}
                    onChange={(e) => setValue("lead_notes", e.target.value)}
                    placeholder="Contexto historico, observaciones, detalle de captacion..."
                  />
                }
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <ToggleCard
                checked={form.was_client}
                title="Fue cliente real"
                description="Activalo si esta persona realmente llego a ser cliente o paciente. Si no lo activas, puedes guardar solo el lead historico sin venta."
                onChange={(checked) => setValue("was_client", checked)}
              />
            <ToggleCard
              checked={form.create_appointment}
              title="Crear cita historica"
              description="Usalo cuando ya exista una fecha real de cita y quieras verla reflejada en agenda y trazabilidad."
              onChange={(checked) => setValue("create_appointment", checked)}
            />
              <ToggleCard
                checked={form.create_sale}
                title="Registrar venta o ingreso"
                description="Crea el caso comercial historico solo si si hubo venta o ingreso. Puedes dejarlo apagado para cargar clientes o leads sin venta."
                onChange={(checked) => setValue("create_sale", checked)}
              />
            <ToggleCard
              checked={form.nutrition_history_pending}
              title="Nutricion completa despues"
              description="Marca este switch si nutricion debe llenar la historia clinica luego desde su propio modulo."
              onChange={(checked) => setValue("nutrition_history_pending", checked)}
            />
          </section>

          {form.create_appointment ? (
            <section className={cardClass}>
              <SectionTitle
                eyebrow="Cita"
                title="Agenda historica"
                description="Si la persona ya tuvo agenda real, registra fecha, hora, estado y especialista para que el CRM respete ese recorrido."
              />

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  label="Fecha de cita"
                  input={
                    <input
                      type="date"
                      className={inputClass}
                      value={form.appointment_date}
                      onChange={(e) => setValue("appointment_date", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Hora de cita"
                  input={
                    <input
                      type="time"
                      className={inputClass}
                      value={form.appointment_time}
                      onChange={(e) => setValue("appointment_time", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Estado de la cita"
                  input={
                    <select
                      className={inputClass}
                      value={form.appointment_status}
                      onChange={(e) => setValue("appointment_status", e.target.value)}
                    >
                      {appointmentStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Field
                  label="Servicio agendado"
                  input={
                    <select
                      className={inputClass}
                      value={form.appointment_service}
                      onChange={(e) => setValue("appointment_service", e.target.value)}
                    >
                      {serviceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field
                  label="Especialista"
                  helperText="Opcional. Se usa solo para dejar referenciado quien atendio."
                  input={
                    <select
                      className={inputClass}
                      value={form.specialist_user_id}
                      onChange={(e) => setValue("specialist_user_id", e.target.value)}
                    >
                        <option value="">Selecciona</option>
                        {specialists.map((user) => (
                          <option key={user.id} value={user.id}>
                            {formatRoleUserLabel(user)}
                          </option>
                        ))}
                    </select>
                  }
                />
                <Field
                  label="Notas de la cita"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y`}
                      value={form.appointment_notes}
                      onChange={(e) => setValue("appointment_notes", e.target.value)}
                      placeholder="Observaciones de agenda, asistencia, confirmacion..."
                    />
                  }
                />
              </div>
            </section>
          ) : null}

          {form.create_sale ? (
            <section className={cardClass}>
              <SectionTitle
                eyebrow="Comercial"
                title="Venta y resultado real"
                description="Aqui se consolida el ingreso comercial historico, la venta, el metodo de pago y la base de comision con sus fechas reales."
              />

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  label="Fecha comercial"
                  input={
                    <input
                      type="date"
                      className={inputClass}
                      value={form.commercial_date}
                      onChange={(e) => setValue("commercial_date", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Hora comercial"
                  input={
                    <input
                      type="time"
                      className={inputClass}
                      value={form.commercial_time}
                      onChange={(e) => setValue("commercial_time", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Estado comercial"
                  input={
                    <select
                      className={inputClass}
                      value={form.commercial_status}
                      onChange={(e) => setValue("commercial_status", e.target.value)}
                    >
                      {commercialStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Field
                  label="Comercial asignado"
                  input={
                    <select
                      className={inputClass}
                      value={form.assigned_commercial_user_id}
                      onChange={(e) =>
                        setValue("assigned_commercial_user_id", e.target.value)
                      }
                    >
                        <option value="">Selecciona</option>
                        {commercialUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {formatRoleUserLabel(user)}
                          </option>
                        ))}
                    </select>
                  }
                />
                <Field
                  label="Servicio vendido"
                  input={
                    <select
                      className={inputClass}
                      value={form.purchased_service}
                      onChange={(e) => setValue("purchased_service", e.target.value)}
                    >
                      {serviceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Field
                  label="Metodo de pago"
                  input={
                    <select
                      className={inputClass}
                      value={form.payment_method}
                      onChange={(e) => setValue("payment_method", e.target.value)}
                    >
                      {paymentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  }
                />
                <Field
                  label="Valor total"
                  helperText="Valor volumen o venta total."
                  input={
                    <input
                      className={inputClass}
                      value={form.volume_amount}
                      onChange={(e) => setValue("volume_amount", e.target.value)}
                      placeholder="Ej: 3500000"
                    />
                  }
                />
                <Field
                  label="Valor contado"
                  helperText="Base neta inmediata para comision."
                  input={
                    <input
                      className={inputClass}
                      value={form.cash_amount}
                      onChange={(e) => setValue("cash_amount", e.target.value)}
                      placeholder="Ej: 2000000"
                    />
                  }
                />
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <Field
                  label="Valor cartera"
                  helperText="Si lo dejas vacio, se calcula automaticamente con base en total - contado."
                  input={
                    <input
                      className={inputClass}
                      value={form.portfolio_amount}
                      onChange={(e) => setValue("portfolio_amount", e.target.value)}
                      placeholder="Ej: 1500000"
                    />
                  }
                />
                <Field
                  label="Notas comerciales"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y`}
                      value={form.commercial_notes}
                      onChange={(e) => setValue("commercial_notes", e.target.value)}
                      placeholder="Cierre, observaciones, detalle de venta..."
                    />
                  }
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[26px] border border-[#D7E8DC] bg-[#F6FBF7] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#698473]">
                    Preview de comision
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-[#698473]">Origen</p>
                      <p className="mt-1 text-base font-semibold text-[#24312A]">
                        {leadOriginLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#698473]">Fuente</p>
                      <p className="mt-1 text-base font-semibold text-[#24312A]">
                        {commissionLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#698473]">Responsable</p>
                        <p className="mt-1 text-base font-semibold text-[#24312A]">
                          {selectedSourceUser
                            ? formatRoleUserLabel(selectedSourceUser)
                            : "Sin definir"}
                        </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#698473]">Comercial</p>
                        <p className="mt-1 text-base font-semibold text-[#24312A]">
                          {selectedCommercialUser
                            ? formatRoleUserLabel(selectedCommercialUser)
                            : "Sin asignar"}
                        </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#698473]">Base neta</p>
                      <p className="mt-1 text-base font-semibold text-[#24312A]">
                        {formatMoneyPreview(Math.max(0, calculatedCash))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-[#698473]">Base bono</p>
                      <p className="mt-1 text-base font-semibold text-[#24312A]">
                        {formatMoneyPreview(Math.max(0, calculatedVolume))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-[#D7E8DC] bg-[#FFFDF7] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8B7A4E]">
                    Nutricion e inventario
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-[#5C7568]">
                    <li>
                      Si marcas nutricion pendiente, el caso se guarda pero la
                      historia clinica queda para que la complete el area de
                      nutricion despues.
                    </li>
                    <li>
                      Si registras entrega, el descuento se hace sobre el
                      inventario local del navegador donde cargas el historico.
                    </li>
                    <li>
                      Si no hubo venta real, deja la venta desactivada para no
                      contaminar comisiones ni bonos.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <section className={cardClass}>
            <SectionTitle
              eyebrow="Entrega"
              title="Inventario y entrega historica"
              description="Solo usalo si de verdad ya hubo producto entregado y quieres reflejar la salida en inventario local del CRM."
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <ToggleCard
                checked={form.has_delivery}
                title="Registrar entrega"
                description="Descuenta inventario local y guarda una salida historica."
                onChange={(checked) => setValue("has_delivery", checked)}
              />
            </div>

            {form.has_delivery ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <Field
                  label="Producto"
                  input={
                    <input
                      className={inputClass}
                      value={form.delivery_product}
                      onChange={(e) => setValue("delivery_product", e.target.value)}
                      placeholder="Ej: Detox 7 dias"
                    />
                  }
                />
                <Field
                  label="Cantidad"
                  input={
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={form.delivery_quantity}
                      onChange={(e) => setValue("delivery_quantity", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Fecha de entrega"
                  input={
                    <input
                      type="date"
                      className={inputClass}
                      value={form.delivery_date}
                      onChange={(e) => setValue("delivery_date", e.target.value)}
                    />
                  }
                />
                <Field
                  label="Notas de entrega"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y`}
                      value={form.delivery_notes}
                      onChange={(e) => setValue("delivery_notes", e.target.value)}
                      placeholder="Ej: Entregado completo al cierre comercial"
                    />
                  }
                />
              </div>
            ) : null}
          </section>

          <section className={cardClass}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#66826F]">
                  Confirmacion final
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#24312A]">
                  Guardar carga historica
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5C7568]">
                  El sistema creara el lead y, segun lo que actives, dejara la
                  cita, el caso comercial y la salida de inventario con fechas
                  reales. La historia clinica de nutricion no se inventa.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setForm(initialForm());
                  }}
                  className="inline-flex rounded-full border border-[#CFE4D8] bg-white px-5 py-3 text-sm font-semibold text-[#365243] shadow-sm transition hover:border-[#7FA287]"
                >
                  Limpiar formulario
                </button>
                <button
                  type="submit"
                  disabled={saving || loadingOptions}
                  className="inline-flex rounded-full bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_48%,_#5F7D66_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_34px_rgba(63,105,82,0.28)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar carga historica"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}
