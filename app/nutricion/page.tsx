"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, ClipboardPlus, UserPlus, Stethoscope } from "lucide-react";

const quickCards = [
  {
    title: "Abrir agenda",
    description: "Ver citas reales del día y abrir la atención nutricional.",
    href: "/nutricion/agenda",
    icon: CalendarDays,
  },
  {
    title: "Crear nuevo cliente",
    description: "Registrar un cliente nuevo desde cero, sin datos precargados.",
    href: "/nutricion/nuevo",
    icon: UserPlus,
  },
  {
    title: "Agendar cita",
    description: "Programar una cita con nutrición para un cliente del sistema.",
    href: "/nutricion/agendar",
    icon: ClipboardPlus,
  },
];

export default function NutricionHomePage() {
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
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-4 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">
                Módulo de Nutrición
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                Inicio de nutrición
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Desde aquí puedes abrir la agenda, crear un cliente nuevo o programar una cita
                sin usar datos de ejemplo.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Inicio
              </Link>
              <Link
                href="/nutricion/agenda"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Abrir agenda
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5F7D66]">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Accesos rápidos</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Escoge la acción que quieres realizar.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {quickCards.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group rounded-3xl border border-[#D6E8DA] bg-[#FBFCFB] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:bg-white hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-[#D6E8DA] bg-white p-3 text-[#5F7D66] transition group-hover:bg-[#F4FAF6]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#24312A]">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                        </div>
                      </div>

                      <span className="rounded-full border border-[#D6E8DA] bg-white px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                        Abrir
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Estado del módulo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Base limpia, sin pacientes ni citas de ejemplo.
            </p>

            <div className="mt-5 rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-6 text-sm text-slate-500">
              La agenda mostrará las citas reales que existan en el sistema.
              <br /><br />
              El formulario de nuevo cliente queda vacío para diligenciar desde cero.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
