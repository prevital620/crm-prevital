"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

type FormState = {
  nombre: string;
  documento: string;
  telefono: string;
  edad: string;
  sexo: string;
  ciudad: string;
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

const initialForm: FormState = {
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
};

export default function NutricionNuevoClientePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!form.nombre.trim()) throw new Error("El nombre completo es obligatorio.");
      if (!form.documento.trim()) throw new Error("El documento es obligatorio.");
      if (!form.telefono.trim()) throw new Error("El teléfono es obligatorio.");

      const { data: existingUsers, error: existingError } = await supabase
        .from("users")
        .select("id")
        .or(`documento.eq.${form.documento.trim()},telefono.eq.${form.telefono.trim()}`)
        .limit(1);

      if (existingError) throw existingError;
      if (existingUsers && existingUsers.length > 0) {
        throw new Error("Este cliente ya existe. Usa la agenda o agendar cita.");
      }

      const { data: insertedUser, error: insertUserError } = await supabase
        .from("users")
        .insert([
          {
            nombre: form.nombre.trim(),
            documento: form.documento.trim(),
            telefono: form.telefono.trim(),
            ciudad: form.ciudad.trim() || null,
            ocupacion: "nutricion",
            estado_actual: "nuevo cliente nutricion",
          },
        ])
        .select("id")
        .single();

      if (insertUserError) throw insertUserError;

      const { error: nutritionError } = await supabase
        .from("nutrition_profiles")
        .insert([
          {
            user_id: insertedUser.id,
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
            dinamometria: form.dinamometria.trim() || null,
            masa_muscular: form.masa_muscular.trim() || null,
            metabolismo_reposo: form.metabolismo_reposo.trim() || null,
            grasa_visceral: form.grasa_visceral.trim() || null,
            edad_corporal: form.edad_corporal.trim() || null,
            circunferencia_cintura: form.circunferencia_cintura.trim() || null,
            perimetro_pantorrilla: form.perimetro_pantorrilla.trim() || null,
            clasificacion_nutricional: form.clasificacion_nutricional || null,
            objetivo_nutricional: form.objetivo_nutricional.trim() || null,
            recomendaciones_nutricionales: form.recomendaciones_nutricionales.trim() || null,
            datos_alimentarios: form.datos_alimentarios.trim() || null,
            plan_nutricional: form.plan_nutricional.trim() || null,
            observaciones_generales: form.observaciones_generales.trim() || null,
          },
        ]);

      if (nutritionError) throw nutritionError;

      setMessage("Cliente nuevo guardado correctamente.");
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
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

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">
                Módulo de Nutrición
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                Crear nuevo cliente
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Esta pantalla queda vacía para diligenciar clientes reales desde cero.
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

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Datos básicos del cliente</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nombre completo" value={form.nombre} onChange={(v) => updateField("nombre", v)} />
              <Field label="Documento" value={form.documento} onChange={(v) => updateField("documento", v)} />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => updateField("telefono", v)} />
              <Field label="Edad" type="number" value={form.edad} onChange={(v) => updateField("edad", v)} />
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

          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Formulario nutricional</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {metricFields.map((field) => (
                <Field
                  key={field.key}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={form[field.key]}
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Clasificación nutricional
                  </label>
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
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cliente"}
              </button>

              <Link
                href="/nutricion/agendar"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Ir a agendar cita
              </Link>

              <Link
                href="/nutricion/agenda"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Ver agenda
              </Link>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      <input
        className={inputClass}
        type={type}
        placeholder={placeholder}
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

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
