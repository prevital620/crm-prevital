"use client";

import Link from "next/link";
import Image from "next/image";

const appointments = [
  {
    id: "NUT-001",
    patientName: "Paciente de ejemplo",
    phone: "3000000000",
    date: "2026-04-11",
    time: "08:00",
    status: "Agendada",
    href: "/nutricion/atencion/NUT-001",
  },
  {
    id: "NUT-002",
    patientName: "María López",
    phone: "3011111111",
    date: "2026-04-11",
    time: "09:00",
    status: "En espera",
    href: "/nutricion/atencion/NUT-002",
  },
  {
    id: "NUT-003",
    patientName: "Carlos Gómez",
    phone: "3022222222",
    date: "2026-04-11",
    time: "10:30",
    status: "Finalizada",
    href: "/nutricion/atencion/NUT-003",
  },
];

export default function NutricionAgendaPage() {
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
                Agenda de nutrición
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Selecciona la cita que vas a atender para abrir la información previa del paciente
                y continuar con la valoración nutricional.
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
                Agendar cita
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Citas visibles</h2>
              <p className="mt-1 text-sm text-slate-500">
                Haz clic en “Abrir atención” para cargar el paciente.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
                placeholder="Buscar por nombre o teléfono"
              />
              <input
                className="rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
                type="date"
                defaultValue="2026-04-11"
              />
            </div>
          </div>

          <div className="space-y-4">
            {appointments.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-[#D6E8DA] bg-[#FBFCFB] p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#24312A]">{item.patientName}</h3>
                      <span className="rounded-full border border-[#D6E8DA] bg-white px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">{item.phone}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.date} · {item.time}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">Cita: {item.id}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={item.href}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
                    >
                      Abrir atención
                    </Link>

                    <Link
                      href="/nutricion/agendar"
                      className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                    >
                      Reagendar
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
