"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createClinicalAttachment,
  createClinicalEvolution,
  ensureClinicalEncounter,
  getClinicalEncounterByAppointment,
  saveClinicalConsent,
  saveClinicalHistory,
  updateClinicalEncounterStatus,
} from "@/lib/clinical/client";
import type {
  ClinicalAttachment,
  ClinicalConsent,
  ClinicalEncounterBundle,
  ClinicalEvolution,
} from "@/lib/clinical/types";
import { supabase } from "@/lib/supabase";
import { buildPendingDeliveryNotes } from "@/lib/appointments/receptionDelivery";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";
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

const CLINICAL_CONSENT_CONFIG = [
  {
    type: "consentimiento_informado",
    label: "Consentimiento informado de atención",
  },
  {
    type: "autorizacion_tratamiento",
    label: "Autorización del tratamiento o plan recomendado",
  },
] as const;

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function traducirEstado(status: string | null | undefined) {
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
  return map[status || ""] || status || "";
}

function buildReceptionDeliveryFlag(currentNotes: string | null | undefined) {
  return buildPendingDeliveryNotes(currentNotes, "fisioterapia");
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function buildSummaryLines(lines: Array<[string, string | null | undefined]>) {
  const normalized = lines
    .map(([label, value]) => [label, (value || "").trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);

  return normalized.length > 0 ? normalized.join("\n") : null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function buildConsentValueMap(consents: ClinicalConsent[]) {
  return CLINICAL_CONSENT_CONFIG.reduce<Record<string, boolean>>((accumulator, item) => {
    const match = consents.find((consent) => consent.consent_type === item.type);
    accumulator[item.type] = Boolean(match?.accepted);
    return accumulator;
  }, {});
}

function buildConsentDateMap(consents: ClinicalConsent[]) {
  return CLINICAL_CONSENT_CONFIG.reduce<Record<string, string>>((accumulator, item) => {
    const match = consents.find((consent) => consent.consent_type === item.type);
    accumulator[item.type] = match?.accepted_at || match?.created_at || "";
    return accumulator;
  }, {});
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
  const [fallbackOccupation, setFallbackOccupation] = useState("");
  const [clinicalEncounterId, setClinicalEncounterId] = useState<string | null>(null);
  const [clinicalSyncWarning, setClinicalSyncWarning] = useState("");
  const [clinicalEvolutions, setClinicalEvolutions] = useState<ClinicalEvolution[]>([]);
  const [newEvolutionNote, setNewEvolutionNote] = useState("");
  const [evolutionSaving, setEvolutionSaving] = useState(false);
  const [clinicalConsentValues, setClinicalConsentValues] = useState<Record<string, boolean>>(
    () => buildConsentValueMap([])
  );
  const [clinicalConsentDates, setClinicalConsentDates] = useState<Record<string, string>>(
    () => buildConsentDateMap([])
  );
  const [consentSaving, setConsentSaving] = useState(false);
  const [clinicalAttachments, setClinicalAttachments] = useState<ClinicalAttachment[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentMimeType, setNewAttachmentMimeType] = useState("");
  const [attachmentSaving, setAttachmentSaving] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    void loadRealData();
  }, [appointmentId]);

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

  const specialistCommercialContext = useMemo(() => {
    const storedNotes = parseStoredCommercialNotes(commercialCase?.commercial_notes);
    return {
      commercialNotes: repairMojibake(storedNotes.commercialNotes || "").trim(),
      salesAssessment: repairMojibake(commercialCase?.sales_assessment || "").trim(),
      proposalText: repairMojibake(commercialCase?.proposal_text || "").trim(),
    };
  }, [commercialCase]);

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
      setClinicalSyncWarning("");
      setClinicalEncounterId(null);
      setClinicalEvolutions([]);
      setClinicalConsentValues(buildConsentValueMap([]));
      setClinicalConsentDates(buildConsentDateMap([]));
      setClinicalAttachments([]);
      setNewAttachmentName("");
      setNewAttachmentUrl("");
      setNewAttachmentMimeType("");

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

      const parsedReceptionSummary = parseSpecialistReceptionSummary(
        linkedCommercialCase?.commercial_notes,
        linkedCommercialCase?.sale_result,
        {
          document: foundUser?.documento,
          occupation: foundUser?.ocupacion,
        }
      );

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
      setFallbackOccupation(foundUser?.ocupacion || "");

      let clinicalBundle: ClinicalEncounterBundle | null = null;
      try {
        clinicalBundle = await getClinicalEncounterByAppointment(appointmentId, "fisioterapia");
      } catch {}

      if (clinicalBundle) {
        setClinicalEncounterId(clinicalBundle.encounter.id);
        setClinicalEvolutions(clinicalBundle.evolutions || []);
        setClinicalConsentValues(buildConsentValueMap(clinicalBundle.consents || []));
        setClinicalConsentDates(buildConsentDateMap(clinicalBundle.consents || []));
        setClinicalAttachments(clinicalBundle.attachments || []);
        setFallbackOccupation((current) => current || clinicalBundle?.patient?.occupation || "");
      }

      setForm({
        document: pickFirst(
          parsedReceptionSummary.document,
          foundUser?.documento,
          clinicalBundle?.patient?.document_number
        ),
        phone: pickFirst(
          appointmentData.phone,
          foundUser?.telefono,
          clinicalBundle?.patient?.phone
        ),
        city: pickFirst(
          appointmentData.city,
          foundUser?.ciudad,
          clinicalBundle?.patient?.city
        ),
        age: pickFirst(
          parsedReceptionSummary.age,
          clinicalBundle?.patient?.age != null ? String(clinicalBundle.patient.age) : ""
        ),
        sex: pickFirst(clinicalBundle?.patient?.sex),
        antecedentes_patologicos:
          profile?.antecedentes_patologicos || clinicalBundle?.background?.pathological || "",
        cirugias: profile?.cirugias || clinicalBundle?.background?.surgical || "",
        toxicos: profile?.toxicos || clinicalBundle?.background?.toxic || "",
        alergicos: profile?.alergicos || clinicalBundle?.background?.allergies || "",
        medicamentos: profile?.medicamentos || clinicalBundle?.background?.medications || "",
        familiares: profile?.familiares || clinicalBundle?.background?.family_history || "",
        analisis_comercial:
          profile?.analisis_comercial || clinicalBundle?.history?.chief_complaint || "",
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
        plan_intervencion:
          profile?.plan_intervencion || clinicalBundle?.history?.plan || "",
        observaciones_generales:
          profile?.observaciones_generales ||
          clinicalBundle?.history?.assessment ||
          clinicalBundle?.background?.notes ||
          "",
      });

      setFinalized((appointmentData.status || "") === "finalizada");
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar la atención de fisioterapia.");
    } finally {
      setLoading(false);
    }
  }

  function validateBeforeFinalize() {
    const nextErrors: string[] = [];

    if (!form.presion_arterial.trim()) {
      nextErrors.push("La presión arterial es obligatoria.");
    }
    if (!form.frecuencia_cardiaca.trim()) {
      nextErrors.push("La frecuencia cardiaca es obligatoria.");
    }
    if (!form.plan_intervencion.trim()) {
      nextErrors.push("El plan de intervención es obligatorio.");
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
    setClinicalSyncWarning("");

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

      try {
        const bundle = await ensureClinicalEncounter({
          appointmentId: appointment.id,
          specialty: "fisioterapia",
          patient: {
            source_user_id: ensuredUserId,
            source_lead_id: appointment.lead_id,
            full_name: appointment.patient_name?.trim() || "Paciente clinico",
            document_number: form.document.trim() || null,
            phone: form.phone.trim() || appointment.phone || null,
            city: form.city.trim() || appointment.city || null,
            eps: receptionSummary.eps || null,
            occupation: receptionSummary.occupation || fallbackOccupation || null,
            age: form.age.trim() ? Number(form.age) : null,
            sex: form.sex.trim() || null,
          },
        });

        setClinicalEncounterId(bundle.encounter.id);

        await saveClinicalHistory(bundle.encounter.id, {
          history: {
            chief_complaint: form.analisis_comercial.trim() || null,
            current_illness: buildSummaryLines([
              ["Dolor", form.dolor],
              ["Inflamacion", form.inflamacion],
              ["Limitacion de movilidad", form.limitacion_movilidad],
            ]),
            review_of_systems: null,
            physical_exam: buildSummaryLines([
              ["Presion arterial", form.presion_arterial],
              ["Frecuencia cardiaca", form.frecuencia_cardiaca],
              ["Inspeccion general", form.inspeccion_general],
              ["Prueba semiologica", form.prueba_semiologica],
              ["Flexibilidad", form.flexibilidad],
              ["Fuerza muscular", form.fuerza_muscular],
              ["Rangos de movimiento articular", form.rangos_movimiento_articular],
            ]),
            assessment: form.observaciones_generales.trim() || null,
            plan: form.plan_intervencion.trim() || null,
          },
          background: {
            pathological: form.antecedentes_patologicos.trim() || null,
            surgical: form.cirugias.trim() || null,
            toxic: form.toxicos.trim() || null,
            allergies: form.alergicos.trim() || null,
            medications: form.medicamentos.trim() || null,
            family_history: form.familiares.trim() || null,
            notes: form.observaciones_generales.trim() || null,
          },
        });

        if (nextStatus === "finalizada") {
          await updateClinicalEncounterStatus(bundle.encounter.id, "closed");
        }
      } catch {
        setClinicalSyncWarning(
          "Los cambios se guardaron, pero no se sincronizo la historia clinica segura."
        );
      }

      if (nextStatus === "finalizada") {
        setFinalized(true);
        setMessage("Consulta finalizada. El cliente quedó pendiente para Recepción.");
      } else {
        setMessage("Cambios guardados correctamente.");
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la atención de fisioterapia.");
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

  async function handleSaveEvolution() {
    const note = newEvolutionNote.trim();

    if (!appointment || !note) {
      setError("Escribe una evolución clínica antes de guardarla.");
      return;
    }

    setEvolutionSaving(true);
    setError("");
    setMessage("");

    try {
      const bundle = await ensureClinicalEncounter({
        appointmentId,
        specialty: "fisioterapia",
        specialistUserId: userId,
        patient: {
          source_user_id: userId,
          source_lead_id: appointment.lead_id,
          full_name: appointment.patient_name || "Paciente fisioterapia",
          document_number: form.document || null,
          phone: form.phone || appointment.phone || null,
          city: form.city || appointment.city || null,
          occupation: fallbackOccupation || null,
          age: form.age ? Number(form.age) || null : null,
          sex: form.sex || null,
        },
      });

      setClinicalEncounterId(bundle.encounter.id);

      const evolution = await createClinicalEvolution(bundle.encounter.id, {
        note,
      });

      setClinicalEvolutions((current) => [evolution, ...current]);
      setNewEvolutionNote("");
      setMessage("Evolución clínica guardada.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la evolución clínica."
      );
    } finally {
      setEvolutionSaving(false);
    }
  }

  async function handleSaveConsents() {
    if (!appointment) {
      setError("No se encontró la atención para guardar los consentimientos.");
      return;
    }

    setConsentSaving(true);
    setError("");
    setMessage("");

    try {
      const bundle = await ensureClinicalEncounter({
        appointmentId,
        specialty: "fisioterapia",
        specialistUserId: userId,
        patient: {
          source_user_id: userId,
          source_lead_id: appointment.lead_id,
          full_name: appointment.patient_name || "Paciente fisioterapia",
          document_number: form.document || null,
          phone: form.phone || appointment.phone || null,
          city: form.city || appointment.city || null,
          eps: receptionSummary.eps || null,
          occupation: fallbackOccupation || null,
          age: form.age ? Number(form.age) || null : null,
          sex: form.sex || null,
        },
      });

      setClinicalEncounterId(bundle.encounter.id);

      const savedConsents = await Promise.all(
        CLINICAL_CONSENT_CONFIG.map((item) =>
          saveClinicalConsent(bundle.encounter.id, {
            consentType: item.type,
            accepted: Boolean(clinicalConsentValues[item.type]),
          })
        )
      );

      setClinicalConsentValues(buildConsentValueMap(savedConsents));
      setClinicalConsentDates(buildConsentDateMap(savedConsents));
      setMessage("Consentimientos clínicos guardados.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron guardar los consentimientos clínicos."
      );
    } finally {
      setConsentSaving(false);
    }
  }

  async function handleSaveAttachment() {
    if (!appointment) {
      setError("No se encontró la atención para guardar el anexo.");
      return;
    }

    const fileName = newAttachmentName.trim();
    const fileUrl = newAttachmentUrl.trim();
    const mimeType = newAttachmentMimeType.trim();

    if (!fileName || !fileUrl) {
      setError("Debes ingresar nombre y URL o ruta del anexo.");
      return;
    }

    setAttachmentSaving(true);
    setError("");
    setMessage("");

    try {
      const bundle = await ensureClinicalEncounter({
        appointmentId,
        specialty: "fisioterapia",
        specialistUserId: userId,
        patient: {
          source_user_id: userId,
          source_lead_id: appointment.lead_id,
          full_name: appointment.patient_name || "Paciente fisioterapia",
          document_number: form.document || null,
          phone: form.phone || appointment.phone || null,
          city: form.city || appointment.city || null,
          eps: receptionSummary.eps || null,
          occupation: fallbackOccupation || null,
          age: form.age ? Number(form.age) || null : null,
          sex: form.sex || null,
        },
      });

      setClinicalEncounterId(bundle.encounter.id);

      const attachment = await createClinicalAttachment(bundle.encounter.id, {
        fileName,
        fileUrl,
        mimeType: mimeType || null,
      });

      setClinicalAttachments((current) => [attachment, ...current]);
      setNewAttachmentName("");
      setNewAttachmentUrl("");
      setNewAttachmentMimeType("");
      setMessage("Anexo clínico guardado.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el anexo clínico."
      );
    } finally {
      setAttachmentSaving(false);
    }
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">{repairMojibake("Cargando atención de fisioterapia...")}</p>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{repairMojibake(error || "No se encontró la cita.")}</p>
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
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">Módulo de Fisioterapia</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">{repairMojibake(appointment.patient_name || "")}</h1>
              <p className="mt-3 text-sm text-slate-600">
                Atención clínica programada
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
              <InfoBox label="Plan adquirido" value={acquiredPlanLabel} />
              <InfoBox label="Servicio agendado" value={specialistPlanLabel(appointment.service_type)} />
              <InfoBox label="Especialidad" value="Fisioterapia" />
            </div>
          </section>
        ) : null}

        {specialistCommercialContext.commercialNotes ||
        specialistCommercialContext.salesAssessment ||
        specialistCommercialContext.proposalText ? (
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Contexto comercial para especialista</h2>
            <p className="mt-1 text-sm text-slate-500">
              Resumen útil para orientar la consulta sin mostrar datos financieros ni de comisión.
            </p>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <ReadOnlyTextBlock
                label="Notas comerciales"
                value={specialistCommercialContext.commercialNotes}
              />
              <ReadOnlyTextBlock
                label="Valoración comercial"
                value={specialistCommercialContext.salesAssessment}
              />
              <ReadOnlyTextBlock
                label="Propuesta comercial"
                value={specialistCommercialContext.proposalText}
              />
            </div>
          </section>
        ) : null}

        {clinicalEncounterId ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
            Historia clínica segura enlazada para esta atención.
          </div>
        ) : null}

        {clinicalSyncWarning ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {clinicalSyncWarning}
          </div>
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Evoluciones clínicas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra el seguimiento clínico de esta atención en la capa segura.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveEvolution}
              disabled={evolutionSaving || !newEvolutionNote.trim()}
              className="rounded-2xl bg-[#2F6F4F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#285E43] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {evolutionSaving ? "Guardando..." : "Guardar evolución"}
            </button>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <LargeTextAreaField
              label="Nueva evolución"
              value={newEvolutionNote}
              onChange={setNewEvolutionNote}
              rows={6}
              placeholder="Describe evolución, respuesta al tratamiento, cambios funcionales o recomendaciones."
            />

            <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8FCF8] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5C7A67]">
                Historial
              </h3>

              <div className="mt-4 space-y-3">
                {clinicalEvolutions.length > 0 ? (
                  clinicalEvolutions.map((evolution) => (
                    <article
                      key={evolution.id}
                      className="rounded-2xl border border-[#D6E8DA] bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#6C8A78]">
                        {formatDateTime(evolution.evolution_date || evolution.created_at)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#24312A]">
                        {evolution.note}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-white p-4 text-sm text-slate-500">
                    Aún no hay evoluciones registradas para esta atención.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Consentimientos clínicos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Confirma los consentimientos básicos requeridos para esta atención.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveConsents}
              disabled={consentSaving}
              className="rounded-2xl border border-[#2F6F4F] px-5 py-3 text-sm font-semibold text-[#2F6F4F] transition hover:bg-[#F3FAF5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {consentSaving ? "Guardando..." : "Guardar consentimientos"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {CLINICAL_CONSENT_CONFIG.map((item) => (
              <label
                key={item.type}
                className="flex items-start gap-3 rounded-2xl border border-[#D6E8DA] bg-[#F8FCF8] p-4"
              >
                <input
                  type="checkbox"
                  checked={Boolean(clinicalConsentValues[item.type])}
                  onChange={(event) =>
                    setClinicalConsentValues((current) => ({
                      ...current,
                      [item.type]: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2F6F4F] focus:ring-[#2F6F4F]"
                />

                <div>
                  <p className="text-sm font-semibold text-[#24312A]">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {clinicalConsentDates[item.type]
                      ? `Registrado: ${formatDateTime(clinicalConsentDates[item.type])}`
                      : "Aún no registrado"}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Anexos clínicos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Registra enlaces o rutas de soportes clínicos asociados a esta atención.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveAttachment}
              disabled={attachmentSaving || !newAttachmentName.trim() || !newAttachmentUrl.trim()}
              className="rounded-2xl border border-[#2F6F4F] px-5 py-3 text-sm font-semibold text-[#2F6F4F] transition hover:bg-[#F3FAF5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {attachmentSaving ? "Guardando..." : "Guardar anexo"}
            </button>
          </div>

          <div className="mt-5 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4">
              <InputField
                label="Nombre del anexo"
                value={newAttachmentName}
                onChange={setNewAttachmentName}
                placeholder="Ej: Consentimiento firmado, fotografía de apoyo, orden externa"
              />
              <InputField
                label="URL o ruta del soporte"
                value={newAttachmentUrl}
                onChange={setNewAttachmentUrl}
                placeholder="https://... o ruta interna del documento"
              />
              <InputField
                label="Tipo o MIME (opcional)"
                value={newAttachmentMimeType}
                onChange={setNewAttachmentMimeType}
                placeholder="Ej: application/pdf, image/jpeg"
              />
            </div>

            <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8FCF8] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5C7A67]">
                Historial de anexos
              </h3>

              <div className="mt-4 space-y-3">
                {clinicalAttachments.length > 0 ? (
                  clinicalAttachments.map((attachment) => (
                    <article
                      key={attachment.id}
                      className="rounded-2xl border border-[#D6E8DA] bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-[#24312A]">{attachment.file_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {attachment.mime_type || "Sin tipo"} · {formatDateTime(attachment.created_at)}
                      </p>
                      <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-medium text-[#2F6F4F] underline underline-offset-4"
                      >
                        Abrir soporte
                      </a>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-white p-4 text-sm text-slate-500">
                    Aún no hay anexos clínicos registrados.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

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

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Signos vitales</h2>
            <div className="mt-5 space-y-4">
              <InputField label="Presión arterial" value={form.presion_arterial} onChange={(v) => updateField("presion_arterial", v)} />
              <InputField label="Frecuencia cardiaca" value={form.frecuencia_cardiaca} onChange={(v) => updateField("frecuencia_cardiaca", v)} />
              <LargeTextAreaField label="Inspección general" value={form.inspeccion_general} onChange={(v) => updateField("inspeccion_general", v)} rows={5} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Signos y síntomas</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Dolor" value={form.dolor} onChange={(v) => updateField("dolor", v)} rows={4} />
              <LargeTextAreaField label="Inflamación" value={form.inflamacion} onChange={(v) => updateField("inflamacion", v)} rows={4} />
              <LargeTextAreaField label="Limitación de movilidad" value={form.limitacion_movilidad} onChange={(v) => updateField("limitacion_movilidad", v)} rows={4} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Examen físico</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Prueba semiológica" value={form.prueba_semiologica} onChange={(v) => updateField("prueba_semiologica", v)} rows={4} />
              <LargeTextAreaField label="Flexibilidad" value={form.flexibilidad} onChange={(v) => updateField("flexibilidad", v)} rows={4} />
              <LargeTextAreaField label="Fuerza muscular" value={form.fuerza_muscular} onChange={(v) => updateField("fuerza_muscular", v)} rows={4} />
              <LargeTextAreaField label="Rangos de movimiento articular" value={form.rangos_movimiento_articular} onChange={(v) => updateField("rangos_movimiento_articular", v)} rows={4} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan de intervención</h2>
            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Plan de intervención" value={form.plan_intervencion} onChange={(v) => updateField("plan_intervencion", v)} rows={8} />
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
      <p className="text-sm font-semibold uppercase tracking-wide text-[#657D9B]">{repairMojibake(label)}</p>
      <p className="mt-2 text-[#24312A]">{repairMojibake(value || " ")}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
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
        placeholder={placeholder}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{repairMojibake(label)}</label>
      <textarea
        className={inputClass + " min-h-[160px] resize-none"}
        rows={rows}
        value={value}
        placeholder={placeholder}
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



