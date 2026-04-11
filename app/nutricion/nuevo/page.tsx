"use client";

import Link from "next/link";
import Image from "next/image";

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

const metricFields = [
  { label: "Peso", placeholder: "Ej: 70 kg" },
  { label: "Talla", placeholder: "Ej: 1.65 m" },
  { label: "Perímetro brazo", placeholder: "Ej: 28 cm" },
  { label: "Índice masa corporal", placeholder: "Ej: 25" },
  { label: "Porcentaje masa corporal", placeholder: "Ej: 30%" },
  { label: "Masa muscular", placeholder: "Ej: 42 kg" },
  { label: "Metabolismo en reposo", placeholder: "Ej: 1450 kcal" },
  { label: "Grasa visceral", placeholder: "Ej: 8" },
  { label: "Edad corporal", placeholder: "Ej: 40" },
  { label: "Circunferencia cintura", placeholder: "Ej: 86 cm" },
  { label: "Perímetro pantorrilla", placeholder: "Ej: 35 cm" },
];

export default function NutricionNuevoClientePage() {
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

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">
                Módulo de Nutrición
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                Crear nuevo cliente
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Como es un cliente nuevo, la nutricionista puede diligenciar desde cero los
                datos básicos, antecedentes personales y la valoración nutricional inicial.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/nutricion"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Volver
              </Link>

              <Link
                href="/nutricion/agendar"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Ir a agendar cita
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Datos básicos del cliente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Información inicial para crear la ficha del paciente.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Nombre completo" />
            <Field label="Documento" />
            <Field label="Teléfono" />
            <Field label="Edad" type="number" />
            <Field label="Sexo" />
            <Field label="Ciudad" />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Antecedentes personales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Estos cuadros quedan más pequeños porque normalmente llevan información corta o resumida.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SmallTextAreaField label="Antecedentes patológicos" />
            <SmallTextAreaField label="Cirugías" />
            <SmallTextAreaField label="Tóxicos" />
            <SmallTextAreaField label="Alérgicos" />
            <SmallTextAreaField label="Medicamentos" />
            <SmallTextAreaField label="Familiares" />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Formulario nutricional</h2>
          <p className="mt-1 text-sm text-slate-500">
            Medidas y composición corporal para la valoración inicial.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {metricFields.map((field) => (
              <Field
                key={field.label}
                label={field.label}
                placeholder={field.placeholder}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Clasificación y objetivos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Resultado inicial de la valoración nutricional.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Clasificación nutricional
                </label>
                <select className={inputClass} defaultValue="">
                  <option value="">Selecciona</option>
                  {classificationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <LargeTextAreaField label="Objetivo nutricional" rows={5} />
              <LargeTextAreaField label="Recomendaciones nutricionales" rows={6} />
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Plan y datos alimentarios</h2>
            <p className="mt-1 text-sm text-slate-500">
              Campos amplios para describir la conducta nutricional y el plan inicial.
            </p>

            <div className="mt-5 space-y-4">
              <LargeTextAreaField label="Datos alimentarios" rows={7} />
              <LargeTextAreaField label="Plan nutricional" rows={7} />
              <LargeTextAreaField label="Observaciones generales" rows={5} />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Guardar cliente
            </button>

            <Link
              href="/nutricion/agendar"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#0B8E5F]"
            >
              Guardar y agendar cita
            </Link>

            <Link
              href="/nutricion/agenda"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Ver agenda
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  type = "text",
  placeholder = "",
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input className={inputClass} type={type} placeholder={placeholder} />
    </div>
  );
}

function SmallTextAreaField({
  label,
}: {
  label: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        className={inputClass + " min-h-[110px] resize-none"}
        rows={3}
      />
    </div>
  );
}

function LargeTextAreaField({
  label,
  rows = 6,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        className={inputClass + " min-h-[160px] resize-none"}
        rows={rows}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
