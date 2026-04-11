"use client";

import Link from "next/link";
import Image from "next/image";

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

      <div className="relative mx-auto max-w-6xl space-y-6">
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
                Como es un cliente nuevo, la nutricionista debe diligenciar los datos básicos y
                también todos los antecedentes antes de agendar la cita o pasar a la atención.
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

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            Estos campos deben llenarse porque el cliente es nuevo y aún no tiene información previa cargada.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextAreaField label="Antecedentes patológicos" />
            <TextAreaField label="Cirugías" />
            <TextAreaField label="Tóxicos" />
            <TextAreaField label="Alérgicos" />
            <TextAreaField label="Medicamentos" />
            <TextAreaField label="Familiares" />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Observaciones</h2>
          <p className="mt-1 text-sm text-slate-500">
            Espacio adicional para dejar notas relevantes antes de agendar o atender.
          </p>

          <div className="mt-5">
            <TextAreaField label="Observaciones generales" rows={6} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
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
}: {
  label: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input className={inputClass} type={type} />
    </div>
  );
}

function TextAreaField({
  label,
  rows = 5,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <textarea className={inputClass + " min-h-[120px] resize-none"} rows={rows} />
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
