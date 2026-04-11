"use client"

import { useMemo, useState } from "react"
import { NUTRITION_CLASSIFICATIONS } from "@/lib/nutrition/nutritionClassification"
import { NUTRITION_METRIC_FIELDS } from "@/lib/nutrition/nutritionFields"
import {
  NUTRITION_STATUSES,
  canFinalizeNutrition,
} from "@/lib/status/nutritionStatus"
import { validateNutritionBeforeFinalize } from "@/lib/nutrition/nutritionValidators"

type NutritionFormState = {
  foodData: string
  weight: string
  height: string
  armPerimeter: string
  bodyMassIndex: string
  bodyFatPercentage: string
  muscleMass: string
  restingMetabolism: string
  visceralFat: string
  bodyAge: string
  waistCircumference: string
  calfPerimeter: string
  nutritionalClassification: string
  nutritionalObjective: string
  nutritionalRecommendations: string
  nutritionalPlan: string
}

const initialForm: NutritionFormState = {
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
}

const mockPatient = {
  appointmentId: "NUT-001",
  leadId: "LD-1001",
  patientName: "Paciente de ejemplo",
  document: "1234567890",
  phone: "3000000000",
  age: 45,
  sex: "Femenino",
  date: new Date().toLocaleDateString("es-CO"),
  time: "08:00 AM",
  status: NUTRITION_STATUSES.SCHEDULED,
  specialistName: "Nutricionista",
  source: "Comercial",
}

const mockPreviousInfo = {
  receptionPathologicalHistory: "Antecedentes patológicos cargados por recepción.",
  receptionFamilyHistory: "Antecedentes familiares cargados por recepción.",
  commercialFamilyHistory: "Antecedentes familiares reportados en comercial.",
  commercialToxicHistory: "Antecedentes tóxicos reportados en comercial.",
  commercialAllergicHistory: "Antecedentes alérgicos reportados en comercial.",
  commercialMedications: "Medicamentos reportados en comercial.",
  commercialAnalysis: "Análisis comercial cargado por el asesor.",
}

type SectionCardProps = {
  title: string
  children: React.ReactNode
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

type InfoRowProps = {
  label: string
  value?: string | number | null
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value || "Sin dato"}</p>
    </div>
  )
}

type MetricFieldProps = {
  label: string
  name: keyof NutritionFormState
  value: string
  onChange: (name: keyof NutritionFormState, value: string) => void
}

function MetricField({ label, name, value, onChange }: MetricFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
      />
    </label>
  )
}

type TextAreaFieldProps = {
  label: string
  name: keyof NutritionFormState
  value: string
  rows?: number
  onChange: (name: keyof NutritionFormState, value: string) => void
}

function TextAreaField({
  label,
  name,
  value,
  rows = 4,
  onChange,
}: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
      />
    </label>
  )
}

export default function NutricionPage() {
  const [status, setStatus] = useState<string>(mockPatient.status)
  const [form, setForm] = useState<NutritionFormState>(initialForm)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string>("")

  const metrics = useMemo(() => NUTRITION_METRIC_FIELDS, [])

  function updateField(name: keyof NutritionFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function handleSave() {
    setErrors([])
    setMessage("Cambios guardados localmente. Falta conectar backend/DB.")
  }

  function handleFinalize() {
    const validationErrors = validateNutritionBeforeFinalize({
      nutritionalClassification: form.nutritionalClassification,
      nutritionalObjective: form.nutritionalObjective,
      nutritionalPlan: form.nutritionalPlan,
    })

    if (!validationErrors.isValid) {
  setErrors(validationErrors.errors)
  setMessage("")
  return
}

    setErrors([])
    setStatus(NUTRITION_STATUSES.COMPLETED)
    setMessage(
      "Consulta finalizada correctamente. Falta conectar envío en tiempo real a Recepción.",
    )
  }

  function handlePrint() {
    window.print()
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Módulo de nutrición
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {mockPatient.patientName}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Cita {mockPatient.appointmentId} · Lead {mockPatient.leadId}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={!canFinalizeNutrition(status)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Finalizar consulta
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-xl border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
              >
                Imprimir
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <InfoRow label="Documento" value={mockPatient.document} />
            <InfoRow label="Teléfono" value={mockPatient.phone} />
            <InfoRow label="Edad" value={mockPatient.age} />
            <InfoRow label="Sexo" value={mockPatient.sex} />
            <InfoRow label="Fecha" value={mockPatient.date} />
            <InfoRow label="Hora" value={mockPatient.time} />
            <InfoRow label="Origen" value={mockPatient.source} />
            <InfoRow label="Estado" value={status} />
          </div>

          {errors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">Revisa estos campos:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-rose-700">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <SectionCard title="Información previa del paciente">
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Recepción
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow
                    label="Antecedentes patológicos"
                    value={mockPreviousInfo.receptionPathologicalHistory}
                  />
                  <InfoRow
                    label="Antecedentes familiares"
                    value={mockPreviousInfo.receptionFamilyHistory}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Comercial
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow
                    label="Antecedentes familiares"
                    value={mockPreviousInfo.commercialFamilyHistory}
                  />
                  <InfoRow
                    label="Antecedentes tóxicos"
                    value={mockPreviousInfo.commercialToxicHistory}
                  />
                  <InfoRow
                    label="Antecedentes alérgicos"
                    value={mockPreviousInfo.commercialAllergicHistory}
                  />
                  <InfoRow
                    label="Medicamentos"
                    value={mockPreviousInfo.commercialMedications}
                  />
                  <div className="md:col-span-2">
                    <InfoRow
                      label="Análisis comercial"
                      value={mockPreviousInfo.commercialAnalysis}
                    />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Datos alimentarios">
            <TextAreaField
              label="Datos alimentarios"
              name="foodData"
              value={form.foodData}
              rows={14}
              onChange={updateField}
            />
          </SectionCard>
        </div>

        <SectionCard title="Medidas y composición corporal">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metrics.map((field) => (
              <MetricField
                key={field.key}
                label={field.label}
                name={field.key}
                value={form[field.key]}
                onChange={updateField}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Resultado nutricional">
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Clasificación nutricional
              </span>
              <select
                name="nutritionalClassification"
                value={form.nutritionalClassification}
                onChange={(event) =>
                  updateField("nutritionalClassification", event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
              >
                <option value="">Selecciona una clasificación</option>
                {NUTRITION_CLASSIFICATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <TextAreaField
              label="Objetivo nutricional"
              name="nutritionalObjective"
              value={form.nutritionalObjective}
              rows={4}
              onChange={updateField}
            />

            <div className="lg:col-span-2">
              <TextAreaField
                label="Recomendaciones nutricionales"
                name="nutritionalRecommendations"
                value={form.nutritionalRecommendations}
                rows={5}
                onChange={updateField}
              />
            </div>

            <div className="lg:col-span-2">
              <TextAreaField
                label="Plan nutricional"
                name="nutritionalPlan"
                value={form.nutritionalPlan}
                rows={6}
                onChange={updateField}
              />
            </div>
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
