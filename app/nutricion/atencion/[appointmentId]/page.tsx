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
  "Preobeso",
  "Obesidad",
  "Obesidad grado 1",
  "Obesidad grado 2",
  "Obesidad grado 3",
];

const metricFields: Array<{ key: keyof NutritionAssessment; label: string }> = [
  { key: "weight", label: "Peso" },
  { key: "height", label: "Talla" },
  { key: "armPerimeter", label: "Perímetro brazo" },
  { key: "bodyMassIndex", label: "Índice masa corporal" },
  { key: "bodyFatPercentage", label: "Porcentaje masa corporal" },
  { key: "muscleMass", label: "Masa muscular" },
  { key: "restingMetabolism", label: "Metabolismo en reposo" },
  { key: "visceralFat", label: "Grasa visceral" },
  { key: "bodyAge", label: "Edad corporal" },
  { key: "waistCircumference", label: "Circunferencia cintura" },
  { key: "calfPerimeter", label: "Perímetro pantorrilla" },
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

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <CardSection
              title="Información previa del paciente"
              description="Estos antecedentes pueden venir precargados desde recepción o comercial, pero la nutricionista puede modificarlos."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="Antecedentes patológicos"
                  value={history.patologicos}
                  onChange={(value) => updateHistoryField("patologicos", value)}
                  rows={4}
                />
                <TextAreaField
                  label="Cirugías"
                  value={history.cirugias}
                  onChange={(value) => updateHistoryField("cirugias", value)}
                  rows={4}
                />
                <TextAreaField
                  label="Tóxicos"
                  value={history.toxicos}
                  onChange={(value) => updateHistoryField("toxicos", value)}
                  rows={4}
                />
                <TextAreaField
                  label="Alérgicos"
                  value={history.alergicos}
                  onChange={(value) => updateHistoryField("alergicos", value)}
                  rows={4}
                />
                <TextAreaField
                  label="Medicamentos"
                  value={history.medicamentos}
                  onChange={(value) => updateHistoryField("medicamentos", value)}
                  rows={4}
                />
                <TextAreaField
                  label="Familiares"
                  value={history.familiares}
                  onChange={(value) => updateHistoryField("familiares", value)}
                  rows={4}
                />
              </div>
            </CardSection>

            <CardSection
              title="Datos alimentarios"
              description="Aquí la nutricionista registra hábitos, horarios, preferencias y observaciones alimentarias."
            >
              <TextAreaField
                label="Datos alimentarios"
                value={assessment.foodData}
                onChange={(value) => updateAssessmentField("foodData", value)}
                rows={10}
              />
            </CardSection>
          </div>

          <div className="space-y-6">
            <CardSection
              title="Medidas y composición corporal"
              description="Campos para la valoración antropométrica y composición corporal."
            >
              <div className="grid gap-4 md:grid-cols-2">
                {metricFields.map((field) => (
                  <InputField
                    key={field.key}
                    label={field.label}
                    value={assessment[field.key] as string}
                    onChange={(value) => updateAssessmentField(field.key, value)}
                  />
                ))}
              </div>
            </CardSection>

            <CardSection
              title="Resultado nutricional"
              description="Conclusiones y plan nutricional que se imprimirán y quedarán visibles para recepción."
            >
              <div className="space-y-4">
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

                <TextAreaField
                  label="Objetivo nutricional"
                  value={assessment.nutritionalObjective}
                  onChange={(value) => updateAssessmentField("nutritionalObjective", value)}
                  rows={4}
                />

                <TextAreaField
                  label="Recomendaciones nutricionales"
                  value={assessment.nutritionalRecommendations}
                  onChange={(value) =>
                    updateAssessmentField("nutritionalRecommendations", value)
                  }
                  rows={5}
                />

                <TextAreaField
                  label="Plan nutricional"
                  value={assessment.nutritionalPlan}
                  onChange={(value) => updateAssessmentField("nutritionalPlan", value)}
                  rows={6}
                />
              </div>
            </CardSection>
          </div>
        </section>
      </div>
    </main>
  );
}

function CardSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-[#24312A]">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
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
      <p className="mt-2 text-2sm text-[#24312A]">{value}</p>
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

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
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
        className={inputClass + " min-h-[120px] resize-none"}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
