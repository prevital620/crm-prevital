"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { useSearchParams } from "next/navigation";

type LeadOption = {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  phone: string;
  city: string | null;
  status: string;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  patient_name: string;
  phone: string | null;
  city: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
  checked_in_at: string | null;
  attended_at: string | null;
};

type AgendaDaySetting = {
  agenda_date: string;
  daily_capacity: number | null;
  is_closed: boolean;
};

type AgendaSlotSetting = {
  agenda_date: string;
  slot_time: string;
  capacity: number | null;
  is_blocked: boolean;
};

type SlotOption = {
  value: string;
  label: string;
};

type ReceptionSection = "agenda" | "especialistas" | "tratamientos" | "impresiones" | "inventario" | "comercial";

type DeliveryLog = {
  id: string;
  patient_name: string;
  phone: string;
  product: string;
  quantity: number;
  notes: string;
  created_at: string;
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
  notes: string;
  created_at: string;
};

type CommercialCaseRow = {
  id: string;
  lead_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  phone: string | null;
  city: string | null;
  assigned_commercial_user_id: string | null;
  assigned_by_user_id: string | null;
  assigned_at: string | null;
  status: string;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  created_at: string;
};

type CommercialDisqualifyingKey =
  | "stent"
  | "corazon_abierto"
  | "tratamiento_internista"
  | "oncologico_tratamiento"
  | "anticoagulado"
  | "psiquiatrico"
  | "cateterismo"
  | "dialisis";

type CommercialDisqualifyingFlags = Record<CommercialDisqualifyingKey, boolean>;

const allowedRoles = [
  "super_user",
  "recepcion",
  "tmk",
  "confirmador",
  "supervisor_call_center",
];

