"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildPendingDeliveryNotes } from "@/lib/appointments/receptionDelivery";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";

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
};

type PhysiotherapyProfileRow = {
  user_id: string;
  antecedentes_patologicos: string | null;
  cirugias: string | null;
  toxicos: string | null;
  alergicos: string | null;
  medicamentos: string | null;
  familiares: string | null;
  analisis_comercial: string | null;
  presion_arterial: string | null;
  frecuencia_cardiaca: string | null;
  inspeccion_general: string | null;
  dolor: string | null;
  inflamacion: string | null;
  limitacion_movilidad: string | null;
  prueba_semiologica: string | null;
  flexibilidad: string | null;
  fuerza_muscular: string | null;
  rangos_movimiento_articular: string | null;
  plan_intervencion: string | null;
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
  analisis_comercial: string;
  presion_arterial: string;
  frecuencia_cardiaca: string;
  inspeccion_general: string;
  dolor: string;
  inflamacion: string;
  limitacion_movilidad: string;
  prueba_semiologica: string;
  flexibilidad: string;
  fuerza_muscular: string;
  rangos_movimiento_articular: string;
  plan_intervencion: string;
  observaciones_generales: string;
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
  analisis_comercial: "",
  presion_arterial: "",
  frecuencia_cardiaca: "",
  inspeccion_general: "",
  dolor: "",
  inflamacion: "",
  limitacion_movilidad: "",
  prueba_semiologica: "",
  flexibilidad: "",
  fuerza_muscular: "",
  rangos_movimiento_articular: "",
  plan_intervencion: "",
  observaciones_generales: "",
};

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

function buildReceptionDeliveryFlag(currentNotes: string | null | undefined) {
  return buildPendingDeliveryNotes(currentNotes, "fisioterapia");
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function paymentMethodLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    addi: "Addi",
    welly: "Welly",
    medipay: "MediPay",
    mixto: "Mixto",
  };

  return map[value || ""] || value || "Sin definir";
}

function sourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    directo: "Directo",
    otro: "Otro",
  };

  return map[value || ""] || value || "Sin definir";
}

export default function FisioterapiaAtencionPage() {
  const params = useParams();
  const appointmentId = String(params?.appointmentId || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [commercialCase, setCommercialCase] = useState<CommercialCaseSummary | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    void loadRealData();
  }, [appointmentId]);

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
      if (!appointmentData) throw new Error("No se encontrÃ³ la cita.");

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
          .select("id, nombre, documento, telefono, ciudad")
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
          .select("id, nombre, documento, telefono, ciudad")
          .eq("nombre", appointmentData.patient_name)
          .limit(1);

        if (userNameError) throw userNameError;
        if (usersByName && usersByName.length > 0) {
          foundUser = usersByName[0] as UserRow;
        }
      }

      let profile: PhysiotherapyProfileRow | null = null;
      if (foundUser?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from("physiotherapy_profiles")
          .select("*")
          .eq("user_id", foundUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        profile = profileData as PhysiotherapyProfileRow | null;
        setUserId(foundUser.id);
      } else {
        setUserId(null);
      }

      setForm({
        document: foundUser?.documento || "",
        phone: appointmentData.phone || foundUser?.telefono || "",
        city: appointmentData.city || foundUser?.ciudad || "",
        age: "",
        sex: "",
        antecedentes_patologicos: profile?.antecedentes_patologicos || "",
        cirugias: profile?.cirugias || "",
        toxicos: profile?.toxicos || "",
        alergicos: profile?.alergicos || "",
        medicamentos: profile?.medicamentos || "",
        familiares: profile?.familiares || "",
        analisis_comercial: profile?.analisis_comercial || "",
        presion_arterial: profile?.presion_arterial || "",
        frecuencia_cardiaca: profile?.frecuencia_cardiaca || "",
        inspeccion_general: profile?.inspeccion_general || "",
        dolor: profile?.dolor || "",
        inflamacion: profile?.inflamacion || "",
        limitacion_movilidad: profile?.limitacion_movilidad || "",
        prueba_semiologica: profile?.prueba_semiologica || "",
        flexibilidad: profile?.flexibilidad || "",
        fuerza_muscular: profile?.fuerza_muscular || "",
        rangos_movimiento_articular: profile?.rangos_movimiento_articular || "",
        plan_intervencion: profile?.plan_intervencion || "",
        observaciones_generales: profile?.observaciones_generales || "",
      });

      setFinalized((appointmentData.status || "") === "finalizada");
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar la atenciÃ³n de fisioterapia.");
    } finally {
      setLoading(false);
    }
  }

  function validateBeforeFinalize() {
    const nextErrors: string[] = [];

    if (!form.presion_arterial.trim()) {
      nextErrors.push("La presiÃ³n arterial es obligatoria.");
    }
    if (!form.frecuencia_cardiaca.trim()) {
      nextErrors.push("La frecuencia cardiaca es obligatoria.");
    }
    if (!form.plan_intervencion.trim()) {
      nextErrors.push("El plan de intervenciÃ³n es obligatorio.");
    }

    return nextErrors;
  }

  async function ensureUser() {
    if (userId) return userId;
    if (!appointment) throw new Error("No hay cita cargada.");

    const payload = {
      nombre: appointment.patient_name?.trim() || "Cliente fisioterapia",
      documento: form.document.trim() || null,
      telefono: form.phone.trim() || appointment.phone || null,
      ciudad: form.city.trim() || appointment.city || null,
      ocupacion: "fisioterapia",
      estado_actual: "en valoracion fisioterapia",
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
          ? "pendiente_entrega_fisioterapia"
          : "en valoracion fisioterapia";

      const { error: userUpdateError } = await supabase
        .from("users")
        .update({
          nombre: appointment.patient_name?.trim() || null,
          documento: form.document.trim() || null,
          telefono: form.phone.trim() || null,
          ciudad: form.city.trim() || null,
          ocupacion: "fisioterapia",
          estado_actual: estadoActual,
        })
        .eq("id", ensuredUserId);

      if (userUpdateError) throw userUpdateError;

      const profilePayload = {
        user_id: ensuredUserId,
        antecedentes_patologicos: form.antecedentes_patologicos.trim() || null,
        cirugias: form.cirugias.trim() || null,
        toxicos: form.toxicos.trim() || null,
        alergicos: form.alergicos.trim() || null,
        medicamentos: form.medicamentos.trim() || null,
        familiares: form.familiares.trim() || null,
        analisis_comercial: form.analisis_comercial.trim() || null,
        presion_arterial: form.presion_arterial.trim() || null,
        frecuencia_cardiaca: form.frecuencia_cardiaca.trim() || null,
        inspeccion_general: form.inspeccion_general.trim() || null,
        dolor: form.dolor.trim() || null,
        inflamacion: form.inflamacion.trim() || null,
        limitacion_movilidad: form.limitacion_movilidad.trim() || null,
        prueba_semiologica: form.prueba_semiologica.trim() || null,
        flexibilidad: form.flexibilidad.trim() || null,
        fuerza_muscular: form.fuerza_muscular.trim() || null,
        rangos_movimiento_articular: form.rangos_movimiento_articular.trim() || null,
        plan_intervencion: form.plan_intervencion.trim() || null,
        observaciones_generales: form.observaciones_generales.trim() || null,
      };

      const { error: profileError } = await supabase
        .from("physiotherapy_profiles")
        .upsert([profilePayload], { onConflict: "user_id" });

      if (profileError) throw profileError;

      const appointmentUpdate: Record<string, any> = {
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
      };

      if (nextStatus) {
        appointmentUpdate.status = nextStatus;
        appointmentUpdate.notes = buildReceptionDeliveryFlag(appointment.notes);
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
              notes: nextStatus ? buildReceptionDeliveryFlag(prev.notes) : prev.notes,
            }
          : prev
      );

      if (nextStatus === "finalizada") {
        setFinalized(true);
        setMessage("Consulta finalizada. El cliente quedÃ³ pendiente para RecepciÃ³n.");
      } else {
        setMessage("Cambios guardados correctamente.");
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la atenciÃ³n de fisioterapia.");
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
          <p className="text-sm text-slate-500">Cargando atenciÃ³n de fisioterapia...</p>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{error || "No se encontrÃ³ la cita."}</p>
          <Link href="/fisioterapia/agenda" className="mt-4 inline-flex rounded-2xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B]">
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
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">MÃ³dulo de Fisioterapia</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">{appointment.patient_name || ""}</h1>
              <p className="mt-3 text-sm text-slate-600">
                Cita {appointment.id || ""} Â· Lead {appointment.lead_id || ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/fisioterapia/agenda"
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
                className="rounded-2xl border border-[#0DA56F] bg-white px-6 py-3 text-base font-semibold text-[#0DA56F] transition hover:bg-[#F4FAF6]"
              >
                Imprimir
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoBox label="Documento" value={form.document} />
            <InfoBox label="TelÃ©fono" value={form.phone} />
            <InfoBox label="Edad" value={form.age} />
            <InfoBox label="Sexo" value={form.sex} />
            <InfoBox label="Fecha" value={appointment.appointment_date || ""} />
            <InfoBox label="Hora" value={formatHora(appointment.appointment_time)} />
            <InfoBox label="Origen" value={appointment.service_type || ""} />
            <InfoBox label="Estado" value={traducirEstado(appointment.status)} />
          </div>
        </section>

        {commercialCase ? (
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Resumen comercial</h2>
            <p className="mt-1 text-sm text-slate-500">
              Esta información viene del cierre comercial y acompaña la atención del especialista.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoBox label="Servicio vendido" value={commercialCase.purchased_service || "Sin definir"} />
              <InfoBox label="Resultado" value={commercialCase.sale_result || "Sin definir"} />
              <InfoBox label="Forma de pago" value={paymentMethodLabel(commercialCase.payment_method)} />
              <InfoBox label="Origen comercial" value={sourceLabel(commercialCase.lead_source_type)} />
              <InfoBox label="Fuente comisión" value={sourceLabel(commercialCase.commission_source_type)} />
              <InfoBox label="Valor total" value={formatMoney(commercialCase.sale_value)} />
              <InfoBox label="Contado" value={formatMoney(commercialCase.cash_amount)} />
              <InfoBox label="Cartera" value={formatMoney(commercialCase.portfolio_amount)} />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ReadOnlyTextBlock
                label="Valoración comercial"
                value={commercialCase.sales_assessment}
              />
              <ReadOnlyTextBlock
                label="Propuesta comercial"
                value={commercialCase.proposal_text}
              />
              <ReadOnlyTextBlock
                label="Notas de cierre"
                value={commercialCase.closing_notes}
              />
              <ReadOnlyTextBlock
                label="Notas comerciales"
                value={parseStoredCommercialNotes(commercialCase.commercial_notes).commercialNotes}
              />
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
          <h2 className="text-2xl font-bold text-[#24312A]">InformaciÃ³n previa del paciente</h2>
          <p className="mt-1 text-sm text-slate-500">
            AquÃ­ puedes ver y modificar datos previos de recepciÃ³n y comercial.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SmallTextAreaField label="Antecedentes patolÃ³gicos" value={form.antecedentes_patologicos} onChange={(v) => updateField("antecedentes_patologicos", v)} />
            <SmallTextAreaField label="CirugÃ­as" value={form.cirugias} onChange={(v) => updateField("cirugias", v)} />
            <SmallTextAreaField label="TÃ³xicos" value={form.toxicos} onChange={(v) => updateField("toxicos", v)} />
            <SmallTextAreaField label="AlÃ©rgicos" value={form.alergicos} onChange={(v) => updateField("alergicos", v)} />
            <SmallTextAreaField label="Medicamentos" value={form.medicamentos} onChange={(v) => updateField("medicamentos", v)} />
            <SmallTextAreaField label="Familiares" value={form.familiares} onChange={(v) => updateField("familiares", v)} />
          </div>

          <div className="mt-4">
            <LargeTextAreaField label="AnÃ¡lisis comercial" value={form.analisis_comercial} onChange={(v) => updateField("analisis_comercial", v)} rows={5} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Signos vitales</h2>
            <div className="mt-5 space-y-4">
              <InputField label="PresiÃ³n arterial" value={form.presion_arterial} onChange={(v) => updateField("presion_arterial", v)} />
              <InputField label="Frecuencia cardiaca" value={form.frecuencia_cardiaca} onChange={(v) => updateField("frecuencia_cardiaca", v)} />
              <LargeTextAreaField label="InspecciÃ³n general" value={form.inspeccion_general} onChange={(v) => updateField("inspeccion_general", v)} rows={5} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Signos y sÃ­ntomas</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Dolor" value={form.dolor} onChange={(v) => updateField("dolor", v)} rows={4} />
              <LargeTextAreaField label="InflamaciÃ³n" value={form.inflamacion} onChange={(v) => updateField("inflamacion", v)} rows={4} />
              <LargeTextAreaField label="LimitaciÃ³n de movilidad" value={form.limitacion_movilidad} onChange={(v) => updateField("limitacion_movilidad", v)} rows={4} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Examen fÃ­sico</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Prueba semiolÃ³gica" value={form.prueba_semiologica} onChange={(v) => updateField("prueba_semiologica", v)} rows={4} />
              <LargeTextAreaField label="Flexibilidad" value={form.flexibilidad} onChange={(v) => updateField("flexibilidad", v)} rows={4} />
              <LargeTextAreaField label="Fuerza muscular" value={form.fuerza_muscular} onChange={(v) => updateField("fuerza_muscular", v)} rows={4} />
              <LargeTextAreaField label="Rangos de movimiento articular" value={form.rangos_movimiento_articular} onChange={(v) => updateField("rangos_movimiento_articular", v)} rows={4} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan de intervenciÃ³n</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Plan de intervenciÃ³n" value={form.plan_intervencion} onChange={(v) => updateField("plan_intervencion", v)} rows={8} />
              <LargeTextAreaField label="Observaciones generales" value={form.observaciones_generales} onChange={(v) => updateField("observaciones_generales", v)} rows={6} />
            </div>
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
      <p className="text-sm font-semibold uppercase tracking-wide text-[#657D9B]">{label}</p>
      <p className="mt-2 text-[#24312A]">{value || " "}</p>
    </div>
  );
}

function InputField({
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
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input
        className={inputClass}
        value={value}
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
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
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
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
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
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <div className="min-h-[140px] rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm leading-6 text-[#24312A]">
        {value?.trim() || "Sin información registrada."}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";



