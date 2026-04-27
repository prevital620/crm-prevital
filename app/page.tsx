import type { Metadata } from "next";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HeartPulse,
  MapPin,
  MessageCircle,
  ShieldCheck,
  SmilePlus,
  Sparkles,
  Stethoscope,
} from "lucide-react";

const whatsappHref =
  "https://wa.me/573004937787?text=Hola%2C%20quiero%20agendar%20una%20cita%20odontol%C3%B3gica%20en%20Prevital";

const navigationItems = [
  { label: "Inicio", href: "#inicio" },
  { label: "Servicios", href: "#servicios" },
  { label: "Beneficios", href: "#beneficios" },
  { label: "Contacto", href: "#contacto" },
];

const services: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Valoración odontológica",
    description:
      "Revisamos tu caso con diagnóstico claro y una orientación precisa sobre los siguientes pasos.",
    icon: Stethoscope,
  },
  {
    title: "Limpieza dental",
    description:
      "Promovemos una sonrisa saludable con procedimientos enfocados en higiene, prevención y bienestar.",
    icon: Sparkles,
  },
  {
    title: "Blanqueamiento",
    description:
      "Mejoramos la apariencia de tu sonrisa con alternativas cuidadosas y adecuadas para ti.",
    icon: SmilePlus,
  },
  {
    title: "Diseño de sonrisa",
    description:
      "Evaluamos opciones estéticas con enfoque profesional para resultados armónicos y naturales.",
    icon: BadgeCheck,
  },
  {
    title: "Ortodoncia",
    description:
      "Te acompañamos en tratamientos orientados a mejorar alineación, funcionalidad y confianza.",
    icon: ShieldCheck,
  },
  {
    title: "Rehabilitación oral",
    description:
      "Construimos planes de atención pensados para recuperar comodidad, función y seguridad al sonreír.",
    icon: HeartPulse,
  },
];

const benefits = [
  "Diagnóstico personalizado",
  "Atención profesional",
  "Planes accesibles",
  "Acompañamiento en el proceso",
  "Ambiente cómodo y confiable",
];

const trustPoints = [
  "Atención clara desde la primera valoración",
  "Orientación cercana para tomar decisiones con tranquilidad",
  "Proceso pensado para que te sientas acompañado en cada etapa",
];

const contactItems: Array<{
  label: string;
  value: string;
  icon: LucideIcon;
}> = [
  {
    label: "Ciudad",
    value: "Medellín",
    icon: MapPin,
  },
  {
    label: "Horario",
    value: "Lunes a viernes de 8:00 a.m. a 5:00 p.m.",
    icon: Clock3,
  },
  {
    label: "WhatsApp",
    value: "3004937787",
    icon: MessageCircle,
  },
];

