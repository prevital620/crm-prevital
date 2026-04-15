"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSectionForService } from "@/lib/agenda/agendaSections";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  DEFAULT_DAILY_CAPACITY,
} from "@/lib/agenda/agendaDurations";
import {
  buildSlotAvailability,
  formatSlotAvailabilityLabel,
  getSlotAvailabilityStatus,
} from "@/lib/agenda/agendaAvailability";
import { isExactUserLookupMatch } from "@/lib/users/userLookup";

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
  notes: string | null;
};

type AgendaDaySetting = {
  agenda_date: string;
  daily_capacity: number | null;
  is_closed: boolean;
};

type AgendaSlotSetting = {
  agenda_date: string;
  slot_time: string;
  capacity: number | null;
  is_blocked: boolean;
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

const initialForm: FormState = {
  selectedUserId: "",
  patientName: "",
  phone: "",
  city: "",
  appointmentDate: hoyISO(),
  appointmentTime: "",
  notes: "",
};

function formatHour(value: string) {
  return value.slice(0, 5);
}

function formatStatus(value: string) {
  const map: Record<string, string> = {
    agendada: "Agendada",
    confirmada: "Confirmada",
    en_espera: "En espera",
    reagendada: "Reagendada",
    en_atencion: "En atencion",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
    no_asistio: "No asistio",
  };
  return map[value] || value || "Sin estado";
}

export default function NutricionAgendarPage() {
  const searchParams = useSearchParams();
  const lookupFromUrl =
    searchParams.get("documento") ||
    searchParams.get("cedula") ||
    searchParams.get("buscar") ||
    "";
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allAppointments, setAllAppointments] = useState<AppointmentOption[]>([]);
  const [nutritionAppointments, setNutritionAppointments] = useState<AppointmentOption[]>([]);
  const [daySetting, setDaySetting] = useState<AgendaDaySetting | null>(null);
  const [slotSettings, setSlotSettings] = useState<Record<string, AgendaSlotSetting>>({});
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (search.trim().length < 2) {
      setUsers([]);
      return;
    }
    void searchUsers();
  }, [search]);

  useEffect(() => {
    if (!lookupFromUrl.trim()) return;
    setSearch(lookupFromUrl.trim());
  }, [lookupFromUrl]);

  useEffect(() => {
    void loadAgendaContext(form.appointmentDate);
  }, [form.appointmentDate]);

  useEffect(() => {
    if (!search.trim() || users.length === 0) return;
    if (form.selectedUserId) return;

    const exactUser = users.find((user) => isExactUserLookupMatch(user, search));
    if (!exactUser) return;

    selectUser(exactUser);
  }, [form.selectedUserId, search, users]);

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

  async function loadAgendaContext(date: string) {
    try {
      setLoadingAgenda(true);
      setError("");

      const [appointmentsResult, daySettingsResult, slotSettingsResult] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, patient_name, appointment_date, appointment_time, service_type, status, notes"
          )
          .eq("appointment_date", date)
          .order("appointment_time", { ascending: true }),
        supabase
          .from("agenda_day_settings")
          .select("agenda_date, daily_capacity, is_closed")
          .eq("agenda_date", date)
          .maybeSingle(),
        supabase
          .from("agenda_slot_settings")
          .select("agenda_date, slot_time, capacity, is_blocked")
          .eq("agenda_date", date),
      ]);

      if (appointmentsResult.error) throw appointmentsResult.error;
      if (daySettingsResult.error) throw daySettingsResult.error;
      if (slotSettingsResult.error) throw slotSettingsResult.error;

      const appointmentRows = ((appointmentsResult.data as AppointmentOption[]) || []).map((item) => ({
        ...item,
        appointment_time: formatHour(item.appointment_time),
      }));

      const nutritionRows = appointmentRows.filter((item) =>
        (item.service_type || "").toLowerCase().includes("nutri")
      );

      const slotMap: Record<string, AgendaSlotSetting> = {};
      ((slotSettingsResult.data as AgendaSlotSetting[]) || []).forEach((item) => {
        slotMap[`${item.agenda_date}_${formatHour(item.slot_time)}`] = {
          ...item,
          slot_time: formatHour(item.slot_time),
        };
      });

      setAllAppointments(appointmentRows);
      setNutritionAppointments(nutritionRows);
      setDaySetting((daySettingsResult.data as AgendaDaySetting | null) || null);
      setSlotSettings(slotMap);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los cupos de nutricion.");
    } finally {
      setLoadingAgenda(false);
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

  const selectedDateActiveTotal = useMemo(() => {
    return allAppointments.filter(
      (item) =>
        item.appointment_date === form.appointmentDate &&
        ACTIVE_APPOINTMENT_STATUSES.includes(item.status)
    ).length;
  }, [allAppointments, form.appointmentDate]);

  const slotAvailability = useMemo(() => {
    return buildSlotAvailability({
      appointments: allAppointments,
      section: "especialistas",
      serviceType: "nutricion",
      appointmentDate: form.appointmentDate,
      durationMinutes: 30,
      slotSettings,
      selectedDateClosed: daySetting?.is_closed ?? false,
      selectedDateDailyCapacity: daySetting?.daily_capacity ?? DEFAULT_DAILY_CAPACITY,
      selectedDateActiveTotal,
      editingAppointmentId: null,
      getSectionForService,
    });
  }, [
    allAppointments,
    daySetting?.daily_capacity,
    daySetting?.is_closed,
    form.appointmentDate,
    selectedDateActiveTotal,
    slotSettings,
  ]);

  const availableSlots = useMemo(
    () => slotAvailability.filter((slot) => !slot.disabled),
    [slotAvailability]
  );

  useEffect(() => {
    if (availableSlots.length === 0) {
      if (form.appointmentTime) {
        setForm((prev) => ({ ...prev, appointmentTime: "" }));
      }
      return;
    }

    const stillValid = availableSlots.some((slot) => slot.value === form.appointmentTime);
    if (!stillValid) {
      setForm((prev) => ({ ...prev, appointmentTime: availableSlots[0].value }));
    }
  }, [availableSlots, form.appointmentTime]);

  async function handleSaveAppointment() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!form.selectedUserId) {
        throw new Error("Debes seleccionar un cliente real del sistema.");
      }

      if (!form.patientName.trim()) {
        throw new Error("No se encontro el nombre del paciente.");
      }

      if (!form.appointmentDate) {
        throw new Error("Debes seleccionar la fecha.");
      }

      if (!form.appointmentTime) {
        throw new Error("No hay horarios disponibles para esa fecha.");
      }

      const selectedSlot = slotAvailability.find((slot) => slot.value === form.appointmentTime);

      if (!selectedSlot || selectedSlot.disabled) {
        throw new Error("Ese horario ya no esta disponible para nutricion.");
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
        notes: form.notes.trim() || "Agendada desde modulo de nutricion.",
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
      setForm((prev) => ({
        ...initialForm,
        appointmentDate: prev.appointmentDate,
      }));
      setSearch("");
      setUsers([]);
      await loadAgendaContext(form.appointmentDate);
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
                Modulo de Nutricion
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">Agendar cita</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Esta agenda ahora toma la misma disponibilidad base que recepcion para que
                no compitan entre si los cupos del dia.
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
              Busca por nombre, documento o telefono. Solo debes usar clientes reales
              del sistema.
            </p>

            <div className="mt-5 space-y-4">
              <input
                className={inputClass}
                placeholder="Buscar cliente por nombre, cédula o teléfono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {loadingUsers ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                  Buscando clientes...
                </div>
              ) : users.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                  Escribe al menos 2 letras o numeros para buscar.
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
                      <p className="text-base font-semibold text-[#24312A]">
                        {user.nombre || "Sin nombre"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {user.documento || "Sin documento"} · {user.telefono || "Sin telefono"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {user.ciudad || "Sin ciudad"}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4">
                <p className="text-sm font-semibold text-[#24312A]">Cliente seleccionado</p>
                <p className="mt-2 text-sm text-slate-700">{form.patientName || "Ninguno"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {users.find((user) => user.id === form.selectedUserId)?.documento || "Sin documento"}
                </p>
                <p className="mt-1 text-sm text-slate-600">{form.phone || ""}</p>
                <p className="mt-1 text-sm text-slate-600">{form.city || ""}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-[#24312A]">Datos de la cita</h2>
            <p className="mt-1 text-sm text-slate-500">
              El selector solo muestra horarios utilizables. Los cupos visibles abajo
              salen de la misma agenda que usa recepcion.
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
                      onChange={(e) => updateField("appointmentDate", e.target.value)}
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
                      disabled={availableSlots.length === 0}
                    >
                      {availableSlots.length === 0 ? (
                        <option value="">Sin horarios disponibles</option>
                      ) : (
                        availableSlots.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {formatSlotAvailabilityLabel(slot)}
                          </option>
                        ))
                      )}
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
                disabled={saving || availableSlots.length === 0}
                onClick={handleSaveAppointment}
                className="w-full rounded-2xl bg-[#0DA56F] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#0B8E5F] disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cita real"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Horarios disponibles</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Solo se muestran los espacios que de verdad puedes asignar.
                </p>
              </div>
              {loadingAgenda ? <span className="text-sm text-slate-500">Cargando...</span> : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[#DCEADF]">
              <table className="min-w-full divide-y divide-[#E7F1EA] text-sm">
                <thead className="bg-[#F5FBF7] text-left text-[#4D6356]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Hora</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF5F0] bg-white">
                  {availableSlots.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-slate-500">
                        No hay cupos libres para esa fecha.
                      </td>
                    </tr>
                  ) : (
                    availableSlots.map((slot) => (
                      <tr key={slot.value}>
                        <td className="px-4 py-3 font-medium text-[#24312A]">{slot.label}</td>
                        <td className="px-4 py-3 text-[#5B6E63]">
                          {getSlotAvailabilityStatus(slot)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">Agenda ocupada del dia</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Citas reales de nutricion para la fecha seleccionada.
                </p>
              </div>
              {loadingAgenda ? <span className="text-sm text-slate-500">Cargando...</span> : null}
            </div>

            <div className="mt-5 space-y-3">
              {nutritionAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                  No hay citas de nutricion para esa fecha.
                </div>
              ) : (
                nutritionAppointments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4"
                  >
                    <p className="text-base font-semibold text-[#24312A]">
                      {item.patient_name || "Sin nombre"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatHour(item.appointment_time)} · {formatStatus(item.status)}
                    </p>
                  </div>
                ))
              )}
            </div>
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
