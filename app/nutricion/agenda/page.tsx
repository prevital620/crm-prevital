"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AgendaScheduleView,
  type ViewMode,
} from "@/components/agenda/agenda-schedule-view";

type AppointmentRow = {
  id: string;
  patient_name: string;
  phone: string | null;
  city: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
};

function formatHora(hora: string | null | undefined) {
  if (!hora) return "";
  return hora.slice(0, 5);
}

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function NutricionAgendaPage() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(hoyISO());
  const [viewMode, setViewMode] = useState<ViewMode>("dia");

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("appointments")
          .select(
            "id, patient_name, phone, city, appointment_date, appointment_time, status, service_type"
          )
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (error) throw error;
        if (!active) return;

        const filtered = ((data as AppointmentRow[]) || []).filter((item) => {
          const service = (item.service_type || "").toLowerCase();
          return service.includes("nutri");
        });

        setAppointments(filtered);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar las citas de nutricion.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAppointments();

    return () => {
      active = false;
    };
  }, []);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((item) => {
      const text = `${item.patient_name || ""} ${item.phone || ""} ${item.city || ""}`.toLowerCase();
      return q ? text.includes(q) : true;
    });
  }, [appointments, search]);

  const calendarAppointments = useMemo(() => {
    return filteredAppointments.map((item) => ({
      id: item.id,
      usuario_nombre: item.patient_name || "Sin nombre",
      documento: item.city || "Sin ciudad",
      telefono: item.phone || "Sin telefono",
      tipo_cita: item.service_type || "Nutricion",
      profesional: null,
      sede: item.city || null,
      fecha: item.appointment_date,
      hora: formatHora(item.appointment_time) || item.appointment_time,
      estado: item.status || null,
      observaciones: null,
    }));
  }, [filteredAppointments]);

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
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                Agenda de nutricion
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Consulta las citas reales de nutricion en vista diaria, semanal o mensual.
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
                href="/nutricion/agendar"
                className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
              >
                Agendar cita
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#24312A]">Agenda visible</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ahora puedes consultar la agenda en formato calendario completo.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287]"
                placeholder="Buscar por nombre, telefono o ciudad"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#FBFCFB] p-4 text-sm text-slate-500">
                Usa los botones de dia, semana o mes para ordenar mejor la agenda.
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-6 text-sm text-slate-500">
              Cargando citas...
            </div>
          ) : calendarAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#FBFCFB] p-6 text-sm text-slate-500">
              No hay citas reales de nutricion con esos filtros.
            </div>
          ) : (
            <AgendaScheduleView
              appointments={calendarAppointments}
              selectedDate={dateFilter}
              viewMode={viewMode}
              onChangeDate={setDateFilter}
              onChangeViewMode={setViewMode}
              emptyDetailLabel="No hay citas de nutricion para este dia."
              renderDetailExtra={(appointment) => (
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/nutricion/atencion/${appointment.id}`}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#0DA56F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B8E5F]"
                  >
                    Abrir atencion
                  </Link>
                </div>
              )}
            />
          )}
        </section>
      </div>
    </main>
  );
}
