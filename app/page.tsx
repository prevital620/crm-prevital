import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
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
const clinicImageSrc = "/images/clinica-prevital.jpg";

function publicImageExists(src: string) {
  return existsSync(join(process.cwd(), "public", src.replace(/^\//, "")));
}

const heroImageAvailable = publicImageExists(heroImageSrc);
const smileImageAvailable = publicImageExists(smileImageSrc);
const clinicImageAvailable = publicImageExists(clinicImageSrc);

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
      "Revisamos tu sonrisa con una valoración completa y te orientamos con claridad sobre el mejor siguiente paso.",
    icon: Stethoscope,
  },
  {
    title: "Limpieza dental",
    description:
      "Mejoramos tu higiene oral con una atención cuidadosa enfocada en salud, prevención y bienestar.",
    icon: Sparkles,
  },
  {
    title: "Blanqueamiento",
    description:
      "Potenciamos la estética de tu sonrisa con alternativas seguras y pensadas para tu caso.",
    icon: SmilePlus,
  },
  {
    title: "Diseño de sonrisa",
    description:
      "Evaluamos opciones armónicas para resaltar tu sonrisa con un resultado natural y profesional.",
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
      "Creamos planes de tratamiento para recuperar comodidad, función y seguridad en tu día a día.",
    icon: HeartPulse,
  },
];

const experienceCards: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Diagnóstico claro",
    description:
      "Explicamos tu valoración de forma sencilla para que entiendas tus opciones con tranquilidad.",
    icon: Stethoscope,
  },
  {
    title: "Atención cercana",
    description:
      "Queremos que desde el primer contacto te sientas escuchado, acompañado y bien atendido.",
    icon: HeartPulse,
  },
  {
    title: "Plan de tratamiento personalizado",
    description:
      "Cada propuesta se adapta a tus necesidades, prioridades y objetivos para tu sonrisa.",
    icon: BadgeCheck,
  },
];