const appointmentStatusOptions = [
  { value: "agendada", label: "Agendada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "en_espera", label: "En espera" },
  { value: "asistio", label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
  { value: "reagendada", label: "Reagendada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "en_atencion", label: "En atención" },
  { value: "finalizada", label: "Finalizada" },
];

const generalServiceOptions = [
  { value: "valoracion", label: "Valoración" },
  { value: "otro", label: "Otro" },
];

const specialistOptions = [
  { value: "nutricion", label: "Nutrición" },
  { value: "medico", label: "Médico" },
];

const treatmentOptions = [
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "detox", label: "Detox" },
];

const commercialDisqualifyingOptions: Array<{
  key: CommercialDisqualifyingKey;
  label: string;
}> = [
  { key: "stent", label: "Stent" },
  { key: "corazon_abierto", label: "Corazón abierto" },
  { key: "tratamiento_internista", label: "Tratamiento con internista" },
  { key: "oncologico_tratamiento", label: "Oncológico en tratamiento" },
  { key: "anticoagulado", label: "Anticoagulado" },
  { key: "psiquiatrico", label: "Psiquiátrico" },
  { key: "cateterismo", label: "Cateterismo" },
  { key: "dialisis", label: "Diálisis" },
];


const commercialOccupationOptions = [
  { value: "empleado", label: "Empleado" },
  { value: "independiente", label: "Independiente" },
  { value: "pensionado", label: "Pensionado" },
  { value: "desempleado", label: "Desempleado" },
  { value: "estudiante", label: "Estudiante" },
  { value: "empleado_salud", label: "Empleado de la salud" },
  { value: "otro", label: "Otro" },
];

const commercialOccupationDisqualifyingValues = new Set([
  "desempleado",
  "estudiante",
  "empleado_salud",
]);

const commercialOccupationOtherDisqualifyingTerms = [
  "desempleado",
  "estudiante",
  "empleado de la salud",
  "empleado salud",
  "salud",
];

function traducirOcupacionComercial(value: string, otherValue?: string) {
  if (value === "otro") {
    return otherValue?.trim() || "Otro";
  }

  const found = commercialOccupationOptions.find((item) => item.value === value);
  return found?.label || value || "";
}

const emptyCommercialDisqualifyingFlags = (): CommercialDisqualifyingFlags => ({
  stent: false,
  corazon_abierto: false,
  tratamiento_internista: false,
  oncologico_tratamiento: false,
  anticoagulado: false,
  psiquiatrico: false,
  cateterismo: false,
  dialisis: false,
});

const specialistValues = new Set(specialistOptions.map((item) => item.value));
const treatmentValues = new Set(treatmentOptions.map((item) => item.value));

function getSectionForService(serviceType: string | null | undefined): ReceptionSection {
  const value = (serviceType || "").trim().toLowerCase();
  if (specialistValues.has(value)) return "especialistas";
  if (treatmentValues.has(value)) return "tratamientos";
  return "agenda";
}

function getSectionLabel(section: ReceptionSection) {
  if (section === "especialistas") return "Especialistas";
  if (section === "tratamientos") return "Tratamientos";
  if (section === "impresiones") return "Impresiones y entregas";
  if (section === "inventario") return "Inventario";
  if (section === "comercial") return "Ingreso comercial";
  return "Agenda";
}

function getServiceFieldLabel(section: ReceptionSection) {
  if (section === "especialistas") return "Especialista";
  if (section === "tratamientos") return "Tratamiento";
  if (section === "impresiones" || section === "inventario" || section === "comercial") return "Servicio";
  return "Servicio";
}

function getServiceOptionsBySection(section: ReceptionSection) {
  if (section === "especialistas") return specialistOptions;
  if (section === "tratamientos") return treatmentOptions;
  if (section === "impresiones" || section === "inventario" || section === "comercial") return [];
  return generalServiceOptions;
}

const manualSourceOptions = [
  { value: "lead_existente", label: "Lead existente" },
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "redes", label: "Redes" },
  { value: "referido", label: "Referido" },
  { value: "lugar", label: "Lugar" },
  { value: "evento", label: "Evento" },
  { value: "cliente_directo", label: "Cliente directo" },
  { value: "otro", label: "Otro" },
];

const SLOT_OPTIONS: SlotOption[] = [
  { value: "08:00", label: "8:00 a. m." },
  { value: "09:00", label: "9:00 a. m." },
  { value: "10:00", label: "10:00 a. m." },
  { value: "11:00", label: "11:00 a. m." },
  { value: "12:00", label: "12:00 m." },
  { value: "13:30", label: "1:30 p. m." },
  { value: "14:30", label: "2:30 p. m." },
  { value: "15:30", label: "3:30 p. m." },
  { value: "16:30", label: "4:30 p. m." },
  { value: "17:30", label: "5:30 p. m." },
];

const ACTIVE_APPOINTMENT_STATUSES = [
  "agendada",
  "confirmada",
  "en_espera",
  "reagendada",
  "en_atencion",
];

const DEFAULT_SLOT_CAPACITY = 6;
const DEFAULT_DAILY_CAPACITY = 60;

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function fullLeadName(lead: LeadOption) {
  return (
    lead.full_name?.trim() ||
    `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
    "Sin nombre"
  );
}

function traducirFuenteManual(value: string) {
  const found = manualSourceOptions.find((item) => item.value === value);
  return found?.label || value || "Sin fuente";
}

function extraerFuenteManualDesdeNotas(notes: string | null | undefined) {
  if (!notes) return "";
  const match = notes.match(/^Fuente:\s*(.+)$/im);
  if (!match?.[1]) return "";

  const normalized = match[1].trim().toLowerCase();
  const found = manualSourceOptions.find(
    (item) => item.value.toLowerCase() === normalized || item.label.toLowerCase() === normalized
  );

  return found?.value || normalized;
}

function limpiarFuenteManualDeNotas(notes: string | null | undefined) {
  if (!notes) return "";

  return notes
    .split("\n")
    .filter((line) => !/^Fuente:\s*/i.test(line.trim()))
    .join("\n")
    .trim();
}

function construirNotasConFuente(notes: string, manualSource: string) {
  const cleanNotes = limpiarFuenteManualDeNotas(notes);
  const sourceLabel = traducirFuenteManual(manualSource);

  if (!manualSource) return cleanNotes;
  if (!cleanNotes) return `Fuente: ${sourceLabel}`;

  return `Fuente: ${sourceLabel}\n${cleanNotes}`;
}


function badgeEstado(status: string) {
  switch (status) {
    case "agendada":
      return "bg-slate-100 text-slate-700";
    case "confirmada":
      return "bg-blue-100 text-blue-700";
    case "en_espera":
      return "bg-amber-100 text-amber-700";
    case "asistio":
      return "bg-emerald-100 text-emerald-700";
    case "no_asistio":
      return "bg-rose-100 text-rose-700";
    case "reagendada":
      return "bg-violet-100 text-violet-700";
    case "cancelada":
      return "bg-red-100 text-red-700";
    case "en_atencion":
      return "bg-cyan-100 text-cyan-700";
    case "finalizada":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function traducirEstado(status: string) {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    en_espera: "En espera",
    asistio: "Asistió",
    no_asistio: "No asistió",
    reagendada: "Reagendada",
    cancelada: "Cancelada",
    en_atencion: "En atención",
    finalizada: "Finalizada",
  };
  return map[status] || status;
}

function traducirEstadoComercial(status: string | null | undefined) {
  const map: Record<string, string> = {
    pendiente_asignacion_comercial: "Pendiente de asignación",
    asignado_comercial: "Asignado",
    en_atencion_comercial: "En atención",
    seguimiento: "Seguimiento",
    finalizado: "Finalizado",
  };
  return map[status || ""] || status || "Sin estado";
}

function badgeEstadoComercial(status: string | null | undefined) {
  switch (status) {
    case "pendiente_asignacion_comercial":
      return "bg-amber-100 text-amber-700";
    case "asignado_comercial":
      return "bg-blue-100 text-blue-700";
    case "en_atencion_comercial":
      return "bg-cyan-100 text-cyan-700";
    case "seguimiento":
      return "bg-violet-100 text-violet-700";
    case "finalizado":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function calcularClasificacionInicial(values: {
  edad: string;
  tiene_eps: string;
  afiliacion: string;
  trae_cedula: string;
  celular_inteligente: string;
  ocupacion: string;
  ocupacion_otro?: string;
  condiciones_descalificantes: CommercialDisqualifyingFlags;
}) {
  const motivos: string[] = [];
  const edad = Number(values.edad || "0");
  const tieneCondicionDescalificante = Object.values(values.condiciones_descalificantes).some(Boolean);
  const ocupacionOtroNormalizada = (values.ocupacion_otro || "").trim().toLowerCase();
  const ocupacionDescalificante =
    values.ocupacion === "otro" ||
    commercialOccupationDisqualifyingValues.has(values.ocupacion) ||
    (values.ocupacion === "otro" &&
      commercialOccupationOtherDisqualifyingTerms.some((term) =>
        ocupacionOtroNormalizada.includes(term)
      ));

  if (!edad || Number.isNaN(edad) || edad < 40 || edad > 69) {
    motivos.push("edad fuera del rango de 40 a 69 años");
  }

  if (values.tiene_eps !== "si") {
    motivos.push("no tiene EPS");
  }

  if (values.afiliacion !== "cotizante") {
    motivos.push("no es cotizante");
  }

  if (values.trae_cedula !== "si") {
    motivos.push("no asiste con cédula");
  }

  if (values.celular_inteligente !== "si") {
    motivos.push("no tiene celular inteligente");
  }

  if (ocupacionDescalificante) {
    motivos.push("ocupación descalificante");
  }

  if (tieneCondicionDescalificante) {
    motivos.push("presenta condición descalificante");
  }

  return {
    clasificacion: motivos.length === 0 ? "Q" : "No Q",
    motivo:
      motivos.length === 0
        ? "Q inicial: cumple todos los criterios base."
        : `No Q por ${motivos.join(", ")}.`,
  };
}

function normalizarHora(value: string) {
  return value.slice(0, 5);
}

function RecepcionContent() {
  const searchParams = useSearchParams();
  const leadIdFromUrl = searchParams.get("leadId");

  const [authorized, setAuthorized] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);

  const [fechaFiltro, setFechaFiltro] = useState("");
  const [busquedaAgenda, setBusquedaAgenda] = useState("");
  const [busquedaLead, setBusquedaLead] = useState("");

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  const [daySettings, setDaySettings] = useState<Record<string, AgendaDaySetting>>({});
  const [slotSettings, setSlotSettings] = useState<Record<string, AgendaSlotSetting>>({});
  const [dailyCapacityInput, setDailyCapacityInput] = useState(String(DEFAULT_DAILY_CAPACITY));
  const [dailyClosedInput, setDailyClosedInput] = useState(false);
  const [slotCapacityInputs, setSlotCapacityInputs] = useState<Record<string, string>>({});
  const [slotBlockedInputs, setSlotBlockedInputs] = useState<Record<string, boolean>>({});

  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedQuickAppointmentId, setSelectedQuickAppointmentId] = useState<string | null>(null);
  const [selectedCommercialAppointmentId, setSelectedCommercialAppointmentId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ReceptionSection>("agenda");
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [printSearch, setPrintSearch] = useState("");
  const [deliveryProduct, setDeliveryProduct] = useState("");
  const [deliveryQuantity, setDeliveryQuantity] = useState("1");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryProductId, setInventoryProductId] = useState("");
  const [inventoryNewProduct, setInventoryNewProduct] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("nutraceutico");
  const [inventoryMovementType, setInventoryMovementType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [inventoryQuantity, setInventoryQuantity] = useState("1");
  const [inventoryMinStock, setInventoryMinStock] = useState("5");
  const [inventoryMovementNotes, setInventoryMovementNotes] = useState("");
  const [commercialCases, setCommercialCases] = useState<CommercialCaseRow[]>([]);
  const [savingCommercialIntake, setSavingCommercialIntake] = useState(false);
  const [commercialSearch, setCommercialSearch] = useState("");
  const [commercialForm, setCommercialForm] = useState({
    customer_name: "",
    phone: "",
    city: "",
    documento: "",
    fuente: "",
    observaciones: "",
    tiene_eps: "si",
    afiliacion: "",
    ocupacion: "",
    ocupacion_otro: "",
    edad: "",
    trae_cedula: "si",
    celular_inteligente: "si",
    condiciones_descalificantes: emptyCommercialDisqualifyingFlags(),
    clasificacion_inicial: "No Q",
    clasificacion_motivo: "",
    referido_por: "",
  });

  const [form, setForm] = useState({
    mode: leadIdFromUrl ? "lead" : "lead",
    lead_id: "",
    patient_name: "",
    phone: "",
    city: "",
    manual_source: "",
    appointment_date: hoyISO(),
    appointment_time: "08:00",
    status: "agendada",
    service_type: "",
    notes: "",
  });

  const isReadOnlyAgendaForCall =
    currentRoleCode === "tmk" || currentRoleCode === "confirmador";

  const serviceOptions = useMemo(() => getServiceOptionsBySection(activeSection), [activeSection]);
  const serviceFieldLabel = useMemo(() => getServiceFieldLabel(activeSection), [activeSection]);
  const sectionLabel = useMemo(() => getSectionLabel(activeSection), [activeSection]);

  const canManageAgendaConfig =
    currentRoleCode === "super_user" || currentRoleCode === "supervisor_call_center";

  useEffect(() => {
    const resultado = calcularClasificacionInicial({
      edad: commercialForm.edad,
      tiene_eps: commercialForm.tiene_eps,
      afiliacion: commercialForm.afiliacion,
      trae_cedula: commercialForm.trae_cedula,
      celular_inteligente: commercialForm.celular_inteligente,
      ocupacion: commercialForm.ocupacion,
      ocupacion_otro: commercialForm.ocupacion_otro,
      condiciones_descalificantes: commercialForm.condiciones_descalificantes,
    });

    setCommercialForm((prev) =>
      prev.clasificacion_inicial === resultado.clasificacion &&
      prev.clasificacion_motivo === resultado.motivo
        ? prev
        : {
            ...prev,
            clasificacion_inicial: resultado.clasificacion,
            clasificacion_motivo: resultado.motivo,
          }
    );
  }, [
    commercialForm.edad,
    commercialForm.tiene_eps,
    commercialForm.afiliacion,
    commercialForm.trae_cedula,
    commercialForm.celular_inteligente,
    commercialForm.ocupacion,
    commercialForm.ocupacion_otro,
    commercialForm.condiciones_descalificantes,
  ]);

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
        setError("No tienes permiso para entrar a Recepción.");
        return;
      }

      setAuthorized(true);
      setCurrentUserId(auth.user.id);
      setCurrentRoleCode(auth.roleCode);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function cargarTodo() {
    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const [
        appointmentsResult,
        leadsResult,
        daySettingsResult,
        slotSettingsResult,
        commercialCasesResult,
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            id,
            lead_id,
            patient_name,
            phone,
            city,
            appointment_date,
            appointment_time,
            status,
            service_type,
            notes,
            checked_in_at,
            attended_at
          `)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true }),

        supabase
          .from("leads")
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            phone,
            city,
            status
          `)
          .order("created_at", { ascending: false })
          .limit(300),

        supabase
          .from("agenda_day_settings")
          .select("agenda_date, daily_capacity, is_closed"),

        supabase
          .from("agenda_slot_settings")
          .select("agenda_date, slot_time, capacity, is_blocked"),

        supabase
          .from("commercial_cases")
          .select(`
            id,
            lead_id,
            appointment_id,
            customer_name,
            phone,
            city,
            assigned_commercial_user_id,
            assigned_by_user_id,
            assigned_at,
            status,
            sale_result,
            purchased_service,
            sale_value,
            created_at
          `)
          .order("created_at", { ascending: false }),
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (daySettingsResult.error) throw daySettingsResult.error;
      if (slotSettingsResult.error) throw slotSettingsResult.error;
      if (commercialCasesResult.error) throw commercialCasesResult.error;

      const appointmentsData = (appointmentsResult.data as AppointmentRow[]) || [];
      const leadsData = (leadsResult.data as LeadOption[]) || [];
      const dayRows = (daySettingsResult.data as AgendaDaySetting[]) || [];
      const slotRows = (slotSettingsResult.data as AgendaSlotSetting[]) || [];
      const commercialCasesData = (commercialCasesResult.data as CommercialCaseRow[]) || [];

      const hoy = hoyISO();
      const staleAppointments = appointmentsData.filter((item) => {
        const hasCommercialRecord = commercialCasesData.some(
          (caseItem) => caseItem.appointment_id === item.id
        );

        return (
          item.appointment_date < hoy &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
          !hasCommercialRecord
        );
      });

      if (staleAppointments.length > 0) {
        const staleIds = staleAppointments.map((item) => item.id);
        const { error: staleError } = await supabase
          .from("appointments")
          .update({
            status: "no_asistio",
            updated_by_user_id: currentUserId,
          })
          .in("id", staleIds);

        if (staleError) throw staleError;

        for (const staleItem of staleAppointments) {
          if (staleItem.lead_id) {
            await actualizarEstadoLeadPorCita(staleItem.lead_id, "no_asistio");
          }
        }

        staleAppointments.forEach((item) => {
          item.status = "no_asistio";
        });
      }

      const nextStatuses: Record<string, string> = {};
      appointmentsData.forEach((item) => {
        nextStatuses[item.id] = item.status;
      });

      const dayMap: Record<string, AgendaDaySetting> = {};
      dayRows.forEach((row) => {
        dayMap[row.agenda_date] = row;
      });

      const slotMap: Record<string, AgendaSlotSetting> = {};
      slotRows.forEach((row) => {
        slotMap[`${row.agenda_date}_${normalizarHora(row.slot_time)}`] = {
          ...row,
          slot_time: normalizarHora(row.slot_time),
        };
      });

      setAppointments(appointmentsData);
      setLeads(leadsData);
      setStatusById(nextStatuses);
      setDaySettings(dayMap);
      setSlotSettings(slotMap);
      setCommercialCases(commercialCasesData);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de recepción.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      cargarTodo();
    }
  }, [authorized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("recepcion_delivery_logs");
      if (!raw) return;
      const parsed = JSON.parse(raw) as DeliveryLog[];
      if (Array.isArray(parsed)) {
        setDeliveryLogs(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawItems = window.localStorage.getItem("recepcion_inventory_items");
      const rawMovements = window.localStorage.getItem("recepcion_inventory_movements");

      if (rawItems) {
        const parsedItems = JSON.parse(rawItems) as InventoryItem[];
        if (Array.isArray(parsedItems)) {
          setInventoryItems(parsedItems);
        }
      }

      if (rawMovements) {
        const parsedMovements = JSON.parse(rawMovements) as InventoryMovement[];
        if (Array.isArray(parsedMovements)) {
          setInventoryMovements(parsedMovements);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!leadIdFromUrl || leads.length === 0) return;

    const selectedLead = leads.find((item) => item.id === leadIdFromUrl);
    if (!selectedLead) return;

    setForm((prev) => ({
      ...prev,
      mode: "lead",
      lead_id: selectedLead.id,
      patient_name: fullLeadName(selectedLead),
      phone: selectedLead.phone || "",
      city: selectedLead.city || "",
    }));
  }, [leadIdFromUrl, leads]);

  useEffect(() => {
    if (!form.lead_id) return;

    const selectedLead = leads.find((item) => item.id === form.lead_id);
    if (!selectedLead) return;

    setForm((prev) => ({
      ...prev,
      patient_name: fullLeadName(selectedLead),
      phone: selectedLead.phone || "",
      city: selectedLead.city || "",
    }));
  }, [form.lead_id, leads]);

  function cambiarSeccion(section: ReceptionSection) {
    setActiveSection(section);
    setEditingAppointmentId(null);
    setSelectedQuickAppointmentId(null);
    setMensaje("");
    setError("");
    setForm((prev) => ({
      ...prev,
      service_type: "",
    }));
  }

  function appointmentMatchesActiveSection(item: AppointmentRow) {
    return getSectionForService(item.service_type) === activeSection;
  }

  useEffect(() => {
    const daySetting = daySettings[form.appointment_date];
    setDailyCapacityInput(
      String(daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY)
    );
    setDailyClosedInput(daySetting?.is_closed ?? false);

    const nextCaps: Record<string, string> = {};
    const nextBlocked: Record<string, boolean> = {};

    SLOT_OPTIONS.forEach((slot) => {
      const key = `${form.appointment_date}_${slot.value}`;
      const row = slotSettings[key];
      nextCaps[slot.value] = String(row?.capacity ?? DEFAULT_SLOT_CAPACITY);
      nextBlocked[slot.value] = row?.is_blocked ?? false;
    });

    setSlotCapacityInputs(nextCaps);
    setSlotBlockedInputs(nextBlocked);
  }, [form.appointment_date, daySettings, slotSettings]);

  const appointmentsForSelectedDate = useMemo(() => {
    return appointments.filter(
      (item) => item.appointment_date === form.appointment_date && appointmentMatchesActiveSection(item)
    );
  }, [appointments, form.appointment_date, activeSection]);

  const activeAppointmentsForSelectedDate = useMemo(() => {
    return appointmentsForSelectedDate.filter((item) =>
      ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
    );
  }, [appointmentsForSelectedDate]);

  const leadsConCitaActiva = useMemo(() => {
    const ids = new Set<string>();
    appointments.forEach((item) => {
      if (
        item.lead_id &&
        ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
        item.id !== editingAppointmentId
      ) {
        ids.add(item.lead_id);
      }
    });
    return ids;
  }, [appointments, editingAppointmentId]);

  const leadsFiltrados = useMemo(() => {
    const q = busquedaLead.trim().toLowerCase();

    const base = leads.filter((lead) => {
      if (editingAppointmentId && lead.id === form.lead_id) return true;
      return !leadsConCitaActiva.has(lead.id);
    });

    if (!q) return base.slice(0, 20);

    return base
      .filter((lead) => {
        const nombre = fullLeadName(lead).toLowerCase();
        const telefono = (lead.phone || "").toLowerCase();
        return nombre.includes(q) || telefono.includes(q);
      })
      .slice(0, 20);
  }, [leads, busquedaLead, leadsConCitaActiva, editingAppointmentId, form.lead_id]);

  const agendaFiltrada = useMemo(() => {
    const q = busquedaAgenda.trim().toLowerCase();

    return appointments
      .filter((item) => {
        const fechaOk = fechaFiltro ? item.appointment_date === fechaFiltro : true;
        const nombre = (item.patient_name || "").toLowerCase();
        const telefono = (item.phone || "").toLowerCase();
        const busquedaOk = q ? nombre.includes(q) || telefono.includes(q) : true;
        return fechaOk && busquedaOk && appointmentMatchesActiveSection(item);
      })
      .sort((a, b) => {
        if (a.appointment_date !== b.appointment_date) {
          return a.appointment_date.localeCompare(b.appointment_date);
        }
        return normalizarHora(a.appointment_time).localeCompare(normalizarHora(b.appointment_time));
      });
  }, [appointments, fechaFiltro, busquedaAgenda, activeSection]);

  const resumen = useMemo(() => {
    const delDia = appointments.filter((item) => (fechaFiltro ? item.appointment_date === fechaFiltro : true) && appointmentMatchesActiveSection(item));

    return {
      total: delDia.length,
      agendadas: delDia.filter((x) => x.status === "agendada").length,
      espera: delDia.filter((x) => x.status === "en_espera").length,
      asistio: delDia.filter((x) => x.status === "asistio").length,
      noAsistio: delDia.filter((x) => x.status === "no_asistio").length,
    };
  }, [appointments, fechaFiltro, activeSection]);

  const selectedDaySetting = daySettings[form.appointment_date];
  const selectedDateDailyCapacity =
    selectedDaySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY;
  const selectedDateClosed = selectedDaySetting?.is_closed ?? false;
  const selectedDateActiveTotal = activeAppointmentsForSelectedDate.length;

  const slotAvailability = useMemo(() => {
    return SLOT_OPTIONS.map((slot) => {
      const key = `${form.appointment_date}_${slot.value}`;
      const setting = slotSettings[key];
      const capacity = setting?.capacity ?? DEFAULT_SLOT_CAPACITY;
      const isBlocked = setting?.is_blocked ?? false;

      const booked = appointmentsForSelectedDate.filter(
        (item) =>
          normalizarHora(item.appointment_time) === slot.value &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
          item.id !== editingAppointmentId
      ).length;

      const dailyRemaining = Math.max(
        selectedDateDailyCapacity - selectedDateActiveTotal,
        0
      );

      const isFullBySlot = booked >= capacity;
      const isFullByDay =
        selectedDateActiveTotal >= selectedDateDailyCapacity &&
        !editingAppointmentId;
      const disabled = selectedDateClosed || isBlocked || isFullBySlot || isFullByDay;

      return {
        ...slot,
        capacity,
        booked,
        disabled,
        isBlocked,
        isFullBySlot,
        isFullByDay,
      };
    });
  }, [
    appointmentsForSelectedDate,
    slotSettings,
    form.appointment_date,
    selectedDateClosed,
    selectedDateDailyCapacity,
    selectedDateActiveTotal,
    editingAppointmentId,
  ]);


  const printCandidates = useMemo(() => {
    const merged = [
      ...appointments.map((item) => ({
        id: `appointment_${item.id}`,
        patient_name: item.patient_name || "Sin nombre",
        phone: item.phone || "",
        city: item.city || "",
        source: item.lead_id ? "Lead existente" : traducirFuenteManual(extraerFuenteManualDesdeNotas(item.notes)),
        detail:
          item.appointment_date && item.appointment_time
            ? `${item.appointment_date} · ${formatHora(item.appointment_time)}`
            : "Sin cita",
        service_type: item.service_type || "",
        notes: limpiarFuenteManualDeNotas(item.notes),
      })),
      ...leads.map((lead) => ({
        id: `lead_${lead.id}`,
        patient_name: fullLeadName(lead),
        phone: lead.phone || "",
        city: lead.city || "",
        source: "Lead existente",
        detail: lead.status ? `Lead · ${lead.status}` : "Lead",
        service_type: "",
        notes: "",
      })),
    ];

    const unique = new Map<string, (typeof merged)[number]>();
    merged.forEach((item) => {
      const key = `${item.patient_name.toLowerCase()}_${item.phone}`;
      if (!unique.has(key)) unique.set(key, item);
    });

    const values = Array.from(unique.values());
    const q = printSearch.trim().toLowerCase();
    if (!q) return values.slice(0, 12);

    return values
      .filter((item) => {
        return (
          item.patient_name.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [appointments, leads, printSearch]);

  const selectedPrintPatient = useMemo(() => {
    return printCandidates[0] || null;
  }, [printCandidates]);

  const commercialCasesFiltered = useMemo(() => {
    const q = commercialSearch.trim().toLowerCase();
    const base = [...commercialCases].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (!q) return base;

    return base.filter((item) =>
      (item.customer_name || "").toLowerCase().includes(q) ||
      (item.phone || "").toLowerCase().includes(q)
    );
  }, [commercialCases, commercialSearch]);

  const commercialSummary = useMemo(() => {
    return {
      total: commercialCases.length,
      pendientes: commercialCases.filter((item) => item.status === "pendiente_asignacion_comercial").length,
      asignados: commercialCases.filter((item) => item.status === "asignado_comercial").length,
      atencion: commercialCases.filter((item) => item.status === "en_atencion_comercial").length,
      finalizados: commercialCases.filter((item) => item.status === "finalizado").length,
    };
  }, [commercialCases]);

  function imprimirDocumento(tipo: "cita" | "instrucciones") {
    if (typeof window === "undefined") return;

    const nombre = selectedPrintPatient?.patient_name || "Paciente";
    const telefono = selectedPrintPatient?.phone || "Sin teléfono";
    const ciudad = selectedPrintPatient?.city || "Sin ciudad";
    const detalle = selectedPrintPatient?.detail || "Sin detalle";
    const servicio = selectedPrintPatient?.service_type || "Sin servicio";
    const notas = selectedPrintPatient?.notes || "Sin notas registradas";
    const titulo = tipo === "cita" ? "Comprobante de cita" : "Instrucciones";

    const nuevaVentana = window.open("", "_blank", "width=900,height=700");
    if (!nuevaVentana) return;

    nuevaVentana.document.write(`
      <html>
        <head>
          <title>${titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            h1 { margin-bottom: 8px; }
            .box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; margin-top: 20px; }
            .muted { color: #475569; margin: 6px 0; }
          </style>
        </head>
        <body>
          <h1>${titulo}</h1>
          <p class="muted">CRM Prevital · Recepción</p>
          <div class="box">
            <p><strong>Cliente:</strong> ${nombre}</p>
            <p><strong>Teléfono:</strong> ${telefono}</p>
            <p><strong>Ciudad:</strong> ${ciudad}</p>
            <p><strong>Detalle:</strong> ${detalle}</p>
            <p><strong>Servicio:</strong> ${servicio}</p>
            <p><strong>Notas:</strong> ${notas}</p>
          </div>
        </body>
      </html>
    `);
    nuevaVentana.document.close();
    nuevaVentana.focus();
    nuevaVentana.print();
  }

  function registrarEntregaLocal() {
    if (!selectedPrintPatient) {
      setError("Debes buscar un cliente para registrar la entrega.");
      return;
    }

    if (!deliveryProduct.trim()) {
      setError("Debes escribir el nutracéutico o producto entregado.");
      return;
    }

    const quantity = Number(deliveryQuantity || "0");
    if (!quantity || quantity < 1) {
      setError("La cantidad debe ser mayor que cero.");
      return;
    }

    const nuevo: DeliveryLog = {
      id: `${Date.now()}`,
      patient_name: selectedPrintPatient.patient_name,
      phone: selectedPrintPatient.phone,
      product: deliveryProduct.trim(),
      quantity,
      notes: deliveryNotes.trim(),
      created_at: new Date().toISOString(),
    };

    const next = [nuevo, ...deliveryLogs].slice(0, 30);
    setDeliveryLogs(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("recepcion_delivery_logs", JSON.stringify(next));
    }

    setDeliveryProduct("");
    setDeliveryQuantity("1");
    setDeliveryNotes("");
    setMensaje("Entrega registrada correctamente en este dispositivo.");
    setError("");
  }

  const inventoryFilteredItems = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const base = [...inventoryItems].sort((a, b) => a.name.localeCompare(b.name));

    if (!q) return base;

    return base.filter((item) =>
      item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [inventoryItems, inventorySearch]);

  const inventoryRecentMovements = useMemo(() => {
    return [...inventoryMovements]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [inventoryMovements]);

  function getInventoryStatus(item: InventoryItem) {
    if (item.stock <= 0) {
      return { label: "Agotado", className: "bg-red-100 text-red-700" };
    }

    if (item.stock <= item.min_stock) {
      return { label: "Bajo", className: "bg-amber-100 text-amber-700" };
    }

    return { label: "Normal", className: "bg-emerald-100 text-emerald-700" };
  }

  function registrarMovimientoInventario() {
    const quantity = Number(inventoryQuantity || "0");
    if (!quantity || quantity < 1) {
      setError("La cantidad del movimiento debe ser mayor que cero.");
      return;
    }

    let selectedItem = inventoryItems.find((item) => item.id === inventoryProductId);

    if (!selectedItem && !inventoryNewProduct.trim()) {
      setError("Debes seleccionar un producto existente o escribir uno nuevo.");
      return;
    }

    const now = new Date().toISOString();
    const nextItems = [...inventoryItems];
    let productId = inventoryProductId;
    let productName = selectedItem?.name || inventoryNewProduct.trim();

    if (!selectedItem && inventoryNewProduct.trim()) {
      const nuevoItem: InventoryItem = {
        id: `${Date.now()}`,
        name: inventoryNewProduct.trim(),
        category: inventoryCategory.trim() || "General",
        stock: 0,
        min_stock: Number(inventoryMinStock || "5") || 5,
        updated_at: now,
      };
      nextItems.unshift(nuevoItem);
      selectedItem = nuevoItem;
      productId = nuevoItem.id;
      productName = nuevoItem.name;
    }

    if (!selectedItem) {
      setError("No se pudo identificar el producto.");
      return;
    }

    const updatedItems = nextItems.map((item) => {
      if (item.id !== selectedItem!.id) return item;

      let nextStock = item.stock;
      if (inventoryMovementType === "entrada") nextStock = item.stock + quantity;
      if (inventoryMovementType === "salida") nextStock = Math.max(item.stock - quantity, 0);
      if (inventoryMovementType === "ajuste") nextStock = quantity;

      return {
        ...item,
        stock: nextStock,
        min_stock:
          item.id === selectedItem!.id && inventoryNewProduct.trim()
            ? Number(inventoryMinStock || "5") || 5
            : item.min_stock,
        updated_at: now,
      };
    });

    const nuevoMovimiento: InventoryMovement = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      product_id: productId,
      product_name: productName,
      type: inventoryMovementType,
      quantity,
      notes: inventoryMovementNotes.trim(),
      created_at: now,
    };

    const nextMovements = [nuevoMovimiento, ...inventoryMovements].slice(0, 100);

    setInventoryItems(updatedItems);
    setInventoryMovements(nextMovements);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("recepcion_inventory_items", JSON.stringify(updatedItems));
      window.localStorage.setItem("recepcion_inventory_movements", JSON.stringify(nextMovements));
    }

    setInventoryProductId("");
    setInventoryNewProduct("");
    setInventoryQuantity("1");
    setInventoryMovementNotes("");
    setInventoryCategory("nutraceutico");
    setInventoryMinStock("5");
    setMensaje("Movimiento de inventario registrado correctamente.");
    setError("");
  }


  function resetCommercialForm() {
    setSelectedCommercialAppointmentId(null);
    setCommercialForm({
      customer_name: "",
      phone: "",
      city: "",
      documento: "",
      fuente: "",
      observaciones: "",
      tiene_eps: "si",
      afiliacion: "",
      ocupacion: "",
      ocupacion_otro: "",
      edad: "",
      trae_cedula: "si",
      celular_inteligente: "si",
      condiciones_descalificantes: emptyCommercialDisqualifyingFlags(),
      clasificacion_inicial: "No Q",
      clasificacion_motivo: "",
      referido_por: "",
    });
  }

  async function registrarIngresoComercial(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) return;

    setSavingCommercialIntake(true);
    setError("");
    setMensaje("");

    try {
      if (!commercialForm.customer_name.trim()) {
        throw new Error("Debes escribir el nombre del cliente.");
      }

      if (!commercialForm.phone.trim()) {
        throw new Error("Debes escribir el teléfono del cliente.");
      }

      const yaExiste = commercialCases.find(
        (item) =>
          (
            (selectedCommercialAppointmentId && item.appointment_id === selectedCommercialAppointmentId) ||
            (!selectedCommercialAppointmentId && (item.phone || "").trim() === commercialForm.phone.trim())
          ) &&
          ["pendiente_asignacion_comercial", "asignado_comercial", "en_atencion_comercial"].includes(item.status)
      );

      if (yaExiste) {
        throw new Error("Ese cliente ya tiene un ingreso comercial activo.");
      }

      const clasificacion = commercialForm.clasificacion_inicial || "No Q";
      const ocupacionLabel = traducirOcupacionComercial(commercialForm.ocupacion, commercialForm.ocupacion_otro);

      try {
        const identifier = commercialForm.documento.trim() || commercialForm.phone.trim();
        const { data: existingUsers } = await supabase
          .from("users")
          .select("id")
          .or(`documento.eq.${commercialForm.documento.trim() || "___sin_documento___"},telefono.eq.${commercialForm.phone.trim()}`)
          .limit(1);

        if (existingUsers && existingUsers.length > 0) {
          await supabase
            .from("users")
            .update({
              nombre: commercialForm.customer_name.trim(),
              documento: commercialForm.documento.trim() || null,
              telefono: commercialForm.phone.trim() || null,
              ciudad: commercialForm.city.trim() || null,
              ocupacion: ocupacionLabel || null,
              estado_actual: "pendiente valoracion",
              clasificacion_inicial: clasificacion,
              clasificacion_final: clasificacion,
              incentivo: commercialForm.fuente || null,
            })
            .eq("id", existingUsers[0].id);
        } else if (identifier) {
          await supabase.from("users").insert([
            {
              nombre: commercialForm.customer_name.trim(),
              documento: commercialForm.documento.trim() || null,
              telefono: commercialForm.phone.trim() || null,
              ciudad: commercialForm.city.trim() || null,
              ocupacion: ocupacionLabel || null,
              estado_actual: "pendiente valoracion",
              clasificacion_inicial: clasificacion,
              clasificacion_final: clasificacion,
              incentivo: commercialForm.fuente || null,
            },
          ]);
        }
      } catch (syncErr) {
        console.warn("No se pudo sincronizar ficha base del usuario", syncErr);
      }

      const condicionesMarcadas = commercialDisqualifyingOptions
        .filter((item) => commercialForm.condiciones_descalificantes[item.key])
        .map((item) => item.label)
        .join(", ");

      const notesParts = [
        commercialForm.fuente ? `Fuente: ${commercialForm.fuente}` : "",
        `Clasificación inicial: ${clasificacion}`,
        commercialForm.clasificacion_motivo ? `Motivo clasificación: ${commercialForm.clasificacion_motivo}` : "",
        `Tiene EPS: ${commercialForm.tiene_eps === "si" ? "Sí" : "No"}`,
        commercialForm.afiliacion ? `Afiliación: ${commercialForm.afiliacion}` : "",
        `Trae cédula: ${commercialForm.trae_cedula === "si" ? "Sí" : "No"}`,
        `Celular inteligente: ${commercialForm.celular_inteligente === "si" ? "Sí" : "No"}`,
        ocupacionLabel ? `Ocupación: ${ocupacionLabel}` : "",
        commercialForm.edad ? `Edad: ${commercialForm.edad}` : "",
        condicionesMarcadas ? `Condiciones descalificantes: ${condicionesMarcadas}` : "Condiciones descalificantes: Ninguna",
        commercialForm.referido_por ? `Referido por: ${commercialForm.referido_por}` : "",
        commercialForm.observaciones ? `Observaciones recepción: ${commercialForm.observaciones}` : "",
      ].filter(Boolean).join(" | ");

      const appointmentContext = selectedCommercialAppointmentId
        ? appointments.find((item) => item.id === selectedCommercialAppointmentId) || null
        : null;

      if (appointmentContext) {
        const payload: any = {
          status: "asistio",
          attended_at: new Date().toISOString(),
          updated_by_user_id: currentUserId,
        };

        const { error: appointmentError } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", appointmentContext.id);

        if (appointmentError) throw appointmentError;

        if (appointmentContext.lead_id) {
          await actualizarEstadoLeadPorCita(appointmentContext.lead_id, "asistio");
        }
      }

      const { error: insertError } = await supabase.from("commercial_cases").insert([
        {
          lead_id: appointmentContext?.lead_id || null,
          appointment_id: appointmentContext?.id || null,
          customer_name: commercialForm.customer_name.trim(),
          phone: commercialForm.phone.trim(),
          city: commercialForm.city.trim() || null,
          status: "pendiente_asignacion_comercial",
          created_by_user_id: currentUserId,
          updated_by_user_id: currentUserId,
          sale_result: notesParts || null,
        },
      ]);

      if (insertError) throw insertError;

      resetCommercialForm();
      setActiveSection("comercial");
      setMensaje(
        appointmentContext
          ? "Cliente registrado en comercial y la cita quedó como asistió. Ya está disponible para asignación del gerente."
          : "Ingreso comercial registrado correctamente. Ya quedó disponible para asignación del gerente."
      );
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar el ingreso comercial.");
    } finally {
      setSavingCommercialIntake(false);
    }
  }

  function resetForm() {
    setEditingAppointmentId(null);
    setSelectedQuickAppointmentId(null);
    setForm({
      mode: leadIdFromUrl ? "lead" : "lead",
      lead_id: leadIdFromUrl || "",
      patient_name: "",
      phone: "",
      city: "",
      manual_source: "",
      appointment_date: hoyISO(),
      appointment_time: "08:00",
      status: "agendada",
      service_type: "",
      notes: "",
    });
    setBusquedaLead("");
  }

  function cargarCitaParaEditar(item: AppointmentRow) {
    if (isReadOnlyAgendaForCall) return;

    setEditingAppointmentId(item.id);
    setSelectedQuickAppointmentId(item.id);
    setActiveSection(getSectionForService(item.service_type));
    setForm({
      mode: item.lead_id ? "lead" : "manual",
      lead_id: item.lead_id || "",
      patient_name: item.patient_name || "",
      phone: item.phone || "",
      city: item.city || "",
      manual_source: item.lead_id ? "" : extraerFuenteManualDesdeNotas(item.notes),
      appointment_date: item.appointment_date,
      appointment_time: normalizarHora(item.appointment_time),
      status: item.status || "agendada",
      service_type: item.service_type || "",
      notes: limpiarFuenteManualDeNotas(item.notes),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function seleccionarCitaRapida(item: AppointmentRow) {
    setSelectedQuickAppointmentId(item.id);
    setFechaFiltro(item.appointment_date);
    setBusquedaAgenda(item.patient_name || item.phone || "");
  }

  function abrirIngresoComercialDesdeCita(item: AppointmentRow) {
    setSelectedQuickAppointmentId(item.id);
    setSelectedCommercialAppointmentId(item.id);
    setFechaFiltro(item.appointment_date);
    setBusquedaAgenda(item.patient_name || item.phone || "");
    setCommercialForm({
      customer_name: item.patient_name || "",
      phone: item.phone || "",
      city: item.city || "",
      documento: "",
      fuente: item.lead_id ? "lead_existente" : extraerFuenteManualDesdeNotas(item.notes),
      observaciones: limpiarFuenteManualDeNotas(item.notes),
      tiene_eps: "si",
      afiliacion: "",
      ocupacion: "",
      ocupacion_otro: "",
      edad: "",
      trae_cedula: "si",
      celular_inteligente: "si",
      condiciones_descalificantes: emptyCommercialDisqualifyingFlags(),
      clasificacion_inicial: "No Q",
      clasificacion_motivo: "",
      referido_por: "",
    });
    setActiveSection("comercial");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function actualizarEstadoLeadPorCita(
    leadId: string | null,
    appointmentStatus: string
  ) {
    if (!leadId) return;

    let leadStatus = "agendado";

    if (appointmentStatus === "no_asistio") {
      leadStatus = "no_asistio";
    }

    if (appointmentStatus === "cancelada" || appointmentStatus === "finalizada") {
      leadStatus = "contactado";
    }

    const { error } = await supabase
      .from("leads")
      .update({ status: leadStatus })
      .eq("id", leadId);

    if (error) throw error;
  }

  async function guardarConfiguracionAgenda() {
    try {
      setSavingConfig(true);
      setMensaje("");
      setError("");

      const agenda_date = form.appointment_date;

      const { error: dayError } = await supabase
        .from("agenda_day_settings")
        .upsert(
          [
            {
              agenda_date,
              daily_capacity: Number(dailyCapacityInput || DEFAULT_DAILY_CAPACITY),
              is_closed: dailyClosedInput,
            },
          ],
          { onConflict: "agenda_date" }
        );

      if (dayError) throw dayError;

      const slotRows = SLOT_OPTIONS.map((slot) => ({
        agenda_date,
        slot_time: slot.value,
        capacity: Number(slotCapacityInputs[slot.value] || DEFAULT_SLOT_CAPACITY),
        is_blocked: slotBlockedInputs[slot.value] || false,
      }));

      const { error: slotError } = await supabase
        .from("agenda_slot_settings")
        .upsert(slotRows, { onConflict: "agenda_date,slot_time" });

      if (slotError) throw slotError;

      setMensaje("Configuración de agenda guardada correctamente.");
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la configuración de agenda.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function guardarCita(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.patient_name.trim()) {
      setError("Debes indicar el nombre del cliente.");
      return;
    }

    if (form.mode === "manual" && !form.manual_source) {
      setError("Debes seleccionar la fuente cuando la cita es manual.");
      return;
    }

    if (!form.appointment_date) {
      setError("Debes seleccionar la fecha.");
      return;
    }

    if (!form.appointment_time) {
      setError("Debes seleccionar la hora.");
      return;
    }

    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    if ((activeSection === "especialistas" || activeSection === "tratamientos") && !form.service_type.trim()) {
      setError(`Debes seleccionar ${activeSection === "especialistas" ? "un especialista" : "un tratamiento"}.`);
      return;
    }

    if (selectedDateClosed) {
      setError("Ese día está cerrado para agenda.");
      return;
    }

    const selectedSlot = slotAvailability.find(
      (slot) => slot.value === form.appointment_time
    );

    if (!selectedSlot) {
      setError("Debes seleccionar una hora válida.");
      return;
    }

    if (selectedSlot.disabled) {
      setError("Ese horario no está disponible.");
      return;
    }

    if (
      form.mode === "lead" &&
      form.lead_id &&
      appointments.some(
        (item) =>
          item.lead_id === form.lead_id &&
          ACTIVE_APPOINTMENT_STATUSES.includes(item.status) &&
          item.id !== editingAppointmentId
      )
    ) {
      setError("Este lead ya tiene una cita activa. Primero debes cerrar o marcar la cita anterior.");
      return;
    }

    setSavingAppointment(true);

    try {
      const payload = {
        lead_id: form.mode === "lead" ? form.lead_id || null : null,
        patient_name: form.patient_name.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        status: form.status,
        service_type:
          activeSection === "agenda"
            ? "valoracion"
            : form.service_type || null,
        notes:
          form.mode === "manual"
            ? construirNotasConFuente(form.notes, form.manual_source).trim() || null
            : form.notes.trim() || null,
        updated_by_user_id: currentUserId,
      };

      if (editingAppointmentId) {
        const { error } = await supabase
          .from("appointments")
          .update(payload)
          .eq("id", editingAppointmentId);

        if (error) throw error;

        if (payload.lead_id) {
          await actualizarEstadoLeadPorCita(payload.lead_id, payload.status);
        }

        setMensaje("Cita actualizada correctamente.");
      } else {
        const { error } = await supabase.from("appointments").insert([
          {
            ...payload,
            created_by_user_id: currentUserId,
          },
        ]);

        if (error) throw error;

        if (payload.lead_id) {
          await actualizarEstadoLeadPorCita(payload.lead_id, payload.status);
        }

        setMensaje("Cita creada correctamente.");
      }

      resetForm();
      await cargarTodo();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la cita.");
    } finally {
      setSavingAppointment(false);
    }
  }

  async function crearCasoVentasSiNoExiste(appointment: AppointmentRow) {
    const { data: existente, error: errorBusqueda } = await supabase
      .from("commercial_cases")
      .select("id")
      .eq("appointment_id", appointment.id)
      .limit(1);

    if (errorBusqueda) throw errorBusqueda;
    if (existente && existente.length > 0) return false;

    const { error: errorInsert } = await supabase.from("commercial_cases").insert([
      {
        lead_id: appointment.lead_id,
        appointment_id: appointment.id,
        customer_name: appointment.patient_name,
        phone: appointment.phone || null,
        city: appointment.city || null,
        status: "pendiente_asignacion_comercial",
        created_by_user_id: currentUserId,
        updated_by_user_id: currentUserId,
      },
    ]);

    if (errorInsert) throw errorInsert;
    return true;
  }

  async function actualizarEstadoCita(id: string, forcedStatus?: string) {
    if (isReadOnlyAgendaForCall) return;

    const nuevoEstado = forcedStatus || statusById[id];
    if (!nuevoEstado || !currentUserId) return;

    setSavingStatusId(id);
    setMensaje("");
    setError("");

    const appointmentActual = appointments.find((item) => item.id === id);
    const tieneIngresoComercial = commercialCases.some(
      (item) => item.appointment_id === id
    );

    if (nuevoEstado === "no_asistio" && tieneIngresoComercial) {
      setError("Esta cita ya fue registrada en ingreso comercial, así que no puede pasar a No asistió.");
      setSavingStatusId(null);
      return;
    }

    const payload: any = {
      status: nuevoEstado,
      updated_by_user_id: currentUserId,
    };

    if (nuevoEstado === "en_espera") {
      payload.checked_in_at = new Date().toISOString();
    }

    if (nuevoEstado === "asistio") {
      payload.attended_at = new Date().toISOString();
    }

    const { error } = await supabase.from("appointments").update(payload).eq("id", id);

    if (error) {
      setError("No se pudo actualizar el estado de la cita.");
      setSavingStatusId(null);
      return;
    }

    let mensajeFinal = "Estado actualizado correctamente.";

    try {
      if (appointmentActual?.lead_id) {
        await actualizarEstadoLeadPorCita(appointmentActual.lead_id, nuevoEstado);
      }

      if (nuevoEstado === "asistio" && appointmentActual) {
        const creado = await crearCasoVentasSiNoExiste(appointmentActual);
        if (creado) {
          mensajeFinal =
            "Estado actualizado y se creó automáticamente el caso de ventas.";
        }
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "La cita se actualizó, pero no se pudo terminar el proceso posterior."
      );
      setSavingStatusId(null);
      await cargarTodo();
      return;
    }

    setAppointments((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: nuevoEstado,
              checked_in_at:
                nuevoEstado === "en_espera"
                  ? payload.checked_in_at
                  : item.checked_in_at,
              attended_at:
                nuevoEstado === "asistio"
                  ? payload.attended_at
                  : item.attended_at,
            }
          : item
      )
    );

    setMensaje(mensajeFinal);
    setSavingStatusId(null);
  }

  async function guardarEstado(id: string) {
    return actualizarEstadoCita(id);
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {isReadOnlyAgendaForCall ? "Agenda" : "Recepción"}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {isReadOnlyAgendaForCall ? "Agendar cita" : "Agenda y admisión"}
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                {isReadOnlyAgendaForCall
                  ? "Desde aquí puedes crear una cita para tu lead sin entrar al módulo completo de recepción."
                  : "Crear citas, ubicar clientes, registrar llegada y actualizar estado."}
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Inicio
            </a>

            {!isReadOnlyAgendaForCall && (
              <>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("agenda")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "agenda" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Agenda
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("especialistas")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "especialistas" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Especialistas
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("tratamientos")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "tratamientos" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Tratamientos
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("comercial")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "comercial" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Ingreso comercial
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("impresiones")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "impresiones" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Impresiones / Entregas
                </button>
                <button
                  type="button"
                  onClick={() => cambiarSeccion("inventario")}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === "inventario" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}
                >
                  Inventario
                </button>
              </>
            )}
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>
        ) : null}

        {!isReadOnlyAgendaForCall && (
          activeSection === "comercial" ? (
            <section className="mb-6 grid gap-4 md:grid-cols-5">
              <StatCard title="Ingresos comerciales" value={String(commercialSummary.total)} />
              <StatCard title="Pendientes" value={String(commercialSummary.pendientes)} />
              <StatCard title="Asignados" value={String(commercialSummary.asignados)} />
              <StatCard title="En atención" value={String(commercialSummary.atencion)} />
              <StatCard title="Finalizados" value={String(commercialSummary.finalizados)} />
            </section>
          ) : (
            <section className="mb-6 grid gap-4 md:grid-cols-5">
              <StatCard title={`${sectionLabel} del día`} value={String(resumen.total)} />
              <StatCard title="Agendadas" value={String(resumen.agendadas)} />
              <StatCard title="En espera" value={String(resumen.espera)} />
              <StatCard title="Asistió" value={String(resumen.asistio)} />
              <StatCard title="No asistió" value={String(resumen.noAsistio)} />
            </section>
          )
        )}

        {canManageAgendaConfig && activeSection !== "impresiones" && activeSection !== "inventario" && activeSection !== "comercial" ? (
          <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Configuración de cupos
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Define cupos diarios y bloquea horarios por fecha.
                </p>
              </div>

              <button
                type="button"
                onClick={guardarConfiguracionAgenda}
                disabled={savingConfig}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingConfig ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field
                label="Fecha a configurar"
                input={
                  <input
                    className={inputClass}
                    type="date"
                    value={form.appointment_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        appointment_date: e.target.value,
                      }))
                    }
                  />
                }
              />

              <Field
                label="Cupo total del día"
                input={
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={dailyCapacityInput}
                    onChange={(e) => setDailyCapacityInput(e.target.value)}
                  />
                }
              />

              <label className="flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-4">
                <input
                  type="checkbox"
                  checked={dailyClosedInput}
                  onChange={(e) => setDailyClosedInput(e.target.checked)}
                />
                <span className="text-sm font-medium text-slate-700">
                  Cerrar este día completo
                </span>
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {SLOT_OPTIONS.map((slot) => (
                <div key={slot.value} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{slot.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Activos:{" "}
                    {
                      appointmentsForSelectedDate.filter(
                        (item) =>
                          normalizarHora(item.appointment_time) === slot.value &&
                          ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
                      ).length
                    }
                    /{slotCapacityInputs[slot.value] || DEFAULT_SLOT_CAPACITY}
                  </p>

                  <div className="mt-3">
                    <label className="text-xs text-slate-500">Cupo</label>
                    <input
                      className={`${inputClass} mt-1 py-3`}
                      type="number"
                      min="0"
                      value={slotCapacityInputs[slot.value] || ""}
                      onChange={(e) =>
                        setSlotCapacityInputs((prev) => ({
                          ...prev,
                          [slot.value]: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <label className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={slotBlockedInputs[slot.value] || false}
                      onChange={(e) =>
                        setSlotBlockedInputs((prev) => ({
                          ...prev,
                          [slot.value]: e.target.checked,
                        }))
                      }
                    />
                    <span className="text-sm text-slate-700">Bloquear hora</span>
                  </label>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeSection === "comercial" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ingreso comercial</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Registra la llegada del cliente al área comercial y déjalo disponible para asignación del gerente.
                  </p>
                </div>
              </div>

              {selectedCommercialAppointmentId ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Cita seleccionada para ingreso comercial</p>
                  <p className="mt-1">
                    Al guardar este registro, la cita quedará automáticamente como <strong>Asistió</strong>.
                    Después de este paso ya no debería marcarse como <strong>No asistió</strong>, porque el cliente ya quedó recibido en Comercial.
                  </p>
                </div>
              ) : null}

              <form onSubmit={registrarIngresoComercial} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Cliente"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.customer_name}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Teléfono"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.phone}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Ciudad"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.city}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Documento"
                    input={
                      <input
                        className={inputClass}
                        value={commercialForm.documento}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, documento: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="Fuente"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.fuente}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, fuente: e.target.value }))}
                      >
                        <option value="">Selecciona</option>
                        {manualSourceOptions.map((item) => (
                          <option key={item.value} value={item.label}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <Field
                    label="Referido por"
                    input={
                      <input
                        className={inputClass}
                        placeholder="Opcional"
                        value={commercialForm.referido_por}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, referido_por: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="¿Tiene EPS?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.tiene_eps}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, tiene_eps: e.target.value }))}
                      >
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="Afiliación"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.afiliacion}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, afiliacion: e.target.value }))}
                      >
                        <option value="">Selecciona</option>
                        <option value="cotizante">Cotizante</option>
                        <option value="beneficiario">Beneficiario</option>
                        <option value="subsidiado">Subsidiado</option>
                        <option value="particular">Particular</option>
                      </select>
                    }
                  />
                  <Field
                    label="Edad"
                    input={
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        value={commercialForm.edad}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, edad: e.target.value }))}
                      />
                    }
                  />
                  <Field
                    label="¿Asiste con cédula?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.trae_cedula}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, trae_cedula: e.target.value }))}
                      >
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="¿Tiene celular inteligente?"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.celular_inteligente}
                        onChange={(e) => setCommercialForm((prev) => ({ ...prev, celular_inteligente: e.target.value }))}
                      >
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    }
                  />
                  <Field
                    label="Ocupación"
                    input={
                      <select
                        className={inputClass}
                        value={commercialForm.ocupacion}
                        onChange={(e) =>
                          setCommercialForm((prev) => ({
                            ...prev,
                            ocupacion: e.target.value,
                            ocupacion_otro: e.target.value === "otro" ? prev.ocupacion_otro : "",
                          }))
                        }
                      >
                        <option value="">Selecciona</option>
                        {commercialOccupationOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  {commercialForm.ocupacion === "otro" ? (
                    <Field
                      label="¿Cuál ocupación?"
                      input={
                        <input
                          className={inputClass}
                          placeholder="Escribe la ocupación"
                          value={commercialForm.ocupacion_otro}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              ocupacion_otro: e.target.value,
                            }))
                          }
                        />
                      }
                    />
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium text-slate-700">Clasificación inicial</p>
                    <span className={`rounded-full px-3 py-1 text-xs ${commercialForm.clasificacion_inicial === "Q" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {commercialForm.clasificacion_inicial}
                    </span>
                    <p className="text-xs text-slate-500">
                      Si entra No Q y compra en Comercial, luego podrá pasar automáticamente a Q como clasificación final.
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    {commercialForm.clasificacion_motivo || "Completa los datos para calcular la clasificación."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Condiciones descalificantes</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Marca solo si el cliente presenta alguna de estas condiciones.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCommercialForm((prev) => ({
                          ...prev,
                          condiciones_descalificantes: emptyCommercialDisqualifyingFlags(),
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      Limpiar
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {commercialDisqualifyingOptions.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={commercialForm.condiciones_descalificantes[item.key]}
                          onChange={(e) =>
                            setCommercialForm((prev) => ({
                              ...prev,
                              condiciones_descalificantes: {
                                ...prev.condiciones_descalificantes,
                                [item.key]: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  {!Object.values(commercialForm.condiciones_descalificantes).some(Boolean) ? (
                    <p className="mt-3 text-sm text-emerald-700">Ninguna de las anteriores.</p>
                  ) : null}
                </div>

                <Field
                  label="Observaciones de recepción"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-none`}
                      value={commercialForm.observaciones}
                      onChange={(e) => setCommercialForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                    />
                  }
                />

                <button
                  type="submit"
                  disabled={savingCommercialIntake}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {savingCommercialIntake ? "Registrando..." : "Registrar ingreso a comercial"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Ingresos comerciales del día</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Estos clientes deben aparecer después en la cola del gerente comercial.
                  </p>
                </div>

                <input
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none md:max-w-xs"
                  placeholder="Buscar por nombre o teléfono"
                  value={commercialSearch}
                  onChange={(e) => setCommercialSearch(e.target.value)}
                />
              </div>

              <div className="mt-5 space-y-3">
                {commercialCasesFiltered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    Aún no hay ingresos comerciales registrados.
                  </div>
                ) : (
                  commercialCasesFiltered.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-slate-900">{item.customer_name}</p>
                            <span className={`rounded-full px-3 py-1 text-xs ${badgeEstadoComercial(item.status)}`}>
                              {traducirEstadoComercial(item.status)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.phone || "Sin teléfono"} · {item.city || "Sin ciudad"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Ingreso: {new Date(item.created_at).toLocaleString()}
                          </p>
                          {item.sale_result ? (
                            <p className="mt-2 text-sm text-slate-700">
                              <span className="font-medium text-slate-800">Resumen:</span> {item.sale_result}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : activeSection === "impresiones" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Impresiones y entregas</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Busca un cliente para imprimir su cita, sus instrucciones o registrar la entrega de nutracéuticos.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Buscar cliente"
                  input={
                    <input
                      className={inputClass}
                      placeholder="Nombre o teléfono"
                      value={printSearch}
                      onChange={(e) => setPrintSearch(e.target.value)}
                    />
                  }
                />

                {selectedPrintPatient ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cliente seleccionado
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {selectedPrintPatient.patient_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPrintPatient.phone || "Sin teléfono"} · {selectedPrintPatient.city || "Sin ciudad"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPrintPatient.detail}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Fuente: {selectedPrintPatient.source}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    Escribe un nombre o teléfono para buscar el cliente.
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => imprimirDocumento("cita")}
                    className="rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white"
                  >
                    Imprimir cita
                  </button>

                  <button
                    type="button"
                    onClick={() => imprimirDocumento("instrucciones")}
                    className="rounded-2xl border border-slate-300 px-4 py-4 text-base font-semibold text-slate-700"
                  >
                    Imprimir instrucciones
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Registrar entrega de nutracéuticos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Este registro queda guardado en este equipo mientras conectamos el inventario completo.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Producto"
                      input={
                        <input
                          className={inputClass}
                          placeholder="Ej: Omega 3"
                          value={deliveryProduct}
                          onChange={(e) => setDeliveryProduct(e.target.value)}
                        />
                      }
                    />

                    <Field
                      label="Cantidad"
                      input={
                        <input
                          className={inputClass}
                          type="number"
                          min="1"
                          value={deliveryQuantity}
                          onChange={(e) => setDeliveryQuantity(e.target.value)}
                        />
                      }
                    />
                  </div>

                  <div className="mt-4">
                    <Field
                      label="Observaciones"
                      input={
                        <textarea
                          className={`${inputClass} min-h-[110px] resize-none`}
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                        />
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={registrarEntregaLocal}
                    className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white"
                  >
                    Registrar entrega
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">Entregas recientes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Vista rápida de lo entregado desde este dispositivo.
              </p>

              <div className="mt-5 space-y-3">
                {deliveryLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                    Aún no hay entregas registradas.
                  </div>
                ) : (
                  deliveryLogs.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{item.patient_name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.phone || "Sin teléfono"}
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            <span className="font-medium">Producto:</span> {item.product}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            <span className="font-medium">Cantidad:</span> {item.quantity}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Observaciones:</span> {item.notes}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : activeSection === "inventario" && !isReadOnlyAgendaForCall ? (
          <section className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Inventario</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Control básico de nutracéuticos, entradas, salidas y alertas de stock.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Producto existente"
                  input={
                    <select
                      className={inputClass}
                      value={inventoryProductId}
                      onChange={(e) => setInventoryProductId(e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {inventoryItems
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} · stock {item.stock}
                          </option>
                        ))}
                    </select>
                  }
                />

                <Field
                  label="O crear producto nuevo"
                  input={
                    <input
                      className={inputClass}
                      placeholder="Ej: Magnesio quelado"
                      value={inventoryNewProduct}
                      onChange={(e) => setInventoryNewProduct(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Categoría"
                  input={
                    <input
                      className={inputClass}
                      value={inventoryCategory}
                      onChange={(e) => setInventoryCategory(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Stock mínimo"
                  input={
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      value={inventoryMinStock}
                      onChange={(e) => setInventoryMinStock(e.target.value)}
                    />
                  }
                />

                <Field
                  label="Tipo de movimiento"
                  input={
                    <select
                      className={inputClass}
                      value={inventoryMovementType}
                      onChange={(e) => setInventoryMovementType(e.target.value as "entrada" | "salida" | "ajuste")}
                    >
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                      <option value="ajuste">Ajuste de stock final</option>
                    </select>
                  }
                />

                <Field
                  label={inventoryMovementType === "ajuste" ? "Stock final" : "Cantidad"}
                  input={
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={inventoryQuantity}
                      onChange={(e) => setInventoryQuantity(e.target.value)}
                    />
                  }
                />
              </div>

              <div className="mt-4">
                <Field
                  label="Observaciones"
                  input={
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-none`}
                      value={inventoryMovementNotes}
                      onChange={(e) => setInventoryMovementNotes(e.target.value)}
                    />
                  }
                />
              </div>

              <button
                type="button"
                onClick={registrarMovimientoInventario}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white"
              >
                Registrar movimiento
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Stock actual</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Vista rápida del inventario disponible en este dispositivo.
                    </p>
                  </div>

                  <input
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none md:max-w-xs"
                    placeholder="Buscar producto o categoría"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {inventoryFilteredItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      Aún no hay productos registrados en el inventario.
                    </div>
                  ) : (
                    inventoryFilteredItems.map((item) => {
                      const inventoryStatus = getInventoryStatus(item);
                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.category}</p>
                              <p className="mt-2 text-sm text-slate-700">
                                <span className="font-medium">Stock:</span> {item.stock}
                              </p>
                              <p className="mt-1 text-sm text-slate-700">
                                <span className="font-medium">Mínimo:</span> {item.min_stock}
                              </p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs ${inventoryStatus.className}`}>
                              {inventoryStatus.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">Movimientos recientes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Últimos registros de entrada, salida o ajuste.
                </p>

                <div className="mt-5 space-y-3">
                  {inventoryRecentMovements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                      Aún no hay movimientos registrados.
                    </div>
                  ) : (
                    inventoryRecentMovements.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{item.product_name}</p>
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Tipo:</span> {item.type}
                            </p>
                            <p className="mt-1 text-sm text-slate-700">
                              <span className="font-medium">Cantidad:</span> {item.quantity}
                            </p>
                            {item.notes ? (
                              <p className="mt-1 text-sm text-slate-700">
                                <span className="font-medium">Observaciones:</span> {item.notes}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
        <section className={`mb-6 grid gap-6 ${isReadOnlyAgendaForCall ? "" : "xl:grid-cols-2"}`}>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingAppointmentId ? "Reagendar / editar cita" : "Nueva cita"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {leadIdFromUrl
                    ? "Esta cita se está creando desde un lead específico."
                    : "Puedes elegir un lead existente o ingresar el cliente manualmente."}
                </p>
                {!isReadOnlyAgendaForCall ? (
                  <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    Módulo activo: {sectionLabel}
                  </p>
                ) : null}
              </div>

              {editingAppointmentId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <form onSubmit={guardarCita} className="mt-5 space-y-4">
              {!leadIdFromUrl ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                    <div className="mb-2 font-medium text-slate-700">Modo de creación</div>
                    <select
                      className="w-full outline-none"
                      value={form.mode}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          mode: e.target.value,
                          lead_id: "",
                          patient_name: "",
                          phone: "",
                          city: "",
                          manual_source: "",
                        }))
                      }
                    >
                      <option value="lead">Desde lead</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>

                  {form.mode === "lead" ? (
                    <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                      <div className="mb-2 font-medium text-slate-700">Buscar lead</div>
                      <input
                        className="w-full outline-none"
                        placeholder="Nombre o teléfono"
                        value={busquedaLead}
                        onChange={(e) => setBusquedaLead(e.target.value)}
                      />
                    </label>
                  ) : (
                    <label className="rounded-2xl border border-slate-300 p-4 text-sm">
                      <div className="mb-2 font-medium text-slate-700">Fuente</div>
                      <select
                        className="w-full outline-none"
                        value={form.manual_source}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, manual_source: e.target.value }))
                        }
                      >
                        <option value="">Selecciona</option>
                        {manualSourceOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              ) : null}

              {form.mode === "lead" && !leadIdFromUrl ? (
                <label className="block rounded-2xl border border-slate-300 p-4 text-sm">
                  <div className="mb-2 font-medium text-slate-700">Seleccionar lead</div>
                  <select
                    className="w-full outline-none"
                    value={form.lead_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, lead_id: e.target.value }))
                    }
                  >
                    <option value="">Selecciona</option>
                    {leadsFiltrados.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {fullLeadName(lead)} · {lead.phone}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {leadIdFromUrl ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Lead seleccionado
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {form.patient_name || "Cliente"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {form.phone || "Sin teléfono"} · {form.city || "Sin ciudad"}
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Cliente"
                  input={
                    <input
                      className={inputClass}
                      value={form.patient_name}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, patient_name: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label="Teléfono"
                  input={
                    <input
                      className={inputClass}
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label="Ciudad"
                  input={
                    <input
                      className={inputClass}
                      value={form.city}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, city: e.target.value }))
                      }
                    />
                  }
                />

                {activeSection !== "agenda" ? (
                  <Field
                    label={serviceFieldLabel}
                    input={
                      <select
                        className={inputClass}
                        value={form.service_type}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, service_type: e.target.value }))
                        }
                      >
                        <option value="">Selecciona</option>
                        {serviceOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                ) : null}

                <Field
                  label="Fecha"
                  input={
                    <input
                      className={inputClass}
                      type="date"
                      value={form.appointment_date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, appointment_date: e.target.value }))
                      }
                    />
                  }
                />

                <Field
                  label="Hora"
                  input={
                    <select
                      className={inputClass}
                      value={form.appointment_time}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, appointment_time: e.target.value }))
                      }
                    >
                      {slotAvailability.map((slot) => (
                        <option
                          key={slot.value}
                          value={slot.value}
                          disabled={slot.disabled}
                        >
                          {slot.label}{" "}
                          {slot.isBlocked
                            ? "· Bloqueado"
                            : slot.isFullByDay
                            ? "· Día lleno"
                            : slot.isFullBySlot
                            ? `· Lleno (${slot.booked}/${slot.capacity})`
                            : `· ${slot.booked}/${slot.capacity}`}
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>


              <Field
                label="Notas"
                input={
                  <textarea
                    className={`${inputClass} min-h-[110px] resize-none`}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                }
              />

              <button
                type="submit"
                disabled={savingAppointment}
                className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
              >
                {savingAppointment
                  ? "Guardando..."
                  : editingAppointmentId
                  ? "Guardar reagendamiento"
                  : "Guardar cita"}
              </button>
            </form>
          </div>

          {!isReadOnlyAgendaForCall && (
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Agenda visible</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {`Vista de ${sectionLabel.toLowerCase()} por nombre, teléfono y fecha.`}
                  </p>
                </div>

                <button
                  onClick={cargarTodo}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Actualizar
                </button>
              </div>

              <div className="mb-6 grid gap-3 md:grid-cols-2">
                <div className="flex gap-2">
                <input
                  className="w-full rounded-2xl border border-slate-300 p-4 outline-none"
                  type="date"
                  value={fechaFiltro}
                  onChange={(e) => setFechaFiltro(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setFechaFiltro("")}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Todas
                </button>
              </div>

                <input
                  className="rounded-2xl border border-slate-300 p-4 outline-none"
                  type="text"
                  placeholder="Buscar por nombre o teléfono"
                  value={busquedaAgenda}
                  onChange={(e) => setBusquedaAgenda(e.target.value)}
                />
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Cargando citas...
                </div>
              ) : agendaFiltrada.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No hay citas con esos filtros.
                </div>
              ) : (
                <div className="space-y-4">
                  {agendaFiltrada.map((item) => {
                    const isSelected = selectedQuickAppointmentId === item.id;
                    const hasCommercialRecord = commercialCases.some(
                      (caseItem) => caseItem.appointment_id === item.id
                    );
                    return (
                    <div
                      key={item.id}
                      onDoubleClick={() => abrirIngresoComercialDesdeCita(item)}
                      className={`rounded-2xl border p-4 transition ${isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">
                                {item.patient_name}
                              </h3>

                              <span
                                className={`rounded-full px-3 py-1 text-xs ${badgeEstado(
                                  item.status
                                )}`}
                              >
                                {traducirEstado(item.status)}
                              </span>

                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                {item.appointment_date}
                              </span>

                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                {formatHora(item.appointment_time)}
                              </span>

                              {isSelected ? (
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                                  Seleccionada
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {item.phone || "Sin teléfono"} · {item.city || "Sin ciudad"}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              Fuente: {item.lead_id ? "Lead existente" : traducirFuenteManual(extraerFuenteManualDesdeNotas(item.notes))}
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              {getServiceFieldLabel(getSectionForService(item.service_type))}: {item.service_type || "Sin dato"}
                            </p>

                            {item.notes ? (
                              <p className="mt-2 text-sm text-slate-600">
                                <span className="font-medium text-slate-800">Notas:</span>{" "}
                                {limpiarFuenteManualDeNotas(item.notes)}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirIngresoComercialDesdeCita(item)}
                              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                            >
                              Registro comercial
                            </button>

                            {!hasCommercialRecord ? (
                              <button
                                type="button"
                                onClick={() => actualizarEstadoCita(item.id, "no_asistio")}
                                disabled={savingStatusId === item.id}
                                className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-60"
                              >
                                No asistió
                              </button>
                            ) : (
                              <span className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                                Ya registrada en comercial
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => cargarCitaParaEditar(item)}
                              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                            >
                              Reagendar
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="mb-3 text-sm font-medium text-slate-700">
                            Estado de la cita
                          </p>

                          <div className="flex flex-col gap-3 md:flex-row">
                            <select
                              className="w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none"
                              value={statusById[item.id] || item.status}
                              onChange={(e) =>
                                setStatusById((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                            >
                              {appointmentStatusOptions
                                .filter((status) => !(hasCommercialRecord && status.value === "no_asistio"))
                                .map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => guardarEstado(item.id)}
                              disabled={savingStatusId === item.id}
                              className="rounded-2xl border border-slate-900 px-5 py-3 text-sm font-medium text-slate-900 disabled:opacity-60"
                            >
                              {savingStatusId === item.id
                                ? "Guardando..."
                                : "Guardar estado"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}                </div>
              )}
            </div>
          )}
        </section>
        )}
      </div>
    </main>
  );
}

export default function RecepcionPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 p-6 md:p-8">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Cargando recepción...</p>
          </div>
        </main>
      }
    >
      <RecepcionContent />
    </Suspense>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  input,
}: {
  label: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      {input}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-slate-500";