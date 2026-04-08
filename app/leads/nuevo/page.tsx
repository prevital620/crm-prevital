
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";

const maritalStatusOptions = [
  { value: "soltero", label: "Soltero(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "union_libre", label: "Unión libre" },
  { value: "separado", label: "Separado(a)" },
  { value: "viudo", label: "Viudo(a)" },
];

const interestServiceOptions = [
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "valoracion", label: "Valoración" },
  { value: "nutricion", label: "Nutrición" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "otro", label: "Otro" },
];

const sourceOptions = [
  { value: "opc", label: "OPC" },
  { value: "redes_sociales", label: "Redes sociales" },
  { value: "referido", label: "Referido" },
  { value: "evento", label: "Evento" },
  { value: "punto_fisico", label: "Punto físico" },
  { value: "otro", label: "Otro" },
];

const allowedRoles = [
  "super_user",
  "promotor_opc",
  "supervisor_opc",
  "confirmador",
  "tmk",
];

export default function NuevoLeadPage() {
  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentRoleCode, setCurrentRoleCode] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    age: "",
    marital_status: "",
    has_eps: "",
    affiliation_type: "",
    capture_location: "",
    interest_service: "",
    source: "",
    observations: "",
    city: "",
    status: "nuevo",
  });

  async function cargarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para crear leads.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", auth.user.id)
        .single();

      if (profileError || !profile) {
        setAuthorized(false);
        setError("No se pudo cargar el perfil del usuario actual.");
        return;
      }

      setAuthorized(true);
      setCurrentUserId(profile.id);
      setCurrentUserName(profile.full_name || "Usuario actual");
      setCurrentRoleCode(auth.roleCode);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  useEffect(() => {
    cargarAcceso();
  }, []);

  async function crearLead(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.first_name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!form.phone.trim()) {
      setError("El teléfono es obligatorio.");
      return;
    }

    if (!currentUserId) {
      setError("No se encontró el usuario actual.");
      return;
    }

    setLoading(true);

    try {
      const debeAutoAsignarse =
        currentRoleCode === "tmk" || currentRoleCode === "confirmador";

      const { error } = await supabase.from("leads").insert([
        {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim(),
          age: form.age ? Number(form.age) : null,
          marital_status: form.marital_status || null,
          has_eps:
            form.has_eps === ""
              ? null
              : form.has_eps === "si"
              ? true
              : false,
          affiliation_type: form.affiliation_type || null,
          capture_location: form.capture_location.trim() || null,
          interest_service: form.interest_service.trim() || null,
          source: form.source || null,
          observations: form.observations.trim() || null,
          city: form.city.trim() || null,
          status: form.status,
          created_by_user_id: currentUserId,
          assigned_to_user_id: debeAutoAsignarse ? currentUserId : null,
        },
      ]);

      if (error) throw error;

      setMensaje(
        debeAutoAsignarse
          ? "Lead creado y autoasignado correctamente."
          : "Lead creado correctamente."
      );

      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        age: "",
        marital_status: "",
        has_eps: "",
        affiliation_type: "",
        capture_location: "",
        interest_service: "",
        source: "",
        observations: "",
        city: "",
        status: "nuevo",
      });
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el lead.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] pb-10">
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-6">
          <section className="rounded-[28px] border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Validando acceso...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] pb-10">
        <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-6">
          <section className="rounded-[28px] border border-[#F2C9C9] bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-700">
              {error || "No tienes permiso para entrar a este módulo."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] pb-10">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[380px] w-[380px] opacity-[0.045] md:h-[520px] md:w-[520px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center gap-3">
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

        <section className="relative mb-4 overflow-hidden rounded-[28px] border border-[#D6E8DA] bg-white p-5 shadow-sm sm:mb-6 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7FA287]">
                Leads
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[#24312A] sm:text-3xl">
                Nuevo lead
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Formulario rápido para captación en punto, calle, evento o visita.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
              >
                Inicio
              </a>

              <a
                href="/leads"
                className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
              >
                Consultar leads
              </a>
            </div>
          </div>
        </section>

        <section className="relative rounded-[28px] border border-[#D6E8DA] bg-white p-5 shadow-sm sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <form onSubmit={crearLead} className="space-y-6">
            <div className="rounded-3xl border border-[#D6E8DA] bg-[#F8F7F4] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7FA287]">
                Captado por
              </p>
              <p className="mt-1 text-base font-semibold text-[#24312A]">
                {currentUserName}
              </p>
              {(currentRoleCode === "tmk" || currentRoleCode === "confirmador") && (
                <p className="mt-2 text-sm text-slate-600">
                  Este lead se asignará automáticamente a tu usuario.
                </p>
              )}
            </div>

            <SectionTitle
              title="Datos principales"
              description="Registra la información básica del lead."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre"
                required
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: Ana"
                    value={form.first_name}
                    onChange={(e) =>
                      setForm({ ...form, first_name: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Apellido"
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: Gómez"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm({ ...form, last_name: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Teléfono"
                required
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: 3001234567"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Edad"
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: 34"
                    type="number"
                    value={form.age}
                    onChange={(e) =>
                      setForm({ ...form, age: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Ciudad"
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: Medellín"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Estado civil"
                input={
                  <select
                    className={inputClass}
                    value={form.marital_status}
                    onChange={(e) =>
                      setForm({ ...form, marital_status: e.target.value })
                    }
                  >
                    <option value="">Selecciona</option>
                    {maritalStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>

            <SectionTitle
              title="Información de afiliación y origen"
              description="Completa los datos para clasificación y seguimiento."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="¿Tiene EPS?"
                input={
                  <select
                    className={inputClass}
                    value={form.has_eps}
                    onChange={(e) =>
                      setForm({ ...form, has_eps: e.target.value })
                    }
                  >
                    <option value="">Selecciona</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                }
              />

              <Field
                label="Tipo de afiliación"
                input={
                  <select
                    className={inputClass}
                    value={form.affiliation_type}
                    onChange={(e) =>
                      setForm({ ...form, affiliation_type: e.target.value })
                    }
                  >
                    <option value="">Selecciona</option>
                    <option value="cotizante">Cotizante</option>
                    <option value="beneficiario">Beneficiario</option>
                    <option value="subsidiado">Subsidiado</option>
                  </select>
                }
              />

              <Field
                label="Lugar de captación"
                input={
                  <input
                    className={inputClass}
                    placeholder="Ej: Centro comercial, feria, calle"
                    value={form.capture_location}
                    onChange={(e) =>
                      setForm({ ...form, capture_location: e.target.value })
                    }
                  />
                }
              />

              <Field
                label="Origen del lead"
                input={
                  <select
                    className={inputClass}
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value })
                    }
                  >
                    <option value="">Selecciona</option>
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <Field
                label="Servicio de interés"
                input={
                  <select
                    className={inputClass}
                    value={form.interest_service}
                    onChange={(e) =>
                      setForm({ ...form, interest_service: e.target.value })
                    }
                  >
                    <option value="">Selecciona</option>
                    {interestServiceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>

            <SectionTitle
              title="Observaciones"
              description="Agrega notas útiles para el seguimiento posterior."
            />

            <Field
              label="Observaciones"
              input={
                <textarea
                  className={`${inputClass} min-h-[120px] resize-none`}
                  placeholder="Ej: interesada en valoración preventiva"
                  value={form.observations}
                  onChange={(e) =>
                    setForm({ ...form, observations: e.target.value })
                  }
                />
              }
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[#5F7D66] px-5 py-4 text-base font-semibold text-white transition hover:bg-[#4F6F5B] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
              >
                {loading ? "Guardando lead..." : "Guardar lead"}
              </button>

              <a
                href="/leads"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-5 py-4 text-base font-semibold text-[#4F6F5B] transition hover:bg-[#F4FAF6] sm:w-auto"
              >
                Cancelar / volver
              </a>
            </div>

            {mensaje ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {mensaje}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[#24312A]">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  required,
  input,
}: {
  label: string;
  required?: boolean;
  input: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </div>
      {input}
    </label>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-[#24312A] outline-none transition placeholder:text-slate-400 focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
