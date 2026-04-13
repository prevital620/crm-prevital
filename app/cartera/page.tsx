"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Usuario = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  estado_actual: string | null;
  adquirio_plan: boolean | null;
  volumen: number | null;
  caja: number | null;
  cartera: number | null;
  forma_pago: string | null;
  numero_cuotas: number | null;
  encargado_cartera: string | null;
  estado_cartera: string | null;
};

type Cuota = {
  id: string;
  user_id: string | null;
  usuario_nombre: string | null;
  numero_cuota: number;
  valor_cuota: number;
  fecha_pago: string | null;
  estado: string | null;
  observaciones: string | null;
};

type FormCartera = {
  encargado_cartera: string;
  numero_cuotas: string;
};

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "rounded-2xl border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const cardClass =
  "rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]";

export default function CarteraPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState<FormCartera>({
    encargado_cartera: "",
    numero_cuotas: "",
  });

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, nombre, documento, telefono, estado_actual, adquirio_plan, volumen, caja, cartera, forma_pago, numero_cuotas, encargado_cartera, estado_cartera"
      )
      .eq("adquirio_plan", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMensaje("No se pudieron cargar los usuarios de cartera.");
      return;
    }

    setUsuarios(data || []);
  }

  async function cargarCuotas() {
    const { data, error } = await supabase
      .from("payment_installments")
      .select("*")
      .order("fecha_pago", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setCuotas(data || []);
  }

  useEffect(() => {
    cargarUsuarios();
    cargarCuotas();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;

    return usuarios.filter((u) => {
      return (
        (u.nombre || "").toLowerCase().includes(q) ||
        (u.documento || "").toLowerCase().includes(q) ||
        (u.telefono || "").toLowerCase().includes(q)
      );
    });
  }, [usuarios, busqueda]);

  const cuotasDelUsuario = useMemo(() => {
    if (!usuarioSeleccionado) return [];
    return cuotas
      .filter((c) => c.user_id === usuarioSeleccionado.id)
      .sort((a, b) => a.numero_cuota - b.numero_cuota);
  }, [cuotas, usuarioSeleccionado]);

  function seleccionarUsuario(usuario: Usuario) {
    setUsuarioSeleccionado(usuario);
    setMensaje("");
    setForm({
      encargado_cartera: usuario.encargado_cartera || "",
      numero_cuotas: usuario.numero_cuotas != null ? String(usuario.numero_cuotas) : "",
    });
  }

  async function generarCuotas() {
    setMensaje("");

    if (!usuarioSeleccionado) {
      setMensaje("Debes seleccionar un usuario.");
      return;
    }

    if (!form.encargado_cartera.trim()) {
      setMensaje("Debes escribir el encargado de cartera.");
      return;
    }

    const numeroCuotas = Number(form.numero_cuotas || 0);
    if (!numeroCuotas || numeroCuotas < 1) {
      setMensaje("Debes indicar un número de cuotas válido.");
      return;
    }

    const cartera = Number(usuarioSeleccionado.cartera || 0);
    if (cartera <= 0) {
      setMensaje("Este usuario no tiene cartera pendiente.");
      return;
    }

    setGuardando(true);

    const valorBase = Math.floor((cartera / numeroCuotas) * 100) / 100;
    const cuotasInsertar = [];

    let acumulado = 0;

    for (let i = 1; i <= numeroCuotas; i++) {
      let valorCuota = valorBase;
      if (i === numeroCuotas) {
        valorCuota = Number((cartera - acumulado).toFixed(2));
      } else {
        acumulado += valorCuota;
      }

      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() + i);

      const fechaPago = `${fecha.getFullYear()}-${String(
        fecha.getMonth() + 1
      ).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

      cuotasInsertar.push({
        user_id: usuarioSeleccionado.id,
        usuario_nombre: usuarioSeleccionado.nombre || null,
        numero_cuota: i,
        valor_cuota: valorCuota,
        fecha_pago: fechaPago,
        estado: "pendiente",
        observaciones: null,
      });
    }

    const { error: errorUsuario } = await supabase
      .from("users")
      .update({
        numero_cuotas: numeroCuotas,
        encargado_cartera: form.encargado_cartera,
        estado_cartera: "pendiente",
      })
      .eq("id", usuarioSeleccionado.id);

    if (errorUsuario) {
      console.error(errorUsuario);
      setMensaje("No se pudo actualizar el usuario.");
      setGuardando(false);
      return;
    }

    const { error: errorDelete } = await supabase
      .from("payment_installments")
      .delete()
      .eq("user_id", usuarioSeleccionado.id);

    if (errorDelete) {
      console.error(errorDelete);
      setMensaje("No se pudieron limpiar cuotas anteriores.");
      setGuardando(false);
      return;
    }

    const { error: errorInsert } = await supabase
      .from("payment_installments")
      .insert(cuotasInsertar);

    if (errorInsert) {
      console.error(errorInsert);
      setMensaje("No se pudieron generar las cuotas.");
      setGuardando(false);
      return;
    }

    setMensaje("Cuotas generadas correctamente.");
    await cargarUsuarios();
    await cargarCuotas();
    setGuardando(false);
  }

  async function cambiarEstadoCuota(id: string, estado: string) {
    const { error } = await supabase
      .from("payment_installments")
      .update({ estado })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMensaje("No se pudo actualizar el estado de la cuota.");
      return;
    }

    await cargarCuotas();
  }

  const resumen = useMemo(() => {
    const totalCartera = usuarios.reduce((acc, u) => acc + Number(u.cartera || 0), 0);
    const alDia = usuarios.filter((u) => u.estado_cartera === "al día").length;
    const pendientes = usuarios.filter(
      (u) => !u.estado_cartera || u.estado_cartera === "pendiente"
    ).length;

    return { totalCartera, alDia, pendientes };
  }, [usuarios]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-10">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[420px] w-[420px] opacity-[0.04] md:h-[540px] md:w-[540px]">
          <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain" priority />
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-[20px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#FFFFFF_0%,_#F0FBF5_60%,_#E2F4EA_100%)] shadow-[0_14px_30px_rgba(95,125,102,0.18)]">
            <Image src="/prevital-logo.jpeg" alt="Prevital" fill className="object-contain p-1" priority />
          </div>
        </div>
        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Módulo financiero</p>
              <h1 className="text-3xl font-bold text-slate-900">Cartera y cuotas</h1>
              <p className="mt-2 text-slate-600">
                Administra el saldo pendiente, cuotas y seguimiento de pagos.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/comercial"
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white text-center"
              >
                Comercial
              </a>
              <a
                href="/usuarios"
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
              >
                Usuarios
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className={cardClass}>
            <p className="text-sm text-slate-500">Total cartera</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              ${resumen.totalCartera.toLocaleString("es-CO")}
            </p>
          </div>

          <div className={cardClass}>
            <p className="text-sm text-slate-500">Usuarios al día</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{resumen.alDia}</p>
          </div>

          <div className={cardClass}>
            <p className="text-sm text-slate-500">Usuarios pendientes</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{resumen.pendientes}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className={panelClass}>
            <h2 className="text-xl font-semibold text-slate-900">Usuarios con cartera</h2>

            <input
              className={`mt-4 w-full ${inputClass}`}
              placeholder="Buscar por nombre, documento o teléfono"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <div className="mt-4 space-y-3">
              {usuariosFiltrados.map((usuario) => (
                <button
                  key={usuario.id}
                  onClick={() => seleccionarUsuario(usuario)}
                  className={`w-full rounded-[26px] border p-4 text-left transition ${
                    usuarioSeleccionado?.id === usuario.id
                      ? "border-[#6C9C88] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] shadow-[0_16px_32px_rgba(95,125,102,0.12)]"
                      : "border-[#D6E8DA] bg-white/92 shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F8FCF9]"
                  }`}
                >
                  <p className="font-semibold text-[#24312A]">
                    {usuario.nombre || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-sm text-[#607368]">
                    {usuario.documento || "Sin documento"} ·{" "}
                    {usuario.telefono || "Sin teléfono"}
                  </p>
                  <p className="mt-1 text-sm text-[#607368]">
                    Cartera: ${Number(usuario.cartera || 0).toLocaleString("es-CO")}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className={`xl:col-span-2 ${panelClass}`}>
            {!usuarioSeleccionado ? (
              <p className="text-[#607368]">Selecciona un usuario para administrar su cartera.</p>
            ) : (
              <div className="space-y-6">
                <div className="rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner">
                  <p className="text-lg font-semibold text-[#24312A]">
                    {usuarioSeleccionado.nombre || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-sm text-[#607368]">
                    Volumen: ${Number(usuarioSeleccionado.volumen || 0).toLocaleString("es-CO")} ·
                    Caja: ${Number(usuarioSeleccionado.caja || 0).toLocaleString("es-CO")} ·
                    Cartera: ${Number(usuarioSeleccionado.cartera || 0).toLocaleString("es-CO")}
                  </p>
                  <p className="mt-1 text-sm text-[#607368]">
                    Forma de pago: {usuarioSeleccionado.forma_pago || "No registrada"}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="Encargado de cartera"
                    value={form.encargado_cartera}
                    onChange={(e) =>
                      setForm({ ...form, encargado_cartera: e.target.value })
                    }
                  />

                  <input
                    className={inputClass}
                    type="number"
                    placeholder="Número de cuotas"
                    value={form.numero_cuotas}
                    onChange={(e) =>
                      setForm({ ...form, numero_cuotas: e.target.value })
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={generarCuotas}
                  disabled={guardando}
                  className="rounded-2xl bg-[linear-gradient(135deg,_#274534_0%,_#3F6952_45%,_#5F7D66_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(63,105,82,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
                >
                  {guardando ? "Generando..." : "Generar cuotas"}
                </button>

                {mensaje && <p className="rounded-2xl border border-[#CFE4D8] bg-[#F4FBF6] px-4 py-3 text-sm text-[#4F6F5B]">{mensaje}</p>}

                <div>
                  <h3 className="text-lg font-semibold text-[#24312A]">Cuotas</h3>

                  {cuotasDelUsuario.length === 0 ? (
                    <p className="mt-3 text-slate-600">Aún no hay cuotas generadas.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {cuotasDelUsuario.map((cuota) => (
                        <div
                          key={cuota.id}
                          className="rounded-[26px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-4 shadow-[0_16px_34px_rgba(95,125,102,0.08)]"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-[#24312A]">
                                Cuota #{cuota.numero_cuota}
                              </p>
                              <p className="mt-1 text-sm text-[#607368]">
                                Valor: ${Number(cuota.valor_cuota).toLocaleString("es-CO")}
                              </p>
                              <p className="mt-1 text-sm text-[#607368]">
                                Fecha pago: {cuota.fecha_pago || "No registrada"}
                              </p>
                              <p className="mt-1 text-sm text-[#607368]">
                                Estado: {cuota.estado || "pendiente"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "pagada")}
                                className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6]"
                              >
                                Marcar pagada
                              </button>

                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "pendiente")}
                                className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6]"
                              >
                                Pendiente
                              </button>

                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "vencida")}
                                className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-3 py-2 text-xs font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6]"
                              >
                                Vencida
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