export const metadata: Metadata = {
  title: "Prevital Odontología | Medellín",
  description:
    "Atención odontológica profesional en Medellín, con diagnóstico claro y acompañamiento personalizado.",
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6D8F77]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#203128] md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-[#50655A] md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main
      id="inicio"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEF8F2_0%,_#F8FBF9_38%,_#FFFDF8_100%)] text-[#203128]"
    >
      <section className="relative overflow-hidden px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#CFE8D8]/60 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#BFD9CC]/35 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <header className="rounded-[2rem] border border-[#D8E7DC] bg-white/88 px-5 py-4 shadow-[0_18px_45px_rgba(95,125,102,0.12)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-[#D8E7DC] bg-white shadow-sm">
                  <Image
                    src="/prevital-logo.jpeg"
                    alt="Logo de Prevital Odontología"
                    fill
                    priority
                    className="object-contain p-1.5"
                    sizes="56px"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6D8F77]">
                    Medellín
                  </p>
                  <h1 className="text-xl font-bold text-[#203128] md:text-2xl">
                    Prevital Odontología
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <nav
                  aria-label="Navegación principal"
                  className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#4D6557]"
                >
                  {navigationItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-3 py-2 transition hover:bg-[#F2F7F4] hover:text-[#203128]"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[#203128] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18261f]"
                >
                  Agenda tu cita
                </a>
              </div>
            </div>
          </header>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-[#D8E7DC] bg-[linear-gradient(145deg,_rgba(255,255,255,0.98)_0%,_rgba(245,250,247,0.97)_55%,_rgba(236,245,239,0.96)_100%)] p-8 shadow-[0_24px_65px_rgba(95,125,102,0.14)] md:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D8E7DC] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Clínica dental con atención cercana
              </div>

              <h2 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-[#203128] md:text-6xl">
                Tu sonrisa, nuestra prioridad
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-[#50655A] md:text-lg">
                Atención odontológica profesional en Medellín, con diagnóstico claro y
                acompañamiento personalizado.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#203128] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18261f]"
                >
                  Agenda tu cita
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D1E3D7] bg-white/90 px-6 py-4 text-sm font-semibold text-[#4D6557] transition hover:-translate-y-0.5 hover:bg-[#F5FBF7]"
                >
                  Ver servicios
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {contactItems.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-[1.5rem] border border-[#D8E7DC] bg-white/88 p-4 shadow-[0_12px_30px_rgba(95,125,102,0.08)]"
                  >
                    <div className="mb-3 inline-flex rounded-2xl bg-[#F1F7F3] p-2 text-[#5F7D66]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-[#24312A]">{label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5B6E63]">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[2.5rem] border border-[#D8E7DC] bg-white/90 p-6 shadow-[0_24px_65px_rgba(95,125,102,0.12)] md:p-8">
              <div className="absolute inset-x-10 top-0 h-32 rounded-b-full bg-[#E6F1EA]" />
              <div className="relative mx-auto max-w-md">
                <div className="rounded-[2rem] border border-[#D8E7DC] bg-[linear-gradient(180deg,_#FDFEFC_0%,_#F4F9F6_100%)] p-6 shadow-[0_16px_40px_rgba(95,125,102,0.10)]">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-[#D8E7DC] bg-white">
                      <Image
                        src="/prevital-logo.jpeg"
                        alt="Prevital Odontología"
                        fill
                        className="object-contain p-1.5"
                        sizes="64px"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6D8F77]">
                        Prevital Odontología
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#556A5F]">
                        Evaluación profesional, orientación clara y atención pensada para tu
                        tranquilidad.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {trustPoints.map((point) => (
                      <div
                        key={point}
                        className="flex items-start gap-3 rounded-[1.4rem] border border-[#DCEAE0] bg-white/92 p-4"
                      >
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6D8F77]" />
                        <p className="text-sm leading-6 text-[#4F6459]">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-[#D8E7DC] bg-[#F8FBF8] p-5 shadow-[0_12px_30px_rgba(95,125,102,0.07)]">
                    <p className="text-sm font-semibold text-[#24312A]">Atención profesional</p>
                    <p className="mt-2 text-sm leading-6 text-[#5B6E63]">
                      Un espacio cómodo y confiable para avanzar con claridad en tu cuidado oral.
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-[#D8E7DC] bg-[#203128] p-5 text-white shadow-[0_14px_32px_rgba(32,49,40,0.18)]">
                    <p className="text-sm font-semibold">Agenda por WhatsApp</p>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      Respuesta directa para ayudarte a programar tu cita odontológica.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="servicios" className="scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Servicios"
            title="Odontología pensada para cuidar tu sonrisa con claridad y confianza"
            description="Presentamos una oferta inicial enfocada en atención odontológica, con una estructura fácil de ampliar cuando Prevital incorpore nuevas especialidades."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[2rem] border border-[#D8E7DC] bg-white/92 p-6 shadow-[0_18px_40px_rgba(95,125,102,0.10)] transition hover:-translate-y-1 hover:shadow-[0_22px_45px_rgba(95,125,102,0.14)]"
              >
                <div className="mb-5 inline-flex rounded-2xl border border-[#D8E7DC] bg-[#F4FAF6] p-3 text-[#5E8F6C]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-[#24312A]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#5B6E63]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="beneficios" className="scroll-mt-24 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-[#D8E7DC] bg-[linear-gradient(145deg,_rgba(255,255,255,0.96)_0%,_rgba(246,250,247,0.98)_100%)] p-8 shadow-[0_24px_65px_rgba(95,125,102,0.12)] md:p-10">
          <SectionHeading
            eyebrow="Beneficios"
            title="Una experiencia odontológica cálida, ordenada y confiable"
            description="Diseñamos esta atención para que cada paciente entienda su diagnóstico, se sienta bien acompañado y pueda avanzar con seguridad."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-[1.75rem] border border-[#D8E7DC] bg-white/92 p-5 shadow-[0_12px_30px_rgba(95,125,102,0.08)]"
              >
                <div className="mb-4 inline-flex rounded-full bg-[#EFF7F2] p-2 text-[#6D8F77]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold leading-6 text-[#24312A]">{benefit}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-[2rem] border border-[#D8E7DC] bg-[#203128] p-6 text-white shadow-[0_18px_40px_rgba(32,49,40,0.18)] md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#B8D1C0]">
              Confianza
            </p>
            <p className="mt-3 max-w-4xl text-lg leading-8 text-white/90">
              En Prevital Odontología te acompañamos desde la valoración inicial hasta la
              definición del tratamiento más adecuado para ti.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-[#D8E7DC] bg-[linear-gradient(135deg,_rgba(248,252,249,0.98)_0%,_rgba(236,245,239,0.96)_100%)] p-8 shadow-[0_24px_65px_rgba(95,125,102,0.12)] md:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6D8F77]">
              Agenda tu cita odontológica
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#203128] md:text-4xl">
              Estamos listos para ayudarte a programar tu atención
            </h2>
            <p className="mt-4 text-base leading-8 text-[#50655A] md:text-lg">
              Escríbenos por WhatsApp y nuestro equipo te ayudará a programar tu atención.
            </p>
          </div>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#203128] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18261f] lg:mt-0"
          >
            <MessageCircle className="h-5 w-5" />
            Agenda tu cita
          </a>
        </div>
      </section>

      <section id="contacto" className="scroll-mt-24 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2.5rem] border border-[#D8E7DC] bg-white/90 p-8 shadow-[0_24px_65px_rgba(95,125,102,0.10)] md:p-10">
            <SectionHeading
              eyebrow="Contacto"
              title="Información clara para que nos contactes fácilmente"
            />

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {contactItems.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-[1.9rem] border border-[#D8E7DC] bg-[#FBFDFB] p-6 shadow-[0_12px_30px_rgba(95,125,102,0.07)]"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-[#D8E7DC] bg-[#F2F7F4] p-3 text-[#5F7D66]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-[#24312A]">{label}</p>
                  <p className="mt-3 text-sm leading-7 text-[#5B6E63]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-[2rem] border border-[#D8E7DC] bg-[#F7FBF8] p-5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-7 text-[#50655A]">
                Atención odontológica profesional en Medellín con acompañamiento desde el primer
                contacto.
              </p>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#203128] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18261f]"
              >
                <MessageCircle className="h-4 w-4" />
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
