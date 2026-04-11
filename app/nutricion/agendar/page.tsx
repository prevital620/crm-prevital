"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type UserOption = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad: string | null;
};

type AppointmentOption = {
  id: string;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
  service_type: string | null;
  status: string;
};

type FormState = {
  selectedUserId: string;
  patientName: string;
  phone: string;
  city: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
};

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildTimeOptions() {
  const times: string[] = [];
  for (let hour = 7; hour <= 18; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 18 && minute > 0) continue;
      times.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return times;
}

const TIME_OPTIONS = buildTimeOptions();

const initialForm: FormState = {
  selectedUserId: "",
  patientName: "",
  phone: "",
  city: "",
  appointmentDate: hoyISO(),
  appointmentTime: "08:00",
  notes: "",
};

function formatHour(value: string) {
  return value.slice(0, 5);
}

export default function NutricionAgendarPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookedAppointments, setBookedAppointments] = useState<AppointmentOption[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadBookedAppointments(initialForm.appointmentDate);
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) {
      setUsers([]);
      return;
    }
    void searchUsers();
  }, [search]);

  async function searchUsers() {
    try {
      setLoadingUsers(true);
      setError("");

      const q = search.trim();

      const { data, error } = await supabase
        .from("users")
        .select("id, nombre, documento, telefono, ciudad")
        .or(`nombre.ilike.%${q}%,documento.ilike.%${q}%,telefono.ilike.%${q}%`)
        .order("nombre", { ascending: true })
        .limit(15);

      if (error) throw error;

      setUsers((data as UserOption[]) || []);
    } catch (err: any) {
      setError(err?.message || "No se pudieron buscar clientes.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadBookedAppointments(date: string) {
    try {
      setLoadingSlots(true);

      const { data, error } = await supabase
        .from("appointments")
        .select("id, patient_name, appointment_date, appointment_time, service_type, status")
        .eq("appointment_date", date)
        .ilike("service_type", "%nutri%")
        .order("appointment_time", { ascending: true });

      if (error) throw error;

      setBookedAppointments((data as AppointmentOption[]) || []);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los cupos de nutrición.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function selectUser(user: UserOption) {
    setForm((prev) => ({
      ...prev,
      selectedUserId: user.id,
      patientName: user.nombre || "",
      phone: user.telefono || "",
      city: user.ciudad || "",
    }));
    setSearch(user.nombre || user.telefono || "");
    setUsers([]);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  const bookedTimes = useMemo(() => {
    return new Set(bookedAppointments.map((item) => formatHour(item.appointment_time)));
  }, [bookedAppointments]);

  async function handleSaveAppointment() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!form.selectedUserId) {
        throw new Error("Debes seleccionar un cliente real del sistema.");
      }

      if (!form.patientName.trim()) {
        throw new Error("No se encontró el nombre del paciente.");
      }

      if (!form.appointmentDate) {
        throw new Error("Debes seleccionar la fecha.");
      }

      if (!form.appointmentTime) {
        throw new Error("Debes seleccionar la hora.");
      }

      if (bookedTimes.has(form.appointmentTime)) {
        throw new Error("Ese horario ya está ocupado para nutrición.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUserId = session?.user?.id || null;

      const payload = {
        lead_id: null,
        patient_name: form.patientName.trim(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        appointment_date: form.appointmentDate,
        appointment_time: form.appointmentTime,
        status: "agendada",
        service_type: "nutricion",
        notes: form.notes.trim() || "Agendada desde módulo de nutrición.",
        created_by_user_id: currentUserId,
        updated_by_user_id: currentUserId,
      };

      const { data, error } = await supabase
        .from("appointments")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      await supabase
        .from("users")
        .update({
          estado_actual: "cita agendada nutricion",
        })
        .eq("id", form.selectedUserId);

      setMessage(`Cita agendada correctamente. ID: ${data?.id || "creada"}`);
      setForm({
        ...initialForm,
        appointmentDate: form.appointmentDate,
      });
      setSearch("");
      setUsers([]);
      await loadBookedAppointments(form.appointmentDate);
    } catch (err: any) {
      setError(err?.message || "No se pudo agendar la cita.");
    } finally {
      setSaving(false);
    }
  }

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
                Agendar cita
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Busca un cliente real, selecciona fecha y hora, y crea la cita en la tabla appointments.
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
                href="/nutricion/agenda"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Ver agenda
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Seleccionar cliente</h2>
            <p className="mt-1 text-sm text-slate-500">
              Busca por nombre, documento o teléfono. Solo debes usar clientes reales del sistema.
            </p>

            <div className="mt-5 space-y-4">
              <input
                className={inputClass}
                placeholder="Buscar cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loadingUsers ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                  Buscando clientes...
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                  Escribe al menos 2 letras o números para buscar.
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user)}
                      className="w-full rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4 text-left transition hover:border-[#BCD7C2] hover:bg-white"
                    >
                      <p className="text-base font-semibold text-[#24312A]">{user.nombre || "Sin nombre"}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {user.documento || "Sin documento"} · {user.telefono || "Sin teléfono"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{user.ciudad || "Sin ciudad"}</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4">
                <p className="text-sm font-semibold text-[#24312A]">Cliente seleccionado</p>
                <p className="mt-2 text-sm text-slate-700">{form.patientName || "Ninguno"}</p>
                <p className="mt-1 text-sm text-slate-600">{form.phone || ""}</p>
                <p className="mt-1 text-sm text-slate-600">{form.city || ""}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Datos de la cita</h2>
            <p className="mt-1 text-sm text-slate-500">
              Horarios ocupados del día seleccionado no estarán disponibles.
            </p>

            <div className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Fecha"
                  input={
                    <input
                      className={inputClass}
                      type="date"
                      value={form.appointmentDate}
                      onChange={async (e) => {
                        updateField("appointmentDate", e.target.value);
                        await loadBookedAppointments(e.target.value);
                      }}
                    />
                  }
                />

                <Field
                  label="Hora"
                  input={
                    <select
                      className={inputClass}
                      value={form.appointmentTime}
                      onChange={(e) => updateField("appointmentTime", e.target.value)}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time} disabled={bookedTimes.has(time)}>
                          {time} {bookedTimes.has(time) ? "· Ocupado" : ""}
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>

              <Field
                label="Notas"
                input={
                  <textarea
                    className={inputClass + " min-h-[120px] resize-none"}
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                }
              />

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAppointment}
                className="w-full rounded-2xl bg-[#0DA56F] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#0B8E5F] disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cita real"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Horarios ya ocupados</h2>
              <p className="mt-1 text-sm text-slate-500">
                Citas reales de nutrición para la fecha seleccionada.
              </p>
            </div>
            {loadingSlots ? <span className="text-sm text-slate-500">Cargando...</span> : null}
          </div>

          <div className="mt-5 space-y-3">
            {bookedAppointments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                No hay citas de nutrición para esa fecha.
              </div>
            ) : (
              bookedAppointments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4"
                >
                  <p className="text-base font-semibold text-[#24312A]">{item.patient_name || "Sin nombre"}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatHour(item.appointment_time)} · {item.status || "Sin estado"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  input,
}: {
  label: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>
      {input}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
