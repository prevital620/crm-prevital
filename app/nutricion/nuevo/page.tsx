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

      <div className="relative mx-auto max-w-5xl space-y-6">
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
                Registra un cliente nuevo para luego agendar la cita con nutrición o abrir la atención.
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
          <h2 className="text-2xl font-bold text-[#24312A]">Formulario básico</h2>
          <p className="mt-1 text-sm text-slate-500">
            Esta base te deja lista la pantalla para luego conectarla con Supabase.
          </p>

          <form className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre completo" />
              <Field label="Documento" />
              <Field label="Teléfono" />
              <Field label="Edad" type="number" />
              <Field label="Sexo" />
              <Field label="Ciudad" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Observaciones</label>
              <textarea className={inputClass + " min-h-[120px] resize-none"} />
            </div>

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
          </form>
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

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
