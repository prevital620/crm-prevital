"use client";

import Link from "next/link";
import Image from "next/image";
import {
  CalendarDays,
  ClipboardPlus,
  UserPlus,
  Stethoscope,
  Sparkles,
  Leaf,
  FolderSearch,
} from "lucide-react";

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
  {
    title: "Historia clínica",
    description: "Buscar pacientes y revisar historias clínicas autorizadas.",
    href: "/consulta-clinica",
    icon: FolderSearch,
  },
];

export default function NutricionHomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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
          <div className="relative h-14 w-14 overflow-hidden rounded-[20px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#FFFFFF_0%,_#F0FBF5_60%,_#E2F4EA_100%)] shadow-[0_14px_30px_rgba(95,125,102,0.18)]">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                Nutrición
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.1rem]">
                Bienestar nutricional
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Desde aquí puedes abrir la agenda, crear clientes nuevos y programar citas
                con una experiencia más limpia, más cálida y alineada con la identidad
                Prevital.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">
                  Módulo listo para operar
                </span>
                <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">
                  Menta, hoja y crema
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/crm"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Inicio
              </Link>
              <Link
                href="/nutricion/agenda"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Abrir agenda
              </Link>
              <Link
                href="/consulta-clinica"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Historia clínica
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
            <div className="flex items-center gap-3">
              <div className="rounded-[22px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-3 text-[#4F7B63] shadow-inner">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Accesos rápidos</h2>
                <p className="mt-1 text-sm leading-6 text-[#51695C]">
                  Entra directo al flujo que necesitas sin rodeos.
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
                    className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="rounded-[22px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-3 text-[#4F7B63] shadow-inner">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#24312A]">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[#607368]">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <span className="rounded-full border border-[#CFE4D8] bg-white/90 px-3 py-1 text-xs font-semibold text-[#4F6F5B] shadow-sm">
                        Abrir
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]">
              <div className="flex items-center gap-3">
                <div className="rounded-[22px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-3 text-[#4F7B63] shadow-inner">
                  <Leaf className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#24312A]">Estado del módulo</h2>
                  <p className="mt-1 text-sm leading-6 text-[#51695C]">
                    Base limpia, lista para trabajar con pacientes reales.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-6 text-sm leading-7 text-[#51695C] shadow-inner">
                La agenda mostrará las citas reales que existan en el sistema.
                <br />
                <br />
                El formulario de nuevo cliente queda vacío para diligenciar desde cero.
              </div>
            </div>

            <div className="rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#F4FBF6_0%,_#FFFFFF_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.1)]">
              <div className="flex items-center gap-3">
                <div className="rounded-[22px] bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_100%)] p-3 text-white shadow-[0_12px_24px_rgba(95,125,102,0.2)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#24312A]">Flujo recomendado</h3>
                  <p className="mt-1 text-sm text-[#607368]">
                    Crea, agenda y atiende sin salir del ecosistema Prevital.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {["Abrir agenda del día", "Registrar cliente nuevo", "Programar cita", "Abrir atención"].map(
                  (step, index) => (
                    <div
                      key={step}
                      className="flex items-center gap-3 rounded-2xl border border-[#D7EADF] bg-white/90 px-4 py-3 shadow-sm"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F6EE] text-sm font-semibold text-[#4F7B63]">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-[#32453A]">{step}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
