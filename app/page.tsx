import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";

const featureCards = [
  {
    title: "Odontologia preventiva",
    description:
      "Acompañamos tu salud oral con evaluaciones oportunas, educación y seguimiento enfocado en prevención.",
    icon: ShieldCheck,
  },
  {
    title: "Atencion integral",
    description:
      "Unificamos experiencia clínica, servicio humano y procesos organizados para que tu atención sea clara y confiable.",
    icon: Stethoscope,
  },
  {
    title: "Experiencia cercana",
    description:
      "Diseñamos una experiencia simple, cálida y profesional desde el primer contacto con Prevital.",
    icon: HeartPulse,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEF9F2_0%,_#F8FBF9_42%,_#FFFCF8_100%)] text-[#203128]">
      <section className="relative overflow-hidden px-6 py-8 md:px-10">
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#C9EAD6]/45 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#A8CDBD]/25 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <header className="flex flex-col gap-4 rounded-[2rem] border border-[#D6E8DA] bg-white/85 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.10)] backdrop-blur md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
                <Image
                  src="/prevital-logo.jpeg"
                  alt="Prevital"
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6D8F77]">
                  Prevital Odontologia
                </p>
                <h1 className="text-xl font-bold text-[#203128] md:text-2xl">
                  Salud oral con enfoque preventivo
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-5 py-3 text-sm font-semibold text-[#4F6F5B] transition hover:-translate-y-0.5 hover:bg-[#F5FBF7]"
              >
                Ingreso equipo
              </Link>
              <Link
                href="/crm"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Abrir CRM
              </Link>
            </div>
          </header>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[2.25rem] border border-[#D6E8DA] bg-[linear-gradient(135deg,_rgba(255,255,255,0.96)_0%,_rgba(241,250,245,0.95)_55%,_rgba(228,243,234,0.92)_100%)] p-8 shadow-[0_24px_60px_rgba(95,125,102,0.15)] md:p-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D6E8DA] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#5F7D66] shadow-sm">
                <Sparkles className="h-4 w-4" />
                Prevencion, confianza y seguimiento
              </div>

              <h2 className="max-w-2xl text-4xl font-bold tracking-tight text-[#203128] md:text-6xl">
                Una landing clara para pacientes, con el CRM protegido en <span className="text-[#5F7D66]">/crm</span>.
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-[#50655A] md:text-lg">
                Prevital Odontologia combina atención humana, prevención y orden operativo. Desde aquí
                puedes presentar tu marca al público mientras el sistema interno sigue funcionando de forma
                independiente para tu equipo.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#203128] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#16231c]"
                >
                  Ingresar al equipo
                </Link>
                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/90 px-6 py-4 text-sm font-semibold text-[#4F6F5B] transition hover:-translate-y-0.5 hover:bg-[#F5FBF7]"
                >
                  Ver enfoque
                </a>
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[2.25rem] border border-[#D6E8DA] bg-white/90 p-6 shadow-[0_22px_50px_rgba(95,125,102,0.12)] md:p-8">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
                <div className="relative h-[280px] w-[280px] md:h-[360px] md:w-[360px]">
                  <Image
                    src="/prevital-logo.jpeg"
                    alt="Prevital"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="relative space-y-5">
                <div className="rounded-3xl border border-[#D6E8DA] bg-[#F7FCF8] p-5">
                  <p className="text-sm font-semibold text-[#24312A]">Ruta pública</p>
                  <p className="mt-2 text-sm leading-6 text-[#5B6E63]">
                    La página principal ahora puede hablarle al paciente, mostrar la marca y crecer como
                    vitrina digital del negocio.
                  </p>
                </div>

                <div className="rounded-3xl border border-[#D6E8DA] bg-[#F7FCF8] p-5">
                  <p className="text-sm font-semibold text-[#24312A]">Ruta privada</p>
                  <p className="mt-2 text-sm leading-6 text-[#5B6E63]">
                    El CRM queda aislado en <span className="font-semibold text-[#4F6F5B]">/crm</span>, manteniendo
                    Supabase, autenticación y módulos internos sin cambiar su lógica de negocio.
                  </p>
                </div>

                <Link
                  href="/crm"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#4F6F5B] transition hover:text-[#365243]"
                >
                  Ir al sistema interno
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="servicios" className="px-6 pb-10 md:px-10 md:pb-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6D8F77]">
              Base inicial de la landing
            </p>
            <h3 className="mt-2 text-3xl font-bold text-[#203128] md:text-4xl">
              Una estructura simple y lista para crecer
            </h3>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {featureCards.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="rounded-[2rem] border border-[#D6E8DA] bg-white/92 p-6 shadow-[0_18px_40px_rgba(95,125,102,0.10)]"
              >
                <div className="mb-4 inline-flex rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5E8F6C]">
                  <Icon className="h-6 w-6" />
                </div>
                <h4 className="text-xl font-semibold text-[#24312A]">{title}</h4>
                <p className="mt-3 text-sm leading-7 text-[#5B6E63]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
