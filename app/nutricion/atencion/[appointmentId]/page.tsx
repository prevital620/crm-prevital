"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildPendingDeliveryNotes,
  parseDeliveryRecommendation,
} from "@/lib/appointments/receptionDelivery";
import {
  parseSpecialistReceptionSummary,
  specialistPlanLabel,
} from "@/lib/specialists/receptionSummary";
import { repairMojibake } from "@/lib/text/repairMojibake";

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
};

type UserRow = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad: string | null;
  ocupacion: string | null;
};

type NutritionProfileRow = {
  user_id: string;
  antecedentes_patologicos: string | null;
  cirugias: string | null;
  toxicos: string | null;
  alergicos: string | null;
  medicamentos: string | null;
  familiares: string | null;
  peso: string | null;
  talla: string | null;
  perimetro_brazo: string | null;
  indice_masa_corporal: string | null;
  porcentaje_masa_corporal: string | null;
  dinamometria: string | null;
  masa_muscular: string | null;
  metabolismo_reposo: string | null;
  grasa_visceral: string | null;
  edad_corporal: string | null;
  circunferencia_cintura: string | null;
  perimetro_pantorrilla: string | null;
  clasificacion_nutricional: string | null;
  objetivo_nutricional: string | null;
  recomendaciones_nutricionales: string | null;
  datos_alimentarios: string | null;
  plan_nutricional: string | null;
  observaciones_generales: string | null;
};

type CommercialCaseSummary = {
  id: string;
  appointment_id: string | null;
  next_appointment_id: string | null;
  lead_id: string | null;
  status: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  payment_method: string | null;
  sale_result: string | null;
  sales_assessment: string | null;
  proposal_text: string | null;
  closing_notes: string | null;
  commercial_notes: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  created_at: string;
};

type InventoryOption = {
  id: string;
  name: string;
  stock: number;
};

type FormState = {
  document: string;
  phone: string;
  city: string;
  age: string;
  sex: string;
  antecedentes_patologicos: string;
  cirugias: string;
  toxicos: string;
  alergicos: string;
  medicamentos: string;
  familiares: string;
  peso: string;
  talla: string;
  perimetro_brazo: string;
  indice_masa_corporal: string;
  porcentaje_masa_corporal: string;
  dinamometria: string;
  masa_muscular: string;
  metabolismo_reposo: string;
  grasa_visceral: string;
  edad_corporal: string;
  circunferencia_cintura: string;
  perimetro_pantorrilla: string;
  clasificacion_nutricional: string;
  objetivo_nutricional: string;
  recomendaciones_nutricionales: string;
  datos_alimentarios: string;
  plan_nutricional: string;
  observaciones_generales: string;
  reception_product_id: string;
  reception_product_name: string;
  reception_product_quantity: string;
  reception_product_instructions: string;
};

const initialForm: FormState = {
  document: "",
  phone: "",
  city: "",
  age: "",
  sex: "",
  antecedentes_patologicos: "",
  cirugias: "",
  toxicos: "",
  alergicos: "",
  medicamentos: "",
  familiares: "",
  peso: "",
  talla: "",
  perimetro_brazo: "",
  indice_masa_corporal: "",
  porcentaje_masa_corporal: "",
  dinamometria: "",
  masa_muscular: "",
  metabolismo_reposo: "",
  grasa_visceral: "",
  edad_corporal: "",
  circunferencia_cintura: "",
  perimetro_pantorrilla: "",
  clasificacion_nutricional: "",
  objetivo_nutricional: "",
  recomendaciones_nutricionales: "",
  datos_alimentarios: "",
  plan_nutricional: "",
  observaciones_generales: "",
  reception_product_id: "",
  reception_product_name: "",
  reception_product_quantity: "1",
  reception_product_instructions: "",
};

const classificationOptions = [
  "Desnutrición grado 1",
  "Desnutrición grado 2",
  "Desnutrición grado 3",
  "Normal",
  "Sobrepeso",
  "Pre obeso",
  "Obesidad",
  "Obesidad grado 1",
  "Obesidad grado 2",
  "Obesidad grado 3",
];

const metricFields: Array<{
  key: keyof FormState;
  label: string;
  placeholder: string;
}> = [
  { key: "peso", label: "Peso", placeholder: "Ej: 70 kg" },
  { key: "talla", label: "Talla", placeholder: "Ej: 1.65 m" },
  { key: "perimetro_brazo", label: "Perímetro brazo", placeholder: "Ej: 28 cm" },
  { key: "indice_masa_corporal", label: "Índice masa corporal", placeholder: "Ej: 25" },
  { key: "porcentaje_masa_corporal", label: "Grasa corporal", placeholder: "Ej: 30%" },
  { key: "masa_muscular", label: "Masa muscular", placeholder: "Ej: 42 kg" },
  { key: "metabolismo_reposo", label: "Metabolismo en reposo", placeholder: "Ej: 1450 kcal" },
  { key: "grasa_visceral", label: "Grasa visceral", placeholder: "Ej: 8" },
  { key: "edad_corporal", label: "Edad corporal", placeholder: "Ej: 40" },
  { key: "dinamometria", label: "Dinamometría", placeholder: "Ej: 28 kg" },
  { key: "circunferencia_cintura", label: "Circunferencia cintura", placeholder: "Ej: 86 cm" },
  { key: "perimetro_pantorrilla", label: "Perímetro pantorrilla", placeholder: "Ej: 35 cm" },
];

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function traducirEstado(status: string | null | undefined) {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    en_espera: "En espera",
    asistio: "AsistiÃ³",
    no_asistio: "No asistiÃ³",
    reagendada: "Reagendada",
    cancelada: "Cancelada",
    en_atencion: "En atenciÃ³n",
    finalizada: "Finalizada",
  };
  return map[status || ""] || status || "";
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function NutricionAtencionPage() {
  const params = useParams();
  const appointmentId = String(params?.appointmentId || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [commercialCase, setCommercialCase] = useState<CommercialCaseSummary | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [finalized, setFinalized] = useState(false);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryOption[]>([]);
  const [fallbackOccupation, setFallbackOccupation] = useState("");

  useEffect(() => {
    if (!appointmentId) return;
    void loadRealData();
  }, [appointmentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem("recepcion_inventory_items");
      if (!raw) return;
      const parsed = JSON.parse(raw) as InventoryOption[];
      if (Array.isArray(parsed)) {
        setInventoryOptions(
          parsed
            .filter((item) => item && item.id && item.name)
            .map((item) => ({
              id: item.id,
              name: item.name,
              stock: Number(item.stock || 0),
            }))
        );
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!form.reception_product_name || form.reception_product_id) return;

    const matched = inventoryOptions.find(
      (item) => normalizeText(item.name) === normalizeText(form.reception_product_name)
    );

    if (!matched) return;

    setForm((prev) => ({
      ...prev,
      reception_product_id: matched.id,
    }));
  }, [form.reception_product_id, form.reception_product_name, inventoryOptions]);

  const canPrint = useMemo(() => {
    return (
      form.plan_nutricional.trim().length > 0 ||
      form.recomendaciones_nutricionales.trim().length > 0
    );
  }, [form]);

  const receptionSummary = useMemo(
    () =>
      parseSpecialistReceptionSummary(
        commercialCase?.commercial_notes,
        commercialCase?.sale_result,
        {
          document: form.document,
          occupation: fallbackOccupation,
        }
      ),
    [commercialCase, fallbackOccupation, form.document]
  );

  const acquiredPlanLabel = useMemo(
    () => specialistPlanLabel(commercialCase?.purchased_service || appointment?.service_type),
    [appointment?.service_type, commercialCase?.purchased_service]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function loadRealData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data: appointmentData, error: appointmentError } = await supabase
        .from("appointments")
        .select("id, lead_id, patient_name, phone, city, appointment_date, appointment_time, status, service_type, notes")
        .eq("id", appointmentId)
        .single();

        if (appointmentError) throw appointmentError;
        if (!appointmentData) throw new Error("No se encontró la cita.");

      setAppointment(appointmentData as AppointmentRow);

      let linkedCommercialCase: CommercialCaseSummary | null = null;
      const { data: directCaseData, error: directCaseError } = await supabase
        .from("commercial_cases")
        .select(`
          id,
          appointment_id,
          next_appointment_id,
          lead_id,
          status,
          purchased_service,
          sale_value,
          cash_amount,
          portfolio_amount,
          payment_method,
          sale_result,
          sales_assessment,
          proposal_text,
          closing_notes,
          commercial_notes,
          lead_source_type,
          commission_source_type,
          created_at
        `)
        .or(`appointment_id.eq.${appointmentId},next_appointment_id.eq.${appointmentId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (directCaseError) throw directCaseError;
      linkedCommercialCase = (directCaseData as CommercialCaseSummary | null) || null;

      if (!linkedCommercialCase && appointmentData.lead_id) {
        const { data: leadCaseData, error: leadCaseError } = await supabase
          .from("commercial_cases")
          .select(`
            id,
            appointment_id,
            next_appointment_id,
            lead_id,
            status,
            purchased_service,
            sale_value,
            cash_amount,
            portfolio_amount,
            payment_method,
            sale_result,
            sales_assessment,
            proposal_text,
            closing_notes,
            commercial_notes,
            lead_source_type,
            commission_source_type,
            created_at
          `)
          .eq("lead_id", appointmentData.lead_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (leadCaseError) throw leadCaseError;
        linkedCommercialCase = (leadCaseData as CommercialCaseSummary | null) || null;
      }

      setCommercialCase(linkedCommercialCase);

      let foundUser: UserRow | null = null;

      if (appointmentData.phone) {
        const { data: usersByPhone, error: userPhoneError } = await supabase
          .from("users")
          .select("id, nombre, documento, telefono, ciudad, ocupacion")
          .eq("telefono", appointmentData.phone)
          .limit(1);

        if (userPhoneError) throw userPhoneError;
        if (usersByPhone && usersByPhone.length > 0) {
          foundUser = usersByPhone[0] as UserRow;
        }
      }

      if (!foundUser && appointmentData.patient_name) {
        const { data: usersByName, error: userNameError } = await supabase
          .from("users")
          .select("id, nombre, documento, telefono, ciudad, ocupacion")
          .eq("nombre", appointmentData.patient_name)
          .limit(1);

        if (userNameError) throw userNameError;
        if (usersByName && usersByName.length > 0) {
          foundUser = usersByName[0] as UserRow;
        }
      }

      let nutritionProfile: NutritionProfileRow | null = null;
        const parsedReceptionSummary = parseSpecialistReceptionSummary(
          linkedCommercialCase?.commercial_notes,
          linkedCommercialCase?.sale_result,
          {
            document: foundUser?.documento,
            occupation: foundUser?.ocupacion,
          }
        );
        setFallbackOccupation(foundUser?.ocupacion || "");
      const deliveryRecommendation = parseDeliveryRecommendation(
        appointmentData.notes,
        "nutricion"
      );
      if (foundUser?.id) {
        const { data: nutritionData, error: nutritionError } = await supabase
          .from("nutrition_profiles")
          .select("*")
          .eq("user_id", foundUser.id)
          .maybeSingle();

        if (nutritionError) throw nutritionError;
        nutritionProfile = nutritionData as NutritionProfileRow | null;
        setUserId(foundUser.id);
      } else {
        setUserId(null);
      }

        setForm({
          document: parsedReceptionSummary.document || foundUser?.documento || "",
          phone: appointmentData.phone || foundUser?.telefono || "",
          city: appointmentData.city || foundUser?.ciudad || "",
          age: parsedReceptionSummary.age || "",
        sex: "",
        antecedentes_patologicos: nutritionProfile?.antecedentes_patologicos || "",
        cirugias: nutritionProfile?.cirugias || "",
        toxicos: nutritionProfile?.toxicos || "",
        alergicos: nutritionProfile?.alergicos || "",
        medicamentos: nutritionProfile?.medicamentos || "",
        familiares: nutritionProfile?.familiares || "",
        peso: nutritionProfile?.peso || "",
        talla: nutritionProfile?.talla || "",
        perimetro_brazo: nutritionProfile?.perimetro_brazo || "",
        indice_masa_corporal: nutritionProfile?.indice_masa_corporal || "",
        porcentaje_masa_corporal: nutritionProfile?.porcentaje_masa_corporal || "",
        dinamometria: nutritionProfile?.dinamometria || "",
        masa_muscular: nutritionProfile?.masa_muscular || "",
        metabolismo_reposo: nutritionProfile?.metabolismo_reposo || "",
        grasa_visceral: nutritionProfile?.grasa_visceral || "",
        edad_corporal: nutritionProfile?.edad_corporal || "",
        circunferencia_cintura: nutritionProfile?.circunferencia_cintura || "",
        perimetro_pantorrilla: nutritionProfile?.perimetro_pantorrilla || "",
        clasificacion_nutricional: nutritionProfile?.clasificacion_nutricional || "",
        objetivo_nutricional: nutritionProfile?.objetivo_nutricional || "",
        recomendaciones_nutricionales: nutritionProfile?.recomendaciones_nutricionales || "",
        datos_alimentarios: nutritionProfile?.datos_alimentarios || "",
        plan_nutricional: nutritionProfile?.plan_nutricional || "",
        observaciones_generales: nutritionProfile?.observaciones_generales || "",
        reception_product_id: "",
        reception_product_name: deliveryRecommendation?.productName || "",
        reception_product_quantity: String(deliveryRecommendation?.quantity || 1),
        reception_product_instructions: deliveryRecommendation?.instructions || "",
      });

      setFinalized((appointmentData.status || "") === "finalizada");
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar la atenciÃ³n nutricional.");
    } finally {
      setLoading(false);
    }
  }

  function validateBeforeFinalize() {
    const nextErrors: string[] = [];

    if (!form.clasificacion_nutricional.trim()) {
      nextErrors.push("La clasificaciÃ³n nutricional es obligatoria.");
    }
    if (!form.objetivo_nutricional.trim()) {
      nextErrors.push("El objetivo nutricional es obligatorio.");
    }
    if (!form.plan_nutricional.trim()) {
      nextErrors.push("El plan nutricional es obligatorio.");
    }

    return nextErrors;
  }

  async function ensureUser() {
    if (userId) return userId;
    if (!appointment) throw new Error("No hay cita cargada.");

    const payload = {
      nombre: appointment.patient_name?.trim() || "Cliente nutriciÃ³n",
      documento: form.document.trim() || null,
      telefono: form.phone.trim() || appointment.phone || null,
      ciudad: form.city.trim() || appointment.city || null,
      ocupacion: "nutricion",
      estado_actual: "en valoracion nutricional",
    };

    const { data: insertedUser, error: insertUserError } = await supabase
      .from("users")
      .insert([payload])
      .select("id")
      .single();

    if (insertUserError) throw insertUserError;

    setUserId(insertedUser.id);
    return insertedUser.id as string;
  }

  async function saveAll(nextStatus?: string) {
    if (!appointment) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const ensuredUserId = await ensureUser();

      const estadoActual =
        nextStatus === "finalizada"
          ? "pendiente_entrega_nutricion"
          : "en valoracion nutricional";

      const { error: userUpdateError } = await supabase
        .from("users")
        .update({
          nombre: appointment.patient_name?.trim() || null,
          documento: form.document.trim() || null,
          telefono: form.phone.trim() || null,
          ciudad: form.city.trim() || null,
          ocupacion: "nutricion",
          estado_actual: estadoActual,
        })
        .eq("id", ensuredUserId);

      if (userUpdateError) throw userUpdateError;

      const nutritionPayload = {
        user_id: ensuredUserId,
        antecedentes_patologicos: form.antecedentes_patologicos.trim() || null,
        cirugias: form.cirugias.trim() || null,
        toxicos: form.toxicos.trim() || null,
        alergicos: form.alergicos.trim() || null,
        medicamentos: form.medicamentos.trim() || null,
        familiares: form.familiares.trim() || null,
        peso: form.peso.trim() || null,
        talla: form.talla.trim() || null,
        perimetro_brazo: form.perimetro_brazo.trim() || null,
        indice_masa_corporal: form.indice_masa_corporal.trim() || null,
        porcentaje_masa_corporal: form.porcentaje_masa_corporal.trim() || null,
        masa_muscular: form.masa_muscular.trim() || null,
        metabolismo_reposo: form.metabolismo_reposo.trim() || null,
        grasa_visceral: form.grasa_visceral.trim() || null,
        edad_corporal: form.edad_corporal.trim() || null,
        circunferencia_cintura: form.circunferencia_cintura.trim() || null,
        perimetro_pantorrilla: form.perimetro_pantorrilla.trim() || null,
        clasificacion_nutricional: form.clasificacion_nutricional.trim() || null,
        objetivo_nutricional: form.objetivo_nutricional.trim() || null,
        recomendaciones_nutricionales: form.recomendaciones_nutricionales.trim() || null,
        datos_alimentarios: form.datos_alimentarios.trim() || null,
        plan_nutricional: form.plan_nutricional.trim() || null,
        observaciones_generales: form.observaciones_generales.trim() || null,
      };

      const { error: nutritionError } = await supabase
        .from("nutrition_profiles")
        .upsert([nutritionPayload], { onConflict: "user_id" });

      if (nutritionError) throw nutritionError;

      const appointmentUpdate: Record<string, any> = {
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
      };

      if (nextStatus) {
        const selectedProductName =
          form.reception_product_name.trim() ||
          inventoryOptions.find((item) => item.id === form.reception_product_id)?.name ||
          "";
        appointmentUpdate.status = nextStatus;
        appointmentUpdate.notes = buildPendingDeliveryNotes(appointment.notes, "nutricion", {
          productName: selectedProductName,
          quantity: Number(form.reception_product_quantity || "1") || 1,
          instructions: form.reception_product_instructions.trim(),
        });
      }

      const { error: appointmentUpdateError } = await supabase
        .from("appointments")
        .update(appointmentUpdate)
        .eq("id", appointment.id);

      if (appointmentUpdateError) throw appointmentUpdateError;

      setAppointment((prev) =>
        prev
          ? {
              ...prev,
              phone: form.phone.trim() || null,
              city: form.city.trim() || null,
              status: nextStatus || prev.status,
              notes:
                nextStatus
                  ? buildPendingDeliveryNotes(prev.notes, "nutricion", {
                      productName:
                        form.reception_product_name.trim() ||
                        inventoryOptions.find((item) => item.id === form.reception_product_id)?.name ||
                        "",
                      quantity: Number(form.reception_product_quantity || "1") || 1,
                      instructions: form.reception_product_instructions.trim(),
                    })
                  : prev.notes,
            }
          : prev
      );

      if (nextStatus === "finalizada") {
        setFinalized(true);
        setMessage("Consulta finalizada. El cliente quedó pendiente para Recepción, impresión y entrega de productos.");
      } else {
        setMessage("Cambios guardados correctamente.");
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la atención nutricional.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveAll();
  }

  async function handleFinalize() {
    const validationErrors = validateBeforeFinalize();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      setMessage("");
      return;
    }

    await saveAll("finalizada");
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">{repairMojibake("Cargando atención nutricional...")}</p>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{repairMojibake(error || "No se encontró la cita.")}</p>
          <Link href="/nutricion/agenda" className="mt-4 inline-flex rounded-2xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B]">
            Volver a agenda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.04] md:h-[540px] md:w-[540px]">
          <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain" priority />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-4 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">Módulo de Nutrición</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">{repairMojibake(appointment.patient_name || "")}</h1>
              <p className="mt-3 text-sm text-slate-600">
                Atención clínica programada
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/nutricion/agenda"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Volver a agenda
              </Link>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl border border-[#D6E8DA] bg-white px-6 py-3 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>

              <button
                type="button"
                onClick={handleFinalize}
                disabled={saving}
                className="rounded-2xl bg-[#0DA56F] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0B8E5F] disabled:opacity-60"
              >
                {saving ? "Guardando..." : finalized ? "Consulta finalizada" : "Finalizar consulta"}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!canPrint}
                className="rounded-2xl border border-[#0DA56F] bg-white px-6 py-3 text-base font-semibold text-[#0DA56F] transition hover:bg-[#F4FAF6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Imprimir
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBox label="Documento" value={form.document} />
            <InfoBox label="Teléfono" value={form.phone} />
            <InfoBox label="Edad" value={form.age} />
            <InfoBox label="EPS" value={receptionSummary.eps} />
            <InfoBox label="Fecha" value={appointment.appointment_date || ""} />
            <InfoBox label="Hora" value={formatHora(appointment.appointment_time)} />
            <InfoBox label="Ocupación" value={receptionSummary.occupation} />
            <InfoBox label="Estado" value={traducirEstado(appointment.status)} />
          </div>

          <div className="mt-5">
            <ReadOnlyTextBlock
              label="Antecedentes básicos de recepción"
              value={receptionSummary.basicHistory}
            />
          </div>
        </section>

        {commercialCase?.purchased_service || appointment.service_type ? (
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan adquirido</h2>
            <p className="mt-1 text-sm text-slate-500">
              Esta información acompaña la atención del especialista sin mostrar datos sensibles del cierre comercial.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoBox
                label="Plan adquirido"
                value={acquiredPlanLabel}
              />
              <InfoBox
                label="Servicio agendado"
                value={specialistPlanLabel(appointment.service_type)}
              />
              <InfoBox label="Especialidad" value="Nutrición" />
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Antecedentes personales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Puedes ingresar o modificar los antecedentes reales del paciente.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SmallTextAreaField label="Antecedentes patológicos" value={form.antecedentes_patologicos} onChange={(v) => updateField("antecedentes_patologicos", v)} />
            <SmallTextAreaField label="Cirugías" value={form.cirugias} onChange={(v) => updateField("cirugias", v)} />
            <SmallTextAreaField label="Tóxicos" value={form.toxicos} onChange={(v) => updateField("toxicos", v)} />
            <SmallTextAreaField label="Alérgicos" value={form.alergicos} onChange={(v) => updateField("alergicos", v)} />
            <SmallTextAreaField label="Medicamentos" value={form.medicamentos} onChange={(v) => updateField("medicamentos", v)} />
            <SmallTextAreaField label="Familiares" value={form.familiares} onChange={(v) => updateField("familiares", v)} />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Formulario nutricional</h2>
          <p className="mt-1 text-sm text-slate-500">
            {repairMojibake("Medidas y composición corporal para la valoración nutricional.")}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricFields.map((field) => (
              <InputField
                key={field.key}
                label={field.label}
                value={form[field.key]}
                placeholder={field.placeholder}
                onChange={(v) => updateField(field.key, v)}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Clasificación y objetivos</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Clasificación nutricional</label>
                <select
                  className={inputClass}
                  value={form.clasificacion_nutricional}
                  onChange={(e) => updateField("clasificacion_nutricional", e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {classificationOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <LargeTextAreaField label="Objetivo nutricional" value={form.objetivo_nutricional} onChange={(v) => updateField("objetivo_nutricional", v)} rows={5} />
              <LargeTextAreaField label="Recomendaciones nutricionales" value={form.recomendaciones_nutricionales} onChange={(v) => updateField("recomendaciones_nutricionales", v)} rows={6} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan y datos alimentarios</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Datos alimentarios" value={form.datos_alimentarios} onChange={(v) => updateField("datos_alimentarios", v)} rows={7} />
              <LargeTextAreaField label="Plan nutricional" value={form.plan_nutricional} onChange={(v) => updateField("plan_nutricional", v)} rows={7} />
              <LargeTextAreaField label="Observaciones generales" value={form.observaciones_generales} onChange={(v) => updateField("observaciones_generales", v)} rows={5} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Producto para recepción</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si eliges un producto aquí, recepción lo recibirá fijado al finalizar la consulta.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Producto sugerido</label>
              <select
                className={inputClass}
                value={form.reception_product_id || (form.reception_product_name ? "__manual__" : "")}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (nextValue === "__manual__") {
                    setForm((prev) => ({
                      ...prev,
                      reception_product_id: "",
                    }));
                    return;
                  }

                  const selected = inventoryOptions.find((item) => item.id === nextValue);
                  setForm((prev) => ({
                    ...prev,
                    reception_product_id: nextValue,
                    reception_product_name: selected?.name || "",
                  }));
                }}
              >
                <option value="">Sin producto</option>
                {inventoryOptions
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · stock {item.stock}
                    </option>
                  ))}
                <option value="__manual__">Otro producto</option>
              </select>
            </div>

            <InputField
              label="Cantidad sugerida"
              value={form.reception_product_quantity}
              placeholder="Ej: 1"
              onChange={(value) => updateField("reception_product_quantity", value)}
            />
          </div>

          {!form.reception_product_id ? (
            <div className="mt-4">
              <InputField
                label="Nombre del producto"
                value={form.reception_product_name}
                placeholder="Ej: Omega 3"
                onChange={(value) => updateField("reception_product_name", value)}
              />
            </div>
          ) : null}

          <div className="mt-4">
            <LargeTextAreaField
              label="Indicaciones para recepción"
              value={form.reception_product_instructions}
              onChange={(v) => updateField("reception_product_instructions", v)}
              rows={4}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#657D9B]">{repairMojibake(label)}</p>
      <p className="mt-2 text-[#24312A]">{repairMojibake(value || " ")}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{repairMojibake(label)}</label>
      <input
        className={inputClass}
        value={value}
        placeholder={repairMojibake(placeholder)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SmallTextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{repairMojibake(label)}</label>
      <textarea
        className={inputClass + " min-h-[110px] resize-none"}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function LargeTextAreaField({
  label,
  value,
  onChange,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{repairMojibake(label)}</label>
      <textarea
        className={inputClass + " min-h-[160px] resize-none"}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ReadOnlyTextBlock({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{repairMojibake(label)}</label>
      <div className="min-h-[140px] rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm leading-6 text-[#24312A]">
        {repairMojibake(value?.trim() || "Sin información registrada.")}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";




