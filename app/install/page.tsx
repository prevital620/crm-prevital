"use client";

import Image from "next/image";
import Link from "next/link";
import { Monitor, Smartphone, Share2, Download, Apple } from "lucide-react";

export default function InstallPage() {
  const crmLink =
    typeof window !== "undefined" ? `${window.location.origin}/crm` : "[LINK DEL CRM]";

  const shareText = `Hola. Para usar el CRM Prevital como app, abre este enlace:

${crmLink}

Android:
Abre en Chrome, toca los 3 puntos y selecciona "Instalar aplicación" o "Agregar a pantalla principal".

iPhone:
Abre en Safari, toca "Compartir" y luego "Agregar a pantalla de inicio".

Computador:
Abre en Chrome o Edge y selecciona la opción "Instalar app" cuando aparezca.`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] px-4 py-6 md:px-6 md:py-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[360px] w-[360px] opacity-[0.04] md:h-[520px] md:w-[520px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm md:p-8">
          <div className="mb-4 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7D66]">
                CRM Prevital
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A] md:text-4xl">
                Instala la app del CRM en tu celular o computador
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
                El CRM Prevital se puede instalar como aplicación desde el navegador.
                No necesitas descargar nada desde Play Store o App Store.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/crm"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4F6F5B]"
                >
                  Abrir CRM en /crm
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(crmLink);
                      alert("Link copiado correctamente.");
                    } catch {
                      alert("No se pudo copiar el link automáticamente.");
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-5 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                >
                  Copiar link del CRM
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-[#D6E8DA] bg-[#F8F7F4] p-5 md:min-w-[300px]">
              <p className="text-sm font-semibold text-[#24312A]">Recomendación</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Comparte con tu equipo el enlace normal del CRM. Desde ese mismo link,
                cada persona podrá instalar la app según su dispositivo.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <InstallCard
            icon={<Download className="h-6 w-6" />}
            title="Android"
            subtitle="Instalación en celular"
            steps={[
              "Abre el CRM en Google Chrome.",
              "Inicia sesión normalmente.",
              "Toca los 3 puntos del navegador.",
              "Selecciona 'Instalar aplicación' o 'Agregar a pantalla principal'.",
              "Confirma la instalación y aparecerá el icono de Prevital.",
            ]}
          />

          <InstallCard
            icon={<Apple className="h-6 w-6" />}
            title="iPhone"
            subtitle="Instalación en iOS"
            steps={[
              "Abre el CRM en Safari.",
              "Inicia sesión normalmente.",
              "Toca el botón de Compartir.",
              "Selecciona 'Agregar a pantalla de inicio'.",
              "Confirma y el icono quedará en la pantalla principal.",
            ]}
          />

          <InstallCard
            icon={<Monitor className="h-6 w-6" />}
            title="Computador"
            subtitle="Instalación en PC"
            steps={[
              "Abre el CRM en Chrome o Edge.",
              "Inicia sesión normalmente.",
              "Busca la opción 'Instalar app' en la barra o en el menú.",
              "Confirma la instalación.",
              "Se abrirá como una aplicación con su propio icono.",
            ]}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5F7D66]">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">
                  Texto sugerido para compartir
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Puedes copiar este mensaje y enviarlo por WhatsApp.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl border border-[#D6E8DA] bg-[#FBFCFB] p-5">
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                {shareText}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5F7D66]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">
                  Si no aparece instalar
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Asegúrate de abrir el CRM en el dominio real y no en localhost.",
                "Revisa que estés usando Chrome, Edge o Safari.",
                "Navega unos segundos dentro del CRM y vuelve a abrir el menú.",
                "Haz una recarga fuerte y prueba de nuevo.",
                "En iPhone, la opción se hace manual desde Compartir.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] px-4 py-3 text-sm text-slate-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InstallCard({
  icon,
  title,
  subtitle,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  steps: string[];
}) {
  return (
    <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] p-3 text-[#5F7D66]">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#24312A]">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <div
            key={step}
            className="flex gap-3 rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF4EC] text-xs font-bold text-[#4F6F5B]">
              {index + 1}
            </div>
            <p className="text-sm leading-6 text-slate-600">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