const highlightPills = [
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
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6E8A78]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1F342A] md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-8 text-[#53685D] md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

function PlaceholderVisual({
  badge,
  title,
  description,
  srcLabel,
  icon: Icon,
  className = "",
}: {
  badge: string;
  title: string;
  description: string;
  srcLabel: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[2rem] border border-[#D7E6DB] bg-[linear-gradient(160deg,_#FFFDF8_0%,_#F4FAF5_52%,_#E8F2EB_100%)] ${className}`}
    >
      <div className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-[#DCEFE2] blur-2xl" />
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#C4DDCF]/70 blur-2xl" />
      <div className="relative flex h-full flex-col justify-between p-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5D7E69] shadow-sm">
            <Icon className="h-3.5 w-3.5" />
            {badge}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.75rem] bg-white shadow-[0_14px_28px_rgba(95,125,102,0.10)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F4EC] text-[#5E866D]">
                <SmilePlus className="h-6 w-6" />
              </div>
            </div>
            <div className="flex-1 rounded-[1.5rem] border border-white/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(95,125,102,0.08)]">
              <p className="text-sm font-semibold text-[#1F342A]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-[#566A60]">{description}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#BFD7C7] bg-white/70 px-4 py-3 text-xs text-[#61756B]">
          Lista para usar con <span className="font-semibold">{srcLabel}</span>
        </div>
      </div>
    </div>
  );
}

function GalleryTile({
  src,
  alt,
  badge,
  title,
  description,
  available,
  priority = false,
}: {
  src: string;
  alt: string;
  badge: string;
  title: string;
  description: string;
  available: boolean;
  priority?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#D7E6DB] bg-white shadow-[0_18px_44px_rgba(95,125,102,0.10)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(160deg,_#EEF6F0_0%,_#FFFDF8_100%)]">
        {available ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            className="object-cover"
            sizes="(min-width: 1280px) 28vw, (min-width: 768px) 44vw, 100vw"
          />
        ) : (
          <PlaceholderVisual
            badge={badge}
            title={title}
            description={description}
            srcLabel={src}
            icon={Sparkles}
            className="h-full rounded-none border-0"
          />
        )}
      </div>

      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E8A78]">{badge}</p>
        <h3 className="mt-3 text-xl font-semibold text-[#1F342A]">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-[#566A60]">{description}</p>
      </div>
    </article>
  );
}

function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -left-6 top-10 h-24 w-24 rounded-full bg-[#D2E7D8] blur-3xl" />
      <div className="absolute -right-6 bottom-16 h-28 w-28 rounded-full bg-[#EEF3D9] blur-3xl" />

      <div className="relative overflow-hidden rounded-[2.5rem] border border-[#D7E6DB] bg-white/90 p-4 shadow-[0_24px_60px_rgba(95,125,102,0.14)] md:p-5">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#E2EEE6] bg-[linear-gradient(150deg,_#FAFDFB_0%,_#EEF6F0_50%,_#FFF9F0_100%)] p-4 md:p-5">
          {heroImageAvailable ? (
            <div className="relative min-h-[420px] overflow-hidden rounded-[1.7rem]">
              <Image
                src={heroImageSrc}
                alt="Paciente recibiendo atención odontológica en Prevital"
                fill
                priority
                className="object-cover"
                sizes="(min-width: 1024px) 42vw, 100vw"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,35,28,0.12)_0%,rgba(20,35,28,0.50)_100%)]" />
              <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
                <div className="rounded-full border border-white/30 bg-white/18 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                  Odontología premium
                </div>
                <div className="rounded-[1.3rem] border border-white/30 bg-white/18 px-4 py-3 text-sm text-white backdrop-blur">
                  Agenda abierta en Medellín
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/20 bg-white/15 p-4 text-white backdrop-blur-md">
                  <p className="text-sm font-semibold">Valoración inicial</p>
                  <p className="mt-2 text-sm text-white/85">
                    Orientación clara para definir el tratamiento adecuado para tu sonrisa.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/20 bg-[#1F342A]/75 p-4 text-white shadow-[0_14px_28px_rgba(20,35,28,0.16)]">
                  <p className="text-sm font-semibold">Atención cercana</p>
                  <p className="mt-2 text-sm text-white/85">
                    Un proceso pensado para darte tranquilidad desde el primer contacto.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[420px] gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.8rem] border border-white/60 bg-white/80 p-5 shadow-[0_16px_30px_rgba(95,125,102,0.08)]">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EDF6F0] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#62826E]">
                  <Sparkles className="h-4 w-4" />
                  Sonrisa saludable
                </div>

                <div className="mt-6 rounded-[1.7rem] bg-[linear-gradient(180deg,_#EAF5EE_0%,_#FFFFFF_100%)] p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-white shadow-[0_14px_28px_rgba(95,125,102,0.10)]">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DCEFE2] text-[#5B7B66]">
                        <SmilePlus className="h-7 w-7" />
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[#1F342A]">Paciente sonriente</p>
                      <p className="mt-2 text-sm leading-6 text-[#566A60]">
                        Bloque visual listo para reemplazar por {heroImageSrc}.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.3rem] border border-[#D6E7DB] bg-white p-4">
                      <p className="text-sm font-semibold text-[#1F342A]">Diagnóstico claro</p>
                      <p className="mt-2 text-sm leading-6 text-[#5A6E63]">
                        Valoración profesional con explicación sencilla y cercana.
                      </p>
                    </div>
                    <div className="rounded-[1.3rem] border border-[#D6E7DB] bg-[#1F342A] p-4 text-white">
                      <p className="text-sm font-semibold text-white">Agenda tu cita</p>
                      <p className="mt-2 text-sm leading-6 text-white/85">
                        Atención por WhatsApp con respuesta directa para pacientes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.8rem] border border-[#DCEBE0] bg-[linear-gradient(160deg,_#FFF8EF_0%,_#F4FAF5_100%)] p-5 shadow-[0_14px_32px_rgba(95,125,102,0.08)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6E8A78]">
                    Atención profesional
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#1F342A]">
                    Tu proceso empieza con escucha, claridad y confianza.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {highlightPills.map((pill) => (
                      <span
                        key={pill}
                        className="rounded-full border border-[#D4E5D8] bg-white px-3 py-2 text-xs font-semibold text-[#58715F]"
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.8rem] border border-[#DCEBE0] bg-white p-5 shadow-[0_14px_32px_rgba(95,125,102,0.08)]">
                  <p className="text-sm font-semibold text-[#1F342A]">Visual listo para imagen</p>
                  <p className="mt-2 text-sm leading-6 text-[#5A6E63]">
                    Cuando agregues la fotografía odontológica a <span className="font-semibold">{heroImageSrc}</span>, este bloque mostrará la imagen automáticamente.
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {[Stethoscope, Sparkles, ShieldCheck].map((Icon, index) => (
                      <div
                        key={index}
                        className="flex aspect-square items-center justify-center rounded-[1.2rem] bg-[#EEF6F0] text-[#5E866D]"
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main
      id="inicio"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_#EFF8F2_0%,_#FBFCF8_40%,_#FFF8EE_100%)] text-[#1F342A]"
    >
      <section className="relative overflow-hidden px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#D8EBDE]/65 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#EAE7C8]/45 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <header className="rounded-[2rem] border border-[#D7E6DB] bg-white/85 px-5 py-4 shadow-[0_18px_45px_rgba(95,125,102,0.10)] backdrop-blur">
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6E8A78]">
                    Medellín
                  </p>
                  <h1 className="text-xl font-bold text-[#1F342A] md:text-2xl">
                    Prevital Odontología
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <nav
                  aria-label="Navegación principal"
                  className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#4F665A]"
                >
                  {navigationItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="rounded-full px-3 py-2 transition hover:bg-[#F2F7F4] hover:text-[#1F342A]"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[#203128] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18251e]"
                >
                  Agenda tu cita
                </a>
              </div>
            </div>
          </header>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_rgba(255,255,255,0.98)_0%,_rgba(244,250,246,0.98)_55%,_rgba(255,249,240,0.98)_100%)] p-8 shadow-[0_24px_60px_rgba(95,125,102,0.12)] md:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E6DB] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#5F7E69] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Clínica odontológica premium
              </div>

              <h2 className="mt-6 max-w-xl text-4xl font-bold tracking-tight text-[#1F342A] md:text-6xl">
                Tu sonrisa, nuestra prioridad
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-[#53685D] md:text-lg">
                Atención odontológica profesional en Medellín, con diagnóstico claro y
                acompañamiento personalizado para que agendes con confianza.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#203128] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18251e]"
                >
                  Agenda tu cita
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D0E2D6] bg-white px-6 py-4 text-sm font-semibold text-[#496257] transition hover:-translate-y-0.5 hover:bg-[#F5FBF7]"
                >
                  Ver servicios
                </a>
              </div>

              <div className="mt-10 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {contactItems.map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-[1.5rem] border border-[#D7E6DB] bg-white/92 p-4 shadow-[0_12px_28px_rgba(95,125,102,0.07)]"
                    >
                      <div className="mb-3 inline-flex rounded-2xl bg-[#EEF7F1] p-2 text-[#5E866D]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-[#1F342A]">{label}</p>
                      <p className="mt-2 text-sm leading-6 text-[#586B61]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.7rem] border border-[#D7E6DB] bg-[#203128] p-5 text-white shadow-[0_18px_32px_rgba(32,49,40,0.16)]">
                  <p className="text-sm font-semibold text-white">Agenda por WhatsApp</p>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Respuesta directa para programar tu cita odontológica de forma fácil y rápida.
                  </p>
                </div>
              </div>
            </div>

            <HeroVisual />
          </div>
        </div>
      </section>

      <section id="servicios" className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Servicios"
            title="Odontología pensada para el bienestar, la estética y la confianza"
            description="Cada servicio está presentado para pacientes que llegan buscando atención profesional, claridad y una experiencia de alta calidad."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="group overflow-hidden rounded-[2rem] border border-[#D7E6DB] bg-white shadow-[0_18px_42px_rgba(95,125,102,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(95,125,102,0.12)]"
              >
                <div className="h-1.5 w-full bg-[linear-gradient(90deg,_#A8CDBD_0%,_#7FA287_55%,_#5E7B66_100%)]" />
                <div className="p-6">
                  <div className="mb-5 inline-flex rounded-[1.3rem] border border-[#D7E6DB] bg-[#F3F9F5] p-3 text-[#5E866D]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-[#1F342A]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#586B61]">{description}</p>
                  <div className="mt-5 inline-flex rounded-full bg-[#F6FAF7] px-3 py-1.5 text-xs font-semibold text-[#60786A]">
                    Atención odontológica
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="experiencia" className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.6rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_rgba(255,255,255,0.98)_0%,_rgba(245,250,246,0.98)_62%,_rgba(255,248,239,0.96)_100%)] p-8 shadow-[0_24px_65px_rgba(95,125,102,0.12)] md:p-10">
          <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
            <div>
              <SectionHeading
                eyebrow="Experiencia"
                title="Una experiencia pensada para tu tranquilidad"
                description="Te acompañamos desde la valoración inicial hasta la elección del tratamiento más adecuado para tu sonrisa."
              />

              <div className="mt-8 grid gap-4">
                {experienceCards.map(({ title, description, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-[1.8rem] border border-[#D7E6DB] bg-white/92 p-5 shadow-[0_12px_28px_rgba(95,125,102,0.08)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFF7F2] text-[#5E866D]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#1F342A]">{title}</h3>
                        <p className="mt-2 text-sm leading-7 text-[#586B61]">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <GalleryTile
                src={smileImageSrc}
                alt="Paciente sonriente después de atención odontológica"
                badge="Sonrisa Prevital"
                title="Cuidado estético y funcional"
                description="Espacio listo para mostrar una imagen cercana, cálida y aspiracional de tu servicio odontológico."
                available={smileImageAvailable}
                priority
              />
              <GalleryTile
                src={clinicImageSrc}
                alt="Espacio clínico de Prevital Odontología"
                badge="Clínica Prevital"
                title="Ambiente cómodo y confiable"
                description="Preparado para una foto del consultorio o del equipo en un entorno limpio y profesional."
                available={clinicImageAvailable}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.6rem] border border-[#D7E6DB] bg-[#203128] shadow-[0_24px_65px_rgba(32,49,40,0.18)]">
          <div className="grid gap-8 px-8 py-10 md:px-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B6D0BF]">
                Agenda tu cita odontológica
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Estamos listos para ayudarte a dar el siguiente paso
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-white/82 md:text-lg">
                Escríbenos por WhatsApp y nuestro equipo te ayudará a programar tu atención de forma clara, rápida y amable.
              </p>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-[#203128] transition hover:-translate-y-0.5 hover:bg-[#F5FBF7]"
            >
              <MessageCircle className="h-5 w-5" />
              Agenda tu cita
            </a>
          </div>
        </div>
      </section>

      <section id="contacto" className="scroll-mt-24 px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2.5rem] border border-[#D7E6DB] bg-white/92 p-8 shadow-[0_22px_60px_rgba(95,125,102,0.10)] md:p-10">
            <SectionHeading
              eyebrow="Contacto"
              title="Información clara para que agendes fácilmente"
              description="Una landing orientada a pacientes, campañas y personas que buscan atención odontológica confiable en Medellín."
            />

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {contactItems.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-[1.9rem] border border-[#D7E6DB] bg-[#FBFDFB] p-6 shadow-[0_12px_28px_rgba(95,125,102,0.06)]"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-[#D7E6DB] bg-[#F2F7F4] p-3 text-[#5E866D]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-[#1F342A]">{label}</p>
                  <p className="mt-3 text-sm leading-7 text-[#586B61]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-[2rem] border border-[#D7E6DB] bg-[linear-gradient(145deg,_#F7FBF8_0%,_#FFF8EF_100%)] p-5 md:flex-row md:items-center md:justify-between">
              <p className="text-sm leading-7 text-[#53685D]">
                Atención odontológica profesional con una experiencia cálida, ordenada y preparada para recibir pacientes nuevos.
              </p>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#203128] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#18251e]"
              >
                <MessageCircle className="h-4 w-4" />
                Agenda tu cita
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
