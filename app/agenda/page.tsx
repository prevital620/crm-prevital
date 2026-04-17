"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AgendaScheduleView,
  type ViewMode,
} from "@/components/agenda/agenda-schedule-view";

type Usuario = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  estado_actual: string | null;
};

type Appointment = {
  id: string;
  user_id: string | null;
  usuario_nombre: string | null;
  documento: string | null;
  telefono: string | null;
  tipo_cita: string;
  profesional: string | null;
  sede: string | null;
  fecha: string;
  hora: string;
  estado: string | null;
  observaciones: string | null;
};

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function horaLabel(hora: string) {
  const [hh, mm] = hora.split(":");
  const h = Number(hh);
  if (h === 12) return `12:${mm} m`;
  if (h === 0) return `12:${mm} am`;
  if (h < 12) return `${h}:${mm} am`;
  return `${h - 12}:${mm} pm`;
}

const horasDisponibles = [
  { value: "08:00", label: "8:00 am" },
  { value: "09:00", label: "9:00 am" },
  { value: "10:00", label: "10:00 am" },
  { value: "11:00", label: "11:00 am" },
  { value: "12:00", label: "12:00 m" },
  { value: "13:30", label: "1:30 pm" },
  { value: "14:30", label: "2:30 pm" },
  { value: "15:30", label: "3:30 pm" },
  { value: "16:30", label: "4:30 pm" },
  { value: "17:30", label: "5:30 pm" },
];

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "rounded-2xl border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const primaryButtonClass =
  "rounded-2xl bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(63,105,82,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]";

