import { existsSync } from "node:fs";
import { join } from "node:path";
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

const heroImageSrc = "/images/odontologia-hero.jpg";
const smileImageSrc = "/images/sonrisa-prevital.jpg";

function publicImageExists(src: string) {
  return existsSync(join(process.cwd(), "public", src.replace(/^\//, "")));
}

const heroImageAvailable = publicImageExists(heroImageSrc);
const smileImageAvailable = publicImageExists(smileImageSrc);

const primaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#A8C7B2] bg-[linear-gradient(135deg,_#E4F1E7_0%,_#C6DDCC_100%)] px-6 py-4 text-sm font-semibold text-[#1E3229] shadow-[0_14px_28px_rgba(126,159,135,0.16)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,_#DAECDF_0%,_#B8D2C0_100%)]";

const navigationItems = [
  { label: "Inicio", href: "#inicio" },
  { label: "Servicios", href: "#servicios" },
  { label: "Experiencia", href: "#experiencia" },
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
      "Revisamos tu caso con diagnóstico claro y orientación precisa sobre el tratamiento más adecuado.",
    icon: Stethoscope,
  },
  {
    title: "Limpieza dental",
    description:
      "Promovemos salud y bienestar oral con una atención cuidadosa enfocada en prevención e higiene.",
    icon: Sparkles,
  },
  {
    title: "Blanqueamiento",
    description:
      "Mejoramos la apariencia de tu sonrisa con alternativas seguras y acordes con tu valoración.",
    icon: SmilePlus,
  },
  {
    title: "Diseño de sonrisa",
    description:
      "Evaluamos opciones estéticas con enfoque profesional para lograr armonía y naturalidad.",
    icon: BadgeCheck,
  },
  {
    title: "Ortodoncia",
    description:
      "Te acompañamos en un proceso orientado a mejorar alineación, función y confianza al sonreír.",
    icon: ShieldCheck,
  },
  {
    title: "Rehabilitación oral",
    description:
      "Construimos planes de tratamiento para recuperar comodidad, función y seguridad en tu día a día.",
    icon: HeartPulse,
  },
];

const detailBenefits: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Diagnóstico claro",
    description:
      "Explicamos tu valoración con lenguaje sencillo para que tomes decisiones con tranquilidad.",
    icon: Stethoscope,
  },
  {
    title: "Atención cercana",
    description:
      "Buscamos que desde el primer contacto te sientas escuchado, acompañado y bien orientado.",
    icon: HeartPulse,
  },
  {
    title: "Plan personalizado",
    description:
      "Cada propuesta se adapta a tus necesidades, prioridades y objetivos para tu sonrisa.",
    icon: BadgeCheck,
  },
];

