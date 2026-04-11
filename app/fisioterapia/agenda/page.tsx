"use client";

import Link from "next/link";
import Image from "next/image";

export default function FisioterapiaAgendaPage() {
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
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Agenda de fisioterapia</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Base visual para que luego la conectemos con citas reales, igual que Nutrición.
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
          <h2 className="text-2xl font-bold text-[#24312A]">Citas visibles</h2>
          <p className="mt-2 text-sm text-slate-500">
            Cuando la conectemos a Supabase, aquí aparecerán las citas reales de fisioterapia.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-6 text-sm text-slate-500">
            No hay citas cargadas aún en esta base inicial.
          </div>
        </section>
      </div>
    </main>
  );
}