export default function AgendaPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [citas, setCitas] = useState<Appointment[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [fechaFiltro, setFechaFiltro] = useState(hoyISO());
  const [modoVista, setModoVista] = useState<ViewMode>("dia");
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroProfesional, setFiltroProfesional] = useState("");
  const [filtroSede, setFiltroSede] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    tipo_cita: "",
    profesional: "",
    sede: "",
    fecha: hoyISO(),
    hora: "",
    observaciones: "",
  });

  const [citaReagendar, setCitaReagendar] = useState<Appointment | null>(null);
  const [formReagendar, setFormReagendar] = useState({
    fecha: hoyISO(),
    hora: "",
    sede: "",
    profesional: "",
    observaciones: "",
  });

  async function cargarCitas() {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true });

    if (error) {
      console.error("Error cargando citas:", error);
      setMensaje("No se pudieron cargar las citas.");
      return;
    }

    setCitas(data || []);
  }

  useEffect(() => {
    let active = true;

    async function cargarInicial() {
      setCargando(true);
      setMensaje("");

      const [usuariosResult, citasResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, nombre, documento, telefono, estado_actual")
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("*")
          .order("fecha", { ascending: true })
          .order("hora", { ascending: true }),
      ]);

      if (!active) return;

      if (usuariosResult.error) {
        console.error("Error cargando usuarios:", usuariosResult.error);
      } else {
        setUsuarios(usuariosResult.data || []);
      }

      if (citasResult.error) {
        console.error("Error cargando citas:", citasResult.error);
        setMensaje("No se pudieron cargar las citas.");
      } else {
        setCitas(citasResult.data || []);
      }

      setCargando(false);
    }

    void cargarInicial();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("appointments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        async () => {
          await cargarCitas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios.slice(0, 20);

    return usuarios.filter((u) => {
      return (
        (u.nombre || "").toLowerCase().includes(q) ||
        (u.documento || "").toLowerCase().includes(q) ||
        (u.telefono || "").toLowerCase().includes(q)
      );
    });
  }, [usuarios, busqueda]);

  const profesionalesDisponibles = useMemo(() => {
    return Array.from(
      new Set(citas.map((c) => c.profesional || "").filter((v) => v.trim() !== ""))
    ).sort();
  }, [citas]);

  const sedesDisponibles = useMemo(() => {
    return Array.from(
      new Set(citas.map((c) => c.sede || "").filter((v) => v.trim() !== ""))
    ).sort();
  }, [citas]);

  const citasFiltradas = useMemo(() => {
    return citas
      .filter((cita) => (filtroTipo ? cita.tipo_cita === filtroTipo : true))
      .filter((cita) => (filtroEstado ? (cita.estado || "") === filtroEstado : true))
      .filter((cita) =>
        filtroProfesional ? (cita.profesional || "") === filtroProfesional : true
      )
      .filter((cita) => (filtroSede ? (cita.sede || "") === filtroSede : true))
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
      });
  }, [citas, filtroTipo, filtroEstado, filtroProfesional, filtroSede]);

  const resumen = useMemo(() => {
    const delDia = citas.filter((c) => c.fecha === fechaFiltro);
    return {
      total: delDia.length,
      especialistas: delDia.filter((c) => c.tipo_cita === "especialista").length,
      detox: delDia.filter((c) => c.tipo_cita === "detox").length,
      sueroterapia: delDia.filter((c) => c.tipo_cita === "sueroterapia").length,
      confirmadas: delDia.filter((c) => c.estado === "confirmada").length,
    };
  }, [citas, fechaFiltro]);

  async function guardarCita() {
    setMensaje("");

    if (!usuarioSeleccionado) {
      setMensaje("Debes seleccionar un usuario.");
      return;
    }

    if (!form.tipo_cita || !form.fecha || !form.hora) {
      setMensaje("Completa tipo de cita, fecha y hora.");
      return;
    }

    setGuardando(true);

    const { error } = await supabase.from("appointments").insert([
      {
        user_id: usuarioSeleccionado.id,
        usuario_nombre: usuarioSeleccionado.nombre || null,
        documento: usuarioSeleccionado.documento || null,
        telefono: usuarioSeleccionado.telefono || null,
        tipo_cita: form.tipo_cita,
        profesional: form.profesional || null,
        sede: form.sede || null,
        fecha: form.fecha,
        hora: form.hora,
        estado: "agendada",
        observaciones: form.observaciones || null,
      },
    ]);

    if (error) {
      console.error("Error guardando cita:", error);
      setMensaje("No se pudo guardar la cita.");
      setGuardando(false);
      return;
    }

    setMensaje("Cita agendada correctamente.");
    setForm({
      tipo_cita: "",
      profesional: "",
      sede: "",
      fecha: hoyISO(),
      hora: "",
      observaciones: "",
    });
    setGuardando(false);
  }

  async function cambiarEstadoCita(id: string, estado: string) {
    const { error } = await supabase.from("appointments").update({ estado }).eq("id", id);
    if (error) {
      console.error("Error actualizando estado de cita:", error);
      setMensaje("No se pudo actualizar el estado.");
    }
  }

  async function cancelarCita(id: string) {
    const { error } = await supabase
      .from("appointments")
      .update({ estado: "cancelada" })
      .eq("id", id);

    if (error) {
      console.error("Error cancelando cita:", error);
      setMensaje("No se pudo cancelar la cita.");
    }
  }

  function abrirReagendar(cita: Appointment) {
    setCitaReagendar(cita);
    setFormReagendar({
      fecha: cita.fecha,
      hora: cita.hora,
      sede: cita.sede || "",
      profesional: cita.profesional || "",
      observaciones: cita.observaciones || "",
    });
    setMensaje("");
  }

  async function guardarReagendacion() {
    setMensaje("");
    if (!citaReagendar || !formReagendar.fecha || !formReagendar.hora) {
      setMensaje("Debes seleccionar nueva fecha y hora.");
      return;
    }

    setGuardando(true);

    const observacionesFinales = [
      citaReagendar.observaciones || "",
      `Reagendada a ${formReagendar.fecha} ${formReagendar.hora}.`,
      formReagendar.observaciones || "",
    ]
      .filter(Boolean)
      .join(" ");

    const { error } = await supabase
      .from("appointments")
      .update({
        fecha: formReagendar.fecha,
        hora: formReagendar.hora,
        sede: formReagendar.sede || null,
        profesional: formReagendar.profesional || null,
        observaciones: observacionesFinales,
        estado: "reagendada",
      })
      .eq("id", citaReagendar.id);

    if (error) {
      console.error("Error reagendando cita:", error);
      setMensaje("No se pudo reagendar la cita.");
      setGuardando(false);
      return;
    }

    setMensaje("Cita reagendada correctamente.");
    setCitaReagendar(null);
    setGuardando(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_38%,_#FFFCF8_100%)] p-6 md:p-10">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.04] md:h-[540px] md:w-[540px]">
          <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain" priority />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Agenda</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">Agenda Prevital</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Agenda en tiempo real para especialistas, detox y sueroterapias.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/usuarios" className="rounded-2xl bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] px-4 py-2 text-sm font-medium text-white shadow-[0_16px_30px_rgba(63,105,82,0.22)] transition hover:-translate-y-0.5 hover:brightness-105">Usuarios</Link>
              <Link href="/comercial" className="rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]">Comercial</Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"><p className="text-sm text-[#5B6E63]">Citas del dia</p><p className="mt-2 text-3xl font-bold text-[#24312A]">{resumen.total}</p></div>
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"><p className="text-sm text-[#5B6E63]">Especialistas</p><p className="mt-2 text-3xl font-bold text-[#24312A]">{resumen.especialistas}</p></div>
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"><p className="text-sm text-[#5B6E63]">Detox</p><p className="mt-2 text-3xl font-bold text-[#24312A]">{resumen.detox}</p></div>
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"><p className="text-sm text-[#5B6E63]">Sueroterapia</p><p className="mt-2 text-3xl font-bold text-[#24312A]">{resumen.sueroterapia}</p></div>
          <div className="rounded-[28px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]"><p className="text-sm text-[#5B6E63]">Confirmadas</p><p className="mt-2 text-3xl font-bold text-emerald-700">{resumen.confirmadas}</p></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className={panelClass}>
            <h2 className="text-xl font-semibold text-[#24312A]">Buscar usuario</h2>
            <input className={`mt-4 w-full ${inputClass}`} placeholder="Buscar por nombre, documento o telefono" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            {cargando ? (
              <p className="mt-4 text-[#607368]">Cargando usuarios...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {usuariosFiltrados.map((usuario) => (
                  <button key={usuario.id} onClick={() => setUsuarioSeleccionado(usuario)} className={`w-full rounded-[26px] border p-4 text-left transition ${usuarioSeleccionado?.id === usuario.id ? "border-[#6C9C88] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] shadow-[0_16px_32px_rgba(95,125,102,0.12)]" : "border-[#D6E8DA] bg-white/92 shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F8FCF9]"}`}>
                    <p className="font-semibold text-[#24312A]">{usuario.nombre || "Sin nombre"}</p>
                    <p className="mt-1 text-sm text-[#607368]">{usuario.documento || "Sin documento"} · {usuario.telefono || "Sin telefono"}</p>
                    <p className="mt-1 text-sm text-[#607368]">Estado: {usuario.estado_actual || "Sin estado"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`xl:col-span-2 ${panelClass}`}>
            <h2 className="text-xl font-semibold text-[#24312A]">Agendar cita</h2>
            {!usuarioSeleccionado ? (
              <p className="mt-4 text-[#607368]">Selecciona un usuario para agendar.</p>
            ) : (
              <div className="mt-4 space-y-6">
                <div className="rounded-2xl border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner">
                  <p className="font-semibold text-[#24312A]">{usuarioSeleccionado.nombre || "Sin nombre"}</p>
                  <p className="mt-1 text-sm text-[#607368]">{usuarioSeleccionado.documento || "Sin documento"} · {usuarioSeleccionado.telefono || "Sin telefono"}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <select className={inputClass} value={form.tipo_cita} onChange={(e) => setForm({ ...form, tipo_cita: e.target.value })}><option value="">Tipo de cita</option><option value="especialista">Especialista</option><option value="detox">Detox</option><option value="sueroterapia">Sueroterapia</option></select>
                  <input className={inputClass} placeholder="Profesional o responsable" value={form.profesional} onChange={(e) => setForm({ ...form, profesional: e.target.value })} />
                  <input className={inputClass} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                  <select className={inputClass} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })}><option value="">Hora</option>{horasDisponibles.map((hora) => <option key={hora.value} value={hora.value}>{hora.label}</option>)}</select>
                  <input className={`${inputClass} md:col-span-2`} placeholder="Sede" value={form.sede} onChange={(e) => setForm({ ...form, sede: e.target.value })} />
                  <textarea className={`min-h-28 ${inputClass} md:col-span-2`} placeholder="Observaciones" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
                </div>
                <button type="button" onClick={guardarCita} disabled={guardando} className={primaryButtonClass}>{guardando ? "Guardando..." : "Agendar cita"}</button>
              </div>
            )}
          </div>
        </section>

        {citaReagendar ? (
          <section className={panelClass}>
            <h2 className="text-xl font-semibold text-[#24312A]">Reagendar cita</h2>
            <div className="mt-4 rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner">
              <p className="font-semibold text-[#24312A]">{citaReagendar.usuario_nombre || "Sin usuario"}</p>
              <p className="mt-1 text-sm text-[#607368]">Actual: {citaReagendar.fecha} · {horaLabel(citaReagendar.hora)}</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input className={inputClass} type="date" value={formReagendar.fecha} onChange={(e) => setFormReagendar({ ...formReagendar, fecha: e.target.value })} />
              <select className={inputClass} value={formReagendar.hora} onChange={(e) => setFormReagendar({ ...formReagendar, hora: e.target.value })}><option value="">Hora</option>{horasDisponibles.map((hora) => <option key={hora.value} value={hora.value}>{hora.label}</option>)}</select>
              <input className={inputClass} placeholder="Sede" value={formReagendar.sede} onChange={(e) => setFormReagendar({ ...formReagendar, sede: e.target.value })} />
              <input className={inputClass} placeholder="Profesional o responsable" value={formReagendar.profesional} onChange={(e) => setFormReagendar({ ...formReagendar, profesional: e.target.value })} />
              <textarea className={`min-h-28 ${inputClass} md:col-span-2`} placeholder="Observaciones de reagendacion" value={formReagendar.observaciones} onChange={(e) => setFormReagendar({ ...formReagendar, observaciones: e.target.value })} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={guardarReagendacion} disabled={guardando} className={primaryButtonClass}>{guardando ? "Guardando..." : "Guardar reagendacion"}</button>
              <button type="button" onClick={() => setCitaReagendar(null)} className={secondaryButtonClass}>Cancelar</button>
            </div>
          </section>
        ) : null}

        <section className={panelClass}>
          <div className="grid gap-3 md:grid-cols-4">
            <select className={inputClass} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}><option value="">Todos los tipos</option><option value="especialista">Especialista</option><option value="detox">Detox</option><option value="sueroterapia">Sueroterapia</option></select>
            <select className={inputClass} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}><option value="">Todos los estados</option><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value={"asisti\u00F3"}>Asistio</option><option value={"no asisti\u00F3"}>No asistio</option><option value="reagendada">Reagendada</option><option value="cancelada">Cancelada</option></select>
            <select className={inputClass} value={filtroProfesional} onChange={(e) => setFiltroProfesional(e.target.value)}><option value="">Todos los profesionales</option>{profesionalesDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select className={inputClass} value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}><option value="">Todas las sedes</option>{sedesDisponibles.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>

          {cargando ? (
            <p className="mt-4 text-[#607368]">Cargando agenda...</p>
          ) : citasFiltradas.length === 0 ? (
            <p className="mt-4 text-[#607368]">No hay citas para ese filtro.</p>
          ) : (
            <AgendaScheduleView
              appointments={citasFiltradas}
              selectedDate={fechaFiltro}
              viewMode={modoVista}
              onChangeDate={setFechaFiltro}
              onChangeViewMode={setModoVista}
              onConfirmAppointment={(id) => cambiarEstadoCita(id, "confirmada")}
              onAttendAppointment={(id) => cambiarEstadoCita(id, "asisti\u00F3")}
              onMissAppointment={(id) => cambiarEstadoCita(id, "no asisti\u00F3")}
              onRescheduleAppointment={abrirReagendar}
              onCancelAppointment={cancelarCita}
            />
          )}

          {mensaje ? <p className="mt-4 text-sm text-[#607368]">{mensaje}</p> : null}
        </section>
      </div>
    </main>
  );
}