const trustBullets = [
  "Atención profesional en Medellín",
  "Acompañamiento personalizado",
  "Agenda directa por WhatsApp",
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
    "Atención odontológica profesional en Medellín. Agenda tu cita en Prevital Odontología.",
};

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  const alignment =
    align === "center" ? "mx-auto text-center items-center" : "text-left";

  return (
    <div className={`max-w-3xl ${alignment}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6A8774]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3229] md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-[#55695D] md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function CleanImageBlock({
  src,
  alt,
  available,
  className = "",
}: {
  src: string;
  alt: string;
  available: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2.25rem] border border-[#D7E6DB] bg-[linear-gradient(160deg,_#FFFFFF_0%,_#F4F8F4_55%,_#FDF8F0_100%)] shadow-[0_22px_55px_rgba(95,125,102,0.12)] ${className}`}
    >
      {available ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(min-width: 1280px) 44vw, (min-width: 1024px) 48vw, 100vw"
          priority
        />
      ) : (
        <div className="relative flex h-full min-h-[320px] items-center justify-center p-8">
          <div className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-[#DCEEE1] blur-2xl" />
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#ECE9CF] blur-2xl" />
          <div className="relative rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_14px_32px_rgba(95,125,102,0.08)]">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#EAF5ED] text-[#5E846A]">
                <SmilePlus className="h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1E3229]">Imagen pendiente</p>
                <p className="mt-2 text-sm leading-6 text-[#586C60]">
                  Sube una foto real en <span className="font-semibold">{src}</span> y aparecerá aquí automáticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main
      id="inicio"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEF7F1_0%,_#FCFCF8_42%,_#FFF8EF_100%)] text-[#1E3229]"
    >
      <section className="relative overflow-hidden px-4 pb-14 pt-5 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#D9ECE0]/60 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#ECE8D0]/35 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <header className="sticky top-4 z-20 rounded-[2rem] border border-[#D7E6DB] bg-white/88 px-5 py-4 shadow-[0_18px_42px_rgba(95,125,102,0.10)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-[#D7E6DB] bg-white shadow-sm">
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6A8774]">
                    Medellín
                  </p>
                  <h1 className="text-xl font-bold text-[#1E3229] md:text-2xl">
                    Prevital Odontología
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <nav
                  aria-label="Navegación principal"
                  className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#4E6559]"
                >
                  {navigationItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-3 py-2 transition hover:bg-[#F1F7F3] hover:text-[#1E3229]"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-[#A8C7B2] bg-[linear-gradient(135deg,_#E4F1E7_0%,_#C6DDCC_100%)] px-5 py-3 text-sm font-semibold text-[#1E3229] shadow-[0_12px_24px_rgba(126,159,135,0.14)] transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,_#DAECDF_0%,_#B8D2C0_100%)]"
                >
                  Agenda tu cita
                </a>
              </div>
            </div>
          </header>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="rounded-[2.6rem] border border-[#D7E6DB] bg-white/92 p-8 shadow-[0_22px_55px_rgba(95,125,102,0.10)] md:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E6DB] bg-[#FBFDFB] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#5E7C68] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Clínica odontológica
              </div>

              <h2 className="mt-6 max-w-xl text-4xl font-bold tracking-tight text-[#1E3229] md:text-6xl">
                Tu sonrisa, nuestra prioridad
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-[#55695D] md:text-lg">
                Atención odontológica profesional en Medellín, con diagnóstico claro y acompañamiento personalizado para que agendes con confianza.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className={primaryCtaClass}
                >
                  Agenda tu cita
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D1E2D6] bg-white px-6 py-4 text-sm font-semibold text-[#4A6155] transition hover:-translate-y-0.5 hover:bg-[#F4FAF6]"
                >
                  Ver servicios
                </a>
              </div>

              <div className="mt-10 grid gap-3">
                <div className="flex flex-wrap gap-3">
                  {trustBullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="inline-flex items-center gap-2 rounded-full border border-[#D7E6DB] bg-[#F8FBF9] px-4 py-2 text-sm text-[#51675A]"
                    >
                      <CheckCircle2 className="h-4 w-4 text-[#6A8774]" />
                      {bullet}
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {contactItems.map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-[1.5rem] border border-[#D7E6DB] bg-[#FBFDFB] p-4 shadow-[0_10px_24px_rgba(95,125,102,0.05)]"
                    >
                      <div className="mb-3 inline-flex rounded-2xl bg-[#EEF7F1] p-2 text-[#5E846A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-[#1E3229]">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-[#586C60]">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <CleanImageBlock
              src={heroImageSrc}
              alt="Imagen principal de atención odontológica en Prevital"
              available={heroImageAvailable}
              className="min-h-[440px]"
            />
          </div>
        </div>
      </section>

      <section id="servicios" className="scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Servicios"
            title="Servicios pensados para cuidar tu sonrisa con claridad y confianza"
            description="Una presentación ordenada, elegante y enfocada en pacientes que buscan atención odontológica confiable en Medellín."
            align="center"
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="overflow-hidden rounded-[2rem] border border-[#D7E6DB] bg-white shadow-[0_18px_42px_rgba(95,125,102,0.07)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(95,125,102,0.10)]"
              >
                <div className="h-1.5 w-full bg-[linear-gradient(90deg,_#A8CDBD_0%,_#7E9F87_55%,_#5F7C68_100%)]" />
                <div className="p-6">
                  <div className="mb-5 inline-flex rounded-[1.35rem] border border-[#D7E6DB] bg-[#F3F9F5] p-3 text-[#5E846A]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#1E3229]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#586C60]">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="experiencia" className="scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.8rem] border border-[#D7E6DB] bg-white/94 p-8 shadow-[0_24px_60px_rgba(95,125,102,0.10)] md:p-10">
          <div className="grid gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:items-center">
            <div>
              <SectionHeading
                eyebrow="Experiencia"
                title="Cuidamos tu sonrisa en cada detalle"
                description="Te acompañamos desde la valoración inicial hasta la elección del tratamiento más adecuado para tu sonrisa."
              />

              <div className="mt-8 grid gap-4">
                {detailBenefits.map(({ title, description, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-[1.8rem] border border-[#D7E6DB] bg-[#FBFDFB] p-5 shadow-[0_10px_24px_rgba(95,125,102,0.05)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF7F1] text-[#5E846A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#1E3229]">{title}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#586C60]">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CleanImageBlock
              src={smileImageSrc}
              alt="Imagen real de sonrisa para la landing de Prevital"
              available={smileImageAvailable}
              className="min-h-[420px]"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.7rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_#FFF8EF_0%,_#F2F8F4_52%,_#E7F1EA_100%)] shadow-[0_22px_55px_rgba(95,125,102,0.10)]">
          <div className="grid gap-8 px-8 py-10 md:px-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6A8774]">
                Agenda tu cita
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3229] md:text-4xl">
                Estamos listos para ayudarte a programar tu atención odontológica
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[#55695D] md:text-lg">
                Escríbenos por WhatsApp y nuestro equipo te ayudará a programar tu atención de forma clara, rápida y cercana.
              </p>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className={primaryCtaClass}
            >
              <MessageCircle className="h-5 w-5" />
              Agenda tu cita
            </a>
          </div>
        </div>
      </section>

      <section id="contacto" className="scroll-mt-24 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2.5rem] border border-[#D7E6DB] bg-white/94 p-8 shadow-[0_22px_55px_rgba(95,125,102,0.08)] md:p-10">
              <SectionHeading
                eyebrow="Contacto"
                title="Información clara para que agendes fácilmente"
                description="Una landing enfocada en pacientes y personas que buscan atención odontológica profesional en Medellín."
              />

              <div className="mt-8 grid gap-4">
                {contactItems.map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-[1.8rem] border border-[#D7E6DB] bg-[#FBFDFB] p-5 shadow-[0_10px_24px_rgba(95,125,102,0.05)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF7F1] text-[#5E846A]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1E3229]">{label}</p>
                        <p className="mt-2 text-sm leading-7 text-[#586C60]">{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2.5rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_#FFFFFF_0%,_#F7FBF8_48%,_#FFF8EF_100%)] p-8 shadow-[0_22px_55px_rgba(95,125,102,0.08)] md:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6A8774]">
                Contacto directo
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1E3229] md:text-4xl">
                Agenda por WhatsApp con una atención simple y confiable
              </h2>
              <p className="mt-4 text-base leading-8 text-[#55695D] md:text-lg">
                Hemos preparado esta experiencia para que el siguiente paso sea claro: escribir, recibir orientación y programar tu cita odontológica.
              </p>

              <div className="mt-8 rounded-[2rem] border border-[#D7E6DB] bg-white p-6 shadow-[0_10px_24px_rgba(95,125,102,0.05)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.3rem] bg-[#EAF5ED] text-[#5E846A]">
                    <MessageCircle className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6A8774]">
                      WhatsApp Prevital
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[#1E3229]">3004937787</p>
                    <p className="mt-2 text-sm leading-6 text-[#586C60]">
                      Usa el botón para escribirnos con el mensaje de agendamiento ya preparado.
                    </p>
                  </div>
                </div>
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={`mt-8 ${primaryCtaClass}`}
              >
                <MessageCircle className="h-5 w-5" />
                Agenda tu cita
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.6rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_#FFFFFF_0%,_#F5FAF6_55%,_#FFF8EF_100%)] px-8 py-10 text-[#1E3229] shadow-[0_22px_50px_rgba(95,125,102,0.08)] md:px-10">
          <div className="grid gap-8 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#6A8774]">
                Prevital Odontología
              </p>
              <h2 className="mt-3 text-2xl font-bold">Atención odontológica en Medellín</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-[#586C60]">
                Landing pública pensada para pacientes que buscan una experiencia odontológica profesional, cálida y confiable.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#1E3229]">Servicios</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#586C60]">
                {services.map((service) => (
                  <li key={service.title}>{service.title}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[#1E3229]">Contacto</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#586C60]">
                <li>Medellín</li>
                <li>Lunes a viernes 8:00 a.m. - 5:00 p.m.</li>
                <li>WhatsApp 3004937787</li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Escribir a WhatsApp de Prevital"
        className="fixed bottom-5 right-5 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#2D9C5D] text-white shadow-[0_18px_35px_rgba(45,156,93,0.35)] transition hover:scale-105 hover:bg-[#25864F]"
      >
        <span className="absolute inset-0 rounded-full bg-[#2D9C5D] opacity-30 blur-sm" />
        <MessageCircle className="relative h-8 w-8" />
      </a>
    </main>
  );
}
