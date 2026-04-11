"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function FisioterapiaNuevoPage() {
  const [form, setForm] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    edad: "",
    sexo: "",
    ciudad: "",
    antecedentes_patologicos: "",
    cirugias: "",
    toxicos: "",
    alergicos: "",
    medicamentos: "",
    familiares: "",
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
  });

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">Módulo de Fisioterapia</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Crear nuevo cliente</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Base visual para nuevos clientes de fisioterapia.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/fisioterapia" className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]">
                Volver
              </Link>
              <Link href="/fisioterapia/agendar" className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]">
                Agendar cita
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Datos básicos</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Nombre completo" value={form.nombre} onChange={(v) => updateField("nombre", v)} />
            <Field label="Documento" value={form.documento} onChange={(v) => updateField("documento", v)} />
            <Field label="Teléfono" value={form.telefono} onChange={(v) => updateField("telefono", v)} />
            <Field label="Edad" value={form.edad} onChange={(v) => updateField("edad", v)} />
            <Field label="Sexo" value={form.sexo} onChange={(v) => updateField("sexo", v)} />
            <Field label="Ciudad" value={form.ciudad} onChange={(v) => updateField("ciudad", v)} />
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-[#24312A]">Antecedentes personales</h2>
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
              <Field label="Presión arterial" value={form.presion_arterial} onChange={(v) => updateField("presion_arterial", v)} />
              <Field label="Frecuencia cardiaca" value={form.frecuencia_cardiaca} onChange={(v) => updateField("frecuencia_cardiaca", v)} />
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
              <LargeTextAreaField label="Plan de intervención" value={form.plan_intervencion} onChange={(v) => updateField("plan_intervencion", v)} rows={12} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
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
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
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
      <textarea className={inputClass + " min-h-[110px] resize-none"} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
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
      <textarea className={inputClass + " min-h-[160px] resize-none"} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
