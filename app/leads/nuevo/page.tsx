
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import { leadSourceOptions, normalizeLeadSource } from "@/lib/lead-source";
import { SLOT_OPTIONS } from "@/lib/agenda/agendaDurations";
import SessionBadge from "@/components/session-badge";

const maritalStatusOptions = [
  { value: "soltero", label: "Soltero(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "union_libre", label: "UniÃ³n libre" },
  { value: "separado", label: "Separado(a)" },
  { value: "viudo", label: "Viudo(a)" },
];

const interestServiceOptions = [
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "valoracion", label: "ValoraciÃ³n" },
  { value: "nutricion", label: "NutriciÃ³n" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "otro", label: "Otro" },
];

const allowedRoles = [
  "super_user",
  "promotor_opc",
  "supervisor_opc",
  "supervisor_call_center",
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
  const isPromotorOpc = currentRoleCode === "promotor_opc";
  const isSupervisorOpc = currentRoleCode === "supervisor_opc";
  const isTmk = currentRoleCode === "tmk";
  const autoAssignsLead =
    currentRoleCode === "tmk" ||
    currentRoleCode === "confirmador" ||
    currentRoleCode === "supervisor_call_center";

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
  const [scheduleNow, setScheduleNow] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    appointment_date: hoyISO(),
    appointment_time: "08:00",
  });

  async function cargarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesiÃ³n para usar este mÃ³dulo.");
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

  useEffect(() => {
    if (!isPromotorOpc) return;

    setForm((current) =>
      current.source === "opc" ? current : { ...current, source: "opc" }
    );
  }, [isPromotorOpc]);

  async function crearLead(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.first_name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!form.phone.trim()) {
      setError("El telÃ©fono es obligatorio.");
      return;
    }

    if (!currentUserId) {
      setError("No se encontrÃ³ el usuario actual.");
      return;
    }

    setLoading(true);

    try {
      let createdLeadId = "";
      const sourceValue = isPromotorOpc ? "opc" : normalizeLeadSource(form.source);
      const fullName = [form.first_name.trim(), form.last_name.trim()]
        .filter(Boolean)
        .join(" ");
      const leadPayload = {
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
        source: sourceValue,
        observations: form.observations.trim() || null,
        city: form.city.trim() || null,
        status: scheduleNow ? "agendado" : form.status,
        created_by_user_id: currentUserId,
        assigned_to_user_id: autoAssignsLead ? currentUserId : null,
      };

      const { data: createdLead, error: leadError } = await supabase
        .from("leads")
        .insert([leadPayload])
        .select("id")
        .single();

      if (leadError || !createdLead) throw leadError || new Error("No se pudo crear el lead.");
      createdLeadId = createdLead.id;

      if (scheduleNow && isTmk) {
        const appointmentPayload = {
          lead_id: createdLead.id,
          patient_name: fullName || form.first_name.trim(),
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          appointment_date: scheduleForm.appointment_date,
          appointment_time: scheduleForm.appointment_time,
          status: "agendada",
          service_type: form.interest_service.trim() || "valoracion",
          specialist_user_id: null,
          notes: "Creada desde TMK al registrar el lead.",
          created_by_user_id: currentUserId,
          updated_by_user_id: currentUserId,
        };

        const { error: appointmentError } = await supabase
          .from("appointments")
          .insert([appointmentPayload]);

        if (appointmentError) {
          await supabase.from("leads").delete().eq("id", createdLeadId);
          throw appointmentError;
        }
      }

      setMensaje(
        scheduleNow && isTmk
          ? "Lead creado y cita agendada correctamente."
          : autoAssignsLead
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
        source: isPromotorOpc ? "opc" : "",
        observations: "",
        city: "",
        status: "nuevo",
      });
      setScheduleNow(false);
      setScheduleForm({
        appointment_date: hoyISO(),
        appointment_time: "08:00",
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
              {error || "No tienes permiso para entrar a este mÃ³dulo."}
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

      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
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

        <section className="relative mb-6 overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                Leads
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.05rem]">
                Nuevo lead
              </h1>
              <p className="hidden mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Formulario rápido para captación en punto, calle, evento o visita.
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Registra captaciones rápidas del equipo OPC y deja el lead listo para seguimiento sin salir del ecosistema Prevital.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">
                  Captación en punto, calle o evento
                </span>
                {isPromotorOpc ? (
                  <span className="rounded-full bg-[#E8F6EE] px-3 py-1 ring-1 ring-[#CFE4D8]">
                    Origen OPC fijo
                  </span>
                ) : null}
                {autoAssignsLead ? (
                  <span className="rounded-full bg-[#F3F8F5] px-3 py-1 ring-1 ring-[#D8ECE1]">
                    Se autoasigna al crear
                  </span>
                ) : null}
                {isSupervisorOpc ? (
                  <span className="rounded-full bg-[#EDF7F1] px-3 py-1 ring-1 ring-[#D8ECE1]">
                    Vista operativa para supervisor OPC
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 md:items-end">
              <SessionBadge />
              <div className="flex flex-wrap gap-3">
              <Link
                href="/crm"
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-5 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Inicio
              </Link>

              <Link
                href="/leads"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_28px_rgba(95,125,102,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Consultar leads
              </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="relative rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-5 shadow-[0_24px_60px_rgba(95,125,102,0.12)] sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <form onSubmit={crearLead} className="space-y-6">
            <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-5 shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6B8B77]">
                Captado por
              </p>
              <p className="mt-2 text-xl font-semibold text-[#24312A]">
                {currentUserName}
              </p>
              {autoAssignsLead && (
                <p className="mt-2 text-sm text-slate-600">
                  Este lead se asignará automáticamente a tu usuario.
                </p>
              )}
              {isPromotorOpc && (
                <p className="mt-2 text-sm text-slate-600">
                  El origen de este lead se registrará automáticamente como OPC.
                </p>
              )}
            </div>

            <div className="rounded-[28px] border border-[#DCEBE1] bg-white/88 p-5 shadow-sm">
            <SectionTitle
              title="Datos principales"
              description="Registra la información básica del lead."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
            </div>

            <div className="rounded-[28px] border border-[#DCEBE1] bg-white/88 p-5 shadow-sm">
            <SectionTitle
              title="Información de afiliación y origen"
              description="Completa los datos para clasificación y seguimiento."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  isPromotorOpc ? (
                    <div className="rounded-2xl border border-[#D6E8DA] bg-[#F4FAF6] px-4 py-3 text-sm font-medium text-[#4F6F5B]">
                      OPC
                    </div>
                  ) : (
                    <select
                      className={inputClass}
                      value={form.source}
                      onChange={(e) =>
                        setForm({ ...form, source: e.target.value })
                      }
                    >
                      <option value="">Selecciona</option>
                      {leadSourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )
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
            </div>

            <div className="rounded-[28px] border border-[#DCEBE1] bg-white/88 p-5 shadow-sm">
            <SectionTitle
              title="Observaciones"
              description="Agrega notas útiles para el seguimiento posterior."
            />

            <div className="mt-5">
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
            </div>
            </div>

            {isTmk ? (
              <div className="rounded-[28px] border border-[#DCEBE1] bg-white/88 p-5 shadow-sm">
                <SectionTitle
                  title="Agenda inmediata"
                  description="Si ya lograron concretar la visita, deja la cita creada desde este mismo paso."
                />

                <div className="mt-5 space-y-4">
                  <label className="flex items-center gap-3 rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 text-sm text-[#32453A] shadow-inner">
                    <input
                      type="checkbox"
                      checked={scheduleNow}
                      onChange={(e) => setScheduleNow(e.target.checked)}
                    />
                    Agendar este lead de una vez
                  </label>

                  {scheduleNow ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Fecha de la cita"
                        input={
                          <input
                            className={inputClass}
                            type="date"
                            value={scheduleForm.appointment_date}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({
                                ...prev,
                                appointment_date: e.target.value,
                              }))
                            }
                          />
                        }
                      />

                      <Field
                        label="Hora de la cita"
                        input={
                          <select
                            className={inputClass}
                            value={scheduleForm.appointment_time}
                            onChange={(e) =>
                              setScheduleForm((prev) => ({
                                ...prev,
                                appointment_time: e.target.value,
                              }))
                            }
                          >
                            {SLOT_OPTIONS.map((slot) => (
                              <option key={slot.value} value={slot.value}>
                                {slot.label}
                              </option>
                            ))}
                          </select>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-4 text-base font-semibold text-white shadow-[0_16px_30px_rgba(95,125,102,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
              >
                {loading ? "Guardando lead..." : "Guardar lead"}
              </button>

              <Link
                href="/leads"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white/90 px-5 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6] sm:w-auto"
              >
                Cancelar / volver
              </Link>
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

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white/92 px-4 py-4 text-base text-[#24312A] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";


