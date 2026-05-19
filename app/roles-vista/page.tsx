"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SessionBadge from "@/components/session-badge";
import { getCurrentUserRole } from "@/lib/auth";
import { getVisibleQuickActions } from "@/lib/crm/quick-actions";

type RoleOption = {
  code: string;
  name: string;
  description: string;
};

const roleOptions: RoleOption[] = [
  {
    code: "super_user",
    name: "Super usuario",
    description: "Vista completa de administracion, operacion y reportes.",
  },
  {
    code: "administrador",
    name: "Administrador",
    description: "Reportes administrativos, comisiones, manifiestos y consulta.",
  },
  {
    code: "recepcion",
    name: "Recepcion",
    description: "Ingreso, agenda, admisiones, manifiestos y operacion diaria.",
  },
  {
    code: "promotor_opc",
    name: "Promotor OPC",
    description: "Creacion y seguimiento de leads propios, estadistica y comisiones.",
  },
  {
    code: "supervisor_opc",
    name: "Supervisor OPC",
    description: "Gestion de leads, reporte de promotores, usuarios del grupo y comisiones.",
  },
  {
    code: "tmk",
    name: "TMK",
    description: "Gestion de sus leads, agenda de pendientes, consulta cliente y comisiones.",
  },
  {
    code: "supervisor_call_center",
    name: "Supervisor Call Center",
    description: "Asignacion de leads, agenda visible, equipo TMK y manifiestos.",
  },
  {
    code: "confirmador",
    name: "Confirmador",
    description: "Gestion de leads, agenda, comisiones del equipo y manifiestos.",
  },
  {
    code: "comercial",
    name: "Comercial",
    description: "Seguimiento comercial, registro de cliente y comisiones propias.",
  },
  {
    code: "gerencia_comercial",
    name: "Gerencia comercial",
    description: "Registro de clientes, asignacion comercial, gerencia y comisiones.",
  },
  {
    code: "nutricionista",
    name: "Nutricionista",
    description: "Agenda y atencion nutricional.",
  },
  {
    code: "fisioterapeuta",
    name: "Fisioterapeuta",
    description: "Agenda y atencion de fisioterapia.",
  },
  {
    code: "medico_general",
    name: "Medico general",
    description: "Consulta de cliente y apoyo clinico visible.",
  },
];

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

export default function RolesVistaPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [selectedRoleCode, setSelectedRoleCode] = useState("tmk");

  useEffect(() => {
    async function validarAcceso() {
      try {
        setLoading(true);
        setError("");

        const auth = await getCurrentUserRole();

        if (auth.roleCode !== "super_user") {
          setAuthorized(false);
          setError("Solo super usuario puede abrir la vista por rol.");
          return;
        }

        setAuthorized(true);
      } catch (err: unknown) {
        setAuthorized(false);
        setError(err instanceof Error ? err.message : "No se pudo validar el acceso.");
      } finally {
        setLoading(false);
      }
    }

    void validarAcceso();
  }, []);

  const selectedRole = useMemo(
    () => roleOptions.find((role) => role.code === selectedRoleCode) || roleOptions[0],
    [selectedRoleCode]
  );

  const visibleActions = useMemo(
    () => getVisibleQuickActions([selectedRoleCode]),
    [selectedRoleCode]
  );

  const roleSummaries = useMemo(
    () =>
      roleOptions.map((role) => ({
        ...role,
        count: getVisibleQuickActions([role.code]).length,
      })),
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
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
        <section className="overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                Super usuario
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">
                Vista por rol
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Selecciona un rol y revisa los modulos que aparecera en el panel principal. Esta vista no cambia permisos ni entra como ese usuario: solo previsualiza accesos.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/crm"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </Link>
          </div>
        </section>

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <section className={panelClass}>
            <p className="text-sm text-[#607368]">Cargando vista por rol...</p>
          </section>
        ) : authorized ? (
          <section className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className={panelClass}>
              <h2 className="text-2xl font-bold text-[#24312A]">Roles</h2>
              <p className="mt-1 text-sm text-slate-500">
                Elige uno para ver su panel.
              </p>

              <div className="mt-5 space-y-2">
                {roleSummaries.map((role) => {
                  const active = selectedRoleCode === role.code;

                  return (
                    <button
                      key={role.code}
                      type="button"
                      onClick={() => setSelectedRoleCode(role.code)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[#6C9C88] bg-[linear-gradient(135deg,_#5F7D66_0%,_#456A55_100%)] text-white shadow-[0_14px_28px_rgba(95,125,102,0.22)]"
                          : "border-[#D7EADF] bg-white/90 text-[#365243] hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{role.name}</span>
                      <span className={`mt-1 block text-xs ${active ? "text-white/78" : "text-[#607368]"}`}>
                        {role.count} modulos
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className={panelClass}>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="inline-flex rounded-full border border-[#D7EADF] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#5F7D66]">
                    {selectedRole.code}
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-[#24312A]">
                    {selectedRole.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#607368]">
                    {selectedRole.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#D7EADF] bg-white/82 px-4 py-3 text-sm font-semibold text-[#365243]">
                  {visibleActions.length} modulos visibles
                </div>
              </div>

              {visibleActions.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                  Este rol no tiene modulos visibles configurados en el panel.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleActions.map((action) => (
                    <Link
                      key={`${action.href}-${action.title}`}
                      href={action.href}
                      className="group rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_36px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_44px_rgba(95,125,102,0.16)]"
                    >
                      <div className="mb-4 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[#24312A]">
                            {action.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-[#607368]">
                            {action.subtitle}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#D7EADF] bg-white px-3 py-1 text-xs font-semibold text-[#5F7D66]">
                          Abrir
                        </span>
                      </div>
                      <p className="mt-4 text-xs text-[#789083]">{action.href}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
