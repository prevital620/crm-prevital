"use client";

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
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
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
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total cartera</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              ${resumen.totalCartera.toLocaleString("es-CO")}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Usuarios al día</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{resumen.alDia}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Usuarios pendientes</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{resumen.pendientes}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Usuarios con cartera</h2>

            <input
              className="mt-4 w-full rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Buscar por nombre, documento o teléfono"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />

            <div className="mt-4 space-y-3">
              {usuariosFiltrados.map((usuario) => (
                <button
                  key={usuario.id}
                  onClick={() => seleccionarUsuario(usuario)}
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
                    Cartera: ${Number(usuario.cartera || 0).toLocaleString("es-CO")}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="xl:col-span-2 rounded-3xl bg-white p-6 shadow-sm">
            {!usuarioSeleccionado ? (
              <p className="text-slate-600">Selecciona un usuario para administrar su cartera.</p>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-lg font-semibold text-slate-900">
                    {usuarioSeleccionado.nombre || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Volumen: ${Number(usuarioSeleccionado.volumen || 0).toLocaleString("es-CO")} ·
                    Caja: ${Number(usuarioSeleccionado.caja || 0).toLocaleString("es-CO")} ·
                    Cartera: ${Number(usuarioSeleccionado.cartera || 0).toLocaleString("es-CO")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Forma de pago: {usuarioSeleccionado.forma_pago || "No registrada"}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
                    placeholder="Encargado de cartera"
                    value={form.encargado_cartera}
                    onChange={(e) =>
                      setForm({ ...form, encargado_cartera: e.target.value })
                    }
                  />

                  <input
                    className="rounded-2xl border border-slate-300 p-4 outline-none"
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
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {guardando ? "Generando..." : "Generar cuotas"}
                </button>

                {mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Cuotas</h3>

                  {cuotasDelUsuario.length === 0 ? (
                    <p className="mt-3 text-slate-600">Aún no hay cuotas generadas.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {cuotasDelUsuario.map((cuota) => (
                        <div
                          key={cuota.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">
                                Cuota #{cuota.numero_cuota}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Valor: ${Number(cuota.valor_cuota).toLocaleString("es-CO")}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Fecha pago: {cuota.fecha_pago || "No registrada"}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Estado: {cuota.estado || "pendiente"}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "pagada")}
                                className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                              >
                                Marcar pagada
                              </button>

                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "pendiente")}
                                className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
                              >
                                Pendiente
                              </button>

                              <button
                                onClick={() => cambiarEstadoCuota(cuota.id, "vencida")}
                                className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
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