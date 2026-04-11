"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type PatientContext = {
  appointmentId: string;
  leadId: string;
  patientName: string;
  document: string;
  phone: string;
  age: string;
  sex: string;
  date: string;
  time: string;
  source: string;
  status: string;
};

type EditableHistory = {
  patologicos: string;
  cirugias: string;
  toxicos: string;
  alergicos: string;
  medicamentos: string;
  familiares: string;
};

type NutritionAssessment = {
  foodData: string;
  weight: string;
  height: string;
  armPerimeter: string;
  bodyMassIndex: string;
  bodyFatPercentage: string;
  muscleMass: string;
  restingMetabolism: string;
  visceralFat: string;
  bodyAge: string;
  waistCircumference: string;
  calfPerimeter: string;
  nutritionalClassification: string;
  nutritionalObjective: string;
  nutritionalRecommendations: string;
  nutritionalPlan: string;
};

const patientContext: PatientContext = {
  appointmentId: "NUT-001",
  leadId: "LD-1001",
  patientName: "Paciente de ejemplo",
  document: "1234567890",
  phone: "3000000000",
  age: "45",
  sex: "Femenino",
  date: "11/4/2026",
  time: "08:00 AM",
  source: "Comercial",
  status: "Agendada",
};

const initialHistory: EditableHistory = {
  patologicos: "Antecedentes patológicos cargados previamente.",
  cirugias: "Cirugías reportadas previamente por el paciente.",
  toxicos: "Antecedentes tóxicos reportados previamente.",
  alergicos: "Antecedentes alérgicos reportados previamente.",
  medicamentos: "Medicamentos reportados previamente.",
  familiares: "Antecedentes familiares cargados previamente.",
};

const initialAssessment: NutritionAssessment = {
  foodData: "",
  weight: "",
  height: "",
  armPerimeter: "",
  bodyMassIndex: "",
  bodyFatPercentage: "",
  muscleMass: "",
  restingMetabolism: "",
  visceralFat: "",
  bodyAge: "",
  waistCircumference: "",
  calfPerimeter: "",
  nutritionalClassification: "",
  nutritionalObjective: "",
  nutritionalRecommendations: "",
  nutritionalPlan: "",
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
  key: keyof NutritionAssessment;
  label: string;
  placeholder: string;
}> = [
  { key: "weight", label: "Peso", placeholder: "Ej: 70 kg" },
  { key: "height", label: "Talla", placeholder: "Ej: 1.65 m" },
  { key: "armPerimeter", label: "Perímetro brazo", placeholder: "Ej: 28 cm" },
  { key: "bodyMassIndex", label: "Índice masa corporal", placeholder: "Ej: 25" },
  { key: "bodyFatPercentage", label: "Porcentaje masa corporal", placeholder: "Ej: 30%" },
  { key: "muscleMass", label: "Masa muscular", placeholder: "Ej: 42 kg" },
  { key: "restingMetabolism", label: "Metabolismo en reposo", placeholder: "Ej: 1450 kcal" },
  { key: "visceralFat", label: "Grasa visceral", placeholder: "Ej: 8" },
  { key: "bodyAge", label: "Edad corporal", placeholder: "Ej: 40" },
  { key: "waistCircumference", label: "Circunferencia cintura", placeholder: "Ej: 86 cm" },
  { key: "calfPerimeter", label: "Perímetro pantorrilla", placeholder: "Ej: 35 cm" },
];

export default function NutricionAtencionPage() {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<EditableHistory>(initialHistory);
  const [assessment, setAssessment] = useState<NutritionAssessment>(initialAssessment);

  const canPrint = useMemo(() => {
    return (
      assessment.nutritionalPlan.trim().length > 0 ||
      assessment.nutritionalRecommendations.trim().length > 0
    );
  }, [assessment]);

  function updateHistoryField(key: keyof EditableHistory, value: string) {
    setHistory((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateAssessmentField(key: keyof NutritionAssessment, value: string) {
    setAssessment((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function validateBeforeFinalize() {
    const nextErrors: string[] = [];

    if (!assessment.nutritionalClassification.trim()) {
      nextErrors.push("La clasificación nutricional es obligatoria.");
    }

    if (!assessment.nutritionalObjective.trim()) {
      nextErrors.push("El objetivo nutricional es obligatorio.");
    }

    if (!assessment.nutritionalPlan.trim()) {
      nextErrors.push("El plan nutricional es obligatorio.");
    }

    return nextErrors;
  }

  function handleSave() {
    setErrors([]);
    setMessage("Cambios guardados correctamente en la valoración nutricional.");
  }

  function handleFinalize() {
    const validationErrors = validateBeforeFinalize();

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setMessage("");
      return;
    }

    setErrors([]);
    setMessage("Consulta finalizada correctamente. La información ya puede verse en recepción.");
  }

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.04] md:h-[540px] md:w-[540px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-4 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">
                Módulo de Nutrición
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                {patientContext.patientName}
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Cita {patientContext.appointmentId} · Lead {patientContext.leadId}
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
                className="rounded-2xl border border-[#D6E8DA] bg-white px-6 py-3 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Guardar
              </button>

              <button
                type="button"
                onClick={handleFinalize}
                className="rounded-2xl bg-[#0DA56F] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Finalizar consulta
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
            <InfoBox label="Documento" value={patientContext.document} />
            <InfoBox label="Teléfono" value={patientContext.phone} />
            <InfoBox label="Edad" value={patientContext.age} />
            <InfoBox label="Sexo" value={patientContext.sex} />
            <InfoBox label="Fecha" value={patientContext.date} />
            <InfoBox label="Hora" value={patientContext.time} />
            <InfoBox label="Origen" value={patientContext.source} />
            <InfoBox label="Estado" value={patientContext.status} />
          </div>
        </section>

        {errors.length > 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Debes revisar lo siguiente:</p>
            <ul className="mt-2 space-y-1">
              {errors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
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
            Si el paciente ya existe, estos datos aparecen cargados. La nutricionista puede modificarlos.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SmallTextAreaField
              label="Antecedentes patológicos"
              value={history.patologicos}
              onChange={(value) => updateHistoryField("patologicos", value)}
            />
            <SmallTextAreaField
              label="Cirugías"
              value={history.cirugias}
              onChange={(value) => updateHistoryField("cirugias", value)}
            />
            <SmallTextAreaField
              label="Tóxicos"
              value={history.toxicos}
              onChange={(value) => updateHistoryField("toxicos", value)}
            />
            <SmallTextAreaField
              label="Alérgicos"
              value={history.alergicos}
              onChange={(value) => updateHistoryField("alergicos", value)}
            />
            <SmallTextAreaField
              label="Medicamentos"
              value={history.medicamentos}
              onChange={(value) => updateHistoryField("medicamentos", value)}
            />
            <SmallTextAreaField
              label="Familiares"
              value={history.familiares}
              onChange={(value) => updateHistoryField("familiares", value)}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Formulario nutricional</h2>
          <p className="mt-1 text-sm text-slate-500">
            Medidas y composición corporal para la valoración nutricional.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricFields.map((field) => (
              <InputField
                key={field.key}
                label={field.label}
                value={assessment[field.key] as string}
                placeholder={field.placeholder}
                onChange={(value) => updateAssessmentField(field.key, value)}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Clasificación y objetivos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Resultado nutricional y recomendaciones generales.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Clasificación nutricional
                </label>
                <select
                  className={inputClass}
                  value={assessment.nutritionalClassification}
                  onChange={(e) =>
                    updateAssessmentField("nutritionalClassification", e.target.value)
                  }
                >
                  <option value="">Selecciona</option>
                  {classificationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <LargeTextAreaField
                label="Objetivo nutricional"
                value={assessment.nutritionalObjective}
                onChange={(value) => updateAssessmentField("nutritionalObjective", value)}
                rows={5}
              />

              <LargeTextAreaField
                label="Recomendaciones nutricionales"
                value={assessment.nutritionalRecommendations}
                onChange={(value) =>
                  updateAssessmentField("nutritionalRecommendations", value)
                }
                rows={6}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan y datos alimentarios</h2>
            <p className="mt-1 text-sm text-slate-500">
              Campos amplios para registrar hábitos, conducta y plan nutricional.
            </p>

            <div className="mt-5 space-y-4">
              <LargeTextAreaField
                label="Datos alimentarios"
                value={assessment.foodData}
                onChange={(value) => updateAssessmentField("foodData", value)}
                rows={7}
              />

              <LargeTextAreaField
                label="Plan nutricional"
                value={assessment.nutritionalPlan}
                onChange={(value) => updateAssessmentField("nutritionalPlan", value)}
                rows={7}
              />
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
      <p className="mt-2 text-[#24312A]">{value}</p>
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
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
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

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
