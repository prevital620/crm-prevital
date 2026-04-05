"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

function badgeEstado(estado: string | null) {
  switch (estado) {
    case "agendada":
      return "bg-blue-100 text-blue-700";
    case "confirmada":
      return "bg-emerald-100 text-emerald-700";
    case "asistió":
      return "bg-teal-100 text-teal-700";
    case "no asistió":
      return "bg-red-100 text-red-700";
    case "reagendada":
      return "bg-amber-100 text-amber-700";
    case "cancelada":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AgendaPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [citas, setCitas] = useState<Appointment[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [fechaFiltro, setFechaFiltro] = useState(hoyISO());
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

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("users")
      .select("id, nombre, documento, telefono, estado_actual")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando usuarios:", error);
      return;
    }

    setUsuarios(data || []);
  }

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

  async function cargarTodo() {
    setCargando(true);
    setMensaje("");
    await Promise.all([cargarUsuarios(), cargarCitas()]);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
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
      .filter((cita) => cita.fecha === fechaFiltro)
      .filter((cita) => (filtroTipo ? cita.tipo_cita === filtroTipo : true))
      .filter((cita) => (filtroEstado ? (cita.estado || "") === filtroEstado : true))
      .filter((cita) =>
        filtroProfesional ? (cita.profesional || "") === filtroProfesional : true
      )
      .filter((cita) => (filtroSede ? (cita.sede || "") === filtroSede : true))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }, [citas, fechaFiltro, filtroTipo, filtroEstado, filtroProfesional, filtroSede]);

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

    if (!form.tipo_cita) {
      setMensaje("Debes seleccionar el tipo de cita.");
      return;
    }

    if (!form.fecha) {
      setMensaje("Debes seleccionar la fecha.");
      return;
    }

    if (!form.hora) {
      setMensaje("Debes seleccionar la hora.");
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
    const { error } = await supabase
      .from("appointments")
      .update({ estado })
      .eq("id", id);

    if (error) {
      console.error("Error actualizando estado de cita:", error);
      setMensaje("No se pudo actualizar el estado.");
      return;
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
      return;
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

    if (!citaReagendar) {
      setMensaje("No hay cita seleccionada para reagendar.");
      return;
    }

    if (!formReagendar.fecha || !formReagendar.hora) {
      setMensaje("Debes seleccionar nueva fecha y nueva hora.");
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
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Agenda de servicios</p>
              <h1 className="text-3xl font-bold text-slate-900">Agenda Prevital</h1>
              <p className="mt-2 text-slate-600">
                Agenda en tiempo real para especialistas, detox y sueroterapias.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/usuarios"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white text-center"
              >
                Usuarios
              </a>

              <a
                href="/comercial"
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
              >
                Comercial
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Citas del día</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.total}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Especialistas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.especialistas}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Detox</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.detox}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sueroterapia</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.sueroterapia}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Confirmadas</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{resumen.confirmadas}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Buscar usuario</h2>

            <input
              className="mt-4 w-full rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Buscar por nombre, documento o teléfono"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            {cargando ? (
              <p className="mt-4 text-slate-600">Cargando usuarios...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {usuariosFiltrados.map((usuario) => (
                  <button
                    key={usuario.id}
                    onClick={() => setUsuarioSeleccionado(usuario)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      usuarioSeleccionado?.id === usuario.id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">
                      {usuario.nombre || "Sin nombre"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {usuario.documento || "Sin documento"} ·{" "}
                      {usuario.telefono || "Sin teléfono"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Estado: {usuario.estado_actual || "Sin estado"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-2 rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Agendar cita</h2>

            {!usuarioSeleccionado ? (
              <p className="mt-4 text-slate-600">
                Selecciona un usuario para agendar.
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">
                    {usuarioSeleccionado.nombre || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {usuarioSeleccionado.documento || "Sin documento"} ·{" "}
                    {usuarioSeleccionado.telefono || "Sin teléfono"}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <select
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
                    value={form.tipo_cita}
                    onChange={(e) => setForm({ ...form, tipo_cita: e.target.value })}
                  >
                    <option value="">Tipo de cita</option>
                    <option value="especialista">Especialista</option>
                    <option value="detox">Detox</option>
                    <option value="sueroterapia">Sueroterapia</option>
                  </select>

                  <input
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
                    placeholder="Profesional o responsable"
                    value={form.profesional}
                    onChange={(e) => setForm({ ...form, profesional: e.target.value })}
                  />

                  <input
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  />

                  <select
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
                    value={form.hora}
                    onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  >
                    <option value="">Hora</option>
                    {horasDisponibles.map((hora) => (
                      <option key={hora.value} value={hora.value}>
                        {hora.label}
                      </option>
                    ))}
                  </select>

                  <input
                    className="rounded-2xl border border-slate-300 p-4 outline-none md:col-span-2"
                    placeholder="Sede"
                    value={form.sede}
                    onChange={(e) => setForm({ ...form, sede: e.target.value })}
                  />

                  <textarea
                    className="min-h-28 rounded-2xl border border-slate-300 p-4 outline-none md:col-span-2"
                    placeholder="Observaciones"
                    value={form.observaciones}
                    onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  onClick={guardarCita}
                  disabled={guardando}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Agendar cita"}
                </button>

                {mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}
              </div>
            )}
          </div>
        </section>

        {citaReagendar && (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Reagendar cita</h2>

            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">
                {citaReagendar.usuario_nombre || "Sin usuario"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Actual: {citaReagendar.fecha} · {horaLabel(citaReagendar.hora)}
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                type="date"
                value={formReagendar.fecha}
                onChange={(e) =>
                  setFormReagendar({ ...formReagendar, fecha: e.target.value })
                }
              />

              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={formReagendar.hora}
                onChange={(e) =>
                  setFormReagendar({ ...formReagendar, hora: e.target.value })
                }
              >
                <option value="">Hora</option>
                {horasDisponibles.map((hora) => (
                  <option key={hora.value} value={hora.value}>
                    {hora.label}
                  </option>
                ))}
              </select>

              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                placeholder="Sede"
                value={formReagendar.sede}
                onChange={(e) =>
                  setFormReagendar({ ...formReagendar, sede: e.target.value })
                }
              />

              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                placeholder="Profesional o responsable"
                value={formReagendar.profesional}
                onChange={(e) =>
                  setFormReagendar({ ...formReagendar, profesional: e.target.value })
                }
              />

              <textarea
                className="min-h-28 rounded-2xl border border-slate-300 p-4 outline-none md:col-span-2"
                placeholder="Observaciones de reagendación"
                value={formReagendar.observaciones}
                onChange={(e) =>
                  setFormReagendar({ ...formReagendar, observaciones: e.target.value })
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={guardarReagendacion}
                disabled={guardando}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {guardando ? "Guardando..." : "Guardar reagendación"}
              </button>

              <button
                type="button"
                onClick={() => setCitaReagendar(null)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Agenda del día</h2>

              <input
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                <option value="especialista">Especialista</option>
                <option value="detox">Detox</option>
                <option value="sueroterapia">Sueroterapia</option>
              </select>

              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="agendada">Agendada</option>
                <option value="confirmada">Confirmada</option>
                <option value="asistió">Asistió</option>
                <option value="no asistió">No asistió</option>
                <option value="reagendada">Reagendada</option>
                <option value="cancelada">Cancelada</option>
              </select>

              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={filtroProfesional}
                onChange={(e) => setFiltroProfesional(e.target.value)}
              >
                <option value="">Todos los profesionales</option>
                {profesionalesDisponibles.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                className="rounded-2xl border border-slate-300 p-4 outline-none"
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
              >
                <option value="">Todas las sedes</option>
                {sedesDisponibles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cargando ? (
            <p className="mt-4 text-slate-600">Cargando agenda...</p>
          ) : citasFiltradas.length === 0 ? (
            <p className="mt-4 text-slate-600">No hay citas para ese filtro.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {citasFiltradas.map((cita) => (
                <div
                  key={cita.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-900">
                          {horaLabel(cita.hora)}
                        </p>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {cita.tipo_cita}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs ${badgeEstado(
                            cita.estado
                          )}`}
                        >
                          {cita.estado || "Sin estado"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        {cita.usuario_nombre || "Sin usuario"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {cita.documento || "Sin documento"} ·{" "}
                        {cita.telefono || "Sin teléfono"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Profesional: {cita.profesional || "No registrado"} · Sede:{" "}
                        {cita.sede || "No registrada"}
                      </p>

                      {cita.observaciones && (
                        <p className="mt-1 text-sm text-slate-600">
                          Observaciones: {cita.observaciones}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => cambiarEstadoCita(cita.id, "confirmada")}
                        className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        Confirmar
                      </button>

                      <button
                        onClick={() => cambiarEstadoCita(cita.id, "asistió")}
                        className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        Asistió
                      </button>

                      <button
                        onClick={() => cambiarEstadoCita(cita.id, "no asistió")}
                        className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        No asistió
                      </button>

                      <button
                        onClick={() => abrirReagendar(cita)}
                        className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        Reagendar
                      </button>

                      <button
                        onClick={() => cancelarCita(cita.id)}
                        className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mensaje && <p className="mt-4 text-sm text-slate-600">{mensaje}</p>}
        </section>
      </div>
    </main>
  );
}