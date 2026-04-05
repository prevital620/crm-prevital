"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Usuario = {
  id: string;
  nombre: string | null;
  documento: string | null;
  telefono: string | null;
  clasificacion_inicial: string | null;
  clasificacion_final: string | null;
  estado_actual: string | null;
  asignado: boolean | null;
  comercial_id: string | null;
  comercial_nombre: string | null;
  gerente_asigno: string | null;
  fecha_hora_asignacion: string | null;
};

type Comercial = {
  id: string;
  nombre: string;
  activo: boolean | null;
};

const comercialInicial = {
  nombre: "",
};

export default function AsignacionPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [comerciales, setComerciales] = useState<Comercial[]>([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Usuario | null>(null);
  const [comercialSeleccionado, setComercialSeleccionado] = useState("");
  const [gerenteAsigno, setGerenteAsigno] = useState("");
  const [nuevoComercial, setNuevoComercial] = useState(comercialInicial);
  const [guardando, setGuardando] = useState(false);
  const [guardandoComercial, setGuardandoComercial] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cargarUsuarios() {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, nombre, documento, telefono, clasificacion_inicial, clasificacion_final, estado_actual, asignado, comercial_id, comercial_nombre, gerente_asigno, fecha_hora_asignacion"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMensaje("No se pudieron cargar los usuarios.");
      return;
    }

    setUsuarios(data || []);
  }

  async function cargarComerciales() {
    const { data, error } = await supabase
      .from("sales_advisors")
      .select("*")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      setMensaje("No se pudieron cargar los comerciales.");
      return;
    }

    setComerciales(data || []);
  }

  useEffect(() => {
    cargarUsuarios();
    cargarComerciales();
  }, []);

  const usuariosPendientes = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.comercial_id == null &&
        !u.comercial_nombre &&
        u.asignado !== true &&
        (u.estado_actual === "pendiente asignacion" ||
          u.estado_actual === "pendiente valoracion")
    );
  }, [usuarios]);

  const usuariosAsignados = useMemo(() => {
    return usuarios.filter(
      (u) =>
        u.asignado === true ||
        u.comercial_id != null ||
        !!u.comercial_nombre
    );
  }, [usuarios]);

  const conteoPorComercial = useMemo(() => {
    const mapa: Record<string, number> = {};

    comerciales.forEach((c) => {
      mapa[c.id] = 0;
    });

    usuariosAsignados.forEach((u) => {
      if (u.comercial_id) {
        mapa[u.comercial_id] = (mapa[u.comercial_id] || 0) + 1;
      }
    });

    return mapa;
  }, [comerciales, usuariosAsignados]);

  async function crearComercial(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");

    if (!nuevoComercial.nombre.trim()) {
      setMensaje("El nombre del comercial es obligatorio.");
      return;
    }

    setGuardandoComercial(true);

    const { error } = await supabase.from("sales_advisors").insert([
      {
        nombre: nuevoComercial.nombre,
        activo: true,
      },
    ]);

    if (error) {
      setMensaje("No se pudo crear el comercial.");
      setGuardandoComercial(false);
      return;
    }

    setNuevoComercial(comercialInicial);
    setMensaje("Comercial creado correctamente.");
    await cargarComerciales();
    setGuardandoComercial(false);
  }

  async function asignarUsuario() {
    setMensaje("");

    if (!usuarioSeleccionado) {
      setMensaje("Debes seleccionar un usuario.");
      return;
    }

    if (!comercialSeleccionado) {
      setMensaje("Debes seleccionar un comercial.");
      return;
    }

    if (!gerenteAsigno.trim()) {
      setMensaje("Debes escribir quién asigna.");
      return;
    }

    const comercial = comerciales.find((c) => c.id === comercialSeleccionado);
    if (!comercial) {
      setMensaje("No se encontró el comercial.");
      return;
    }

    setGuardando(true);

    const { error } = await supabase
      .from("users")
      .update({
        comercial_id: comercial.id,
        comercial_nombre: comercial.nombre,
        gerente_asigno: gerenteAsigno,
        fecha_hora_asignacion: new Date().toISOString(),
        asignado: true,
        estado_actual: "asignado a comercial",
      })
      .eq("id", usuarioSeleccionado.id);

    if (error) {
      setMensaje("No se pudo asignar el usuario.");
      setGuardando(false);
      return;
    }

    setMensaje("Usuario asignado correctamente.");
    setUsuarioSeleccionado(null);
    setComercialSeleccionado("");
    await cargarUsuarios();
    setGuardando(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Gerencia de ventas</p>
              <h1 className="text-3xl font-bold text-slate-900">Asignación comercial</h1>
              <p className="mt-2 text-slate-600">
                Asigna en tiempo real los usuarios listos a un asesor comercial.
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
                href="/recepcion"
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
              >
                Recepción
              </a>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pendientes por asignar</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{usuariosPendientes.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Asignados</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{usuariosAsignados.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Comerciales activos</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{comerciales.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Q inicial</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {usuariosPendientes.filter((u) => u.clasificacion_inicial === "Q").length}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Usuarios por asignar</h2>

            <div className="mt-4 space-y-3">
              {usuariosPendientes.length === 0 ? (
                <p className="text-slate-600">No hay usuarios pendientes por asignar.</p>
              ) : (
                usuariosPendientes.map((usuario) => (
                  <button
                    key={usuario.id}
                    onClick={() => setUsuarioSeleccionado(usuario)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      usuarioSeleccionado?.id === usuario.id
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {usuario.nombre || "Sin nombre"}
                      </p>

                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">
                        Por asignar
                      </span>

                      {usuario.clasificacion_inicial && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${
                            usuario.clasificacion_inicial === "Q"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {usuario.clasificacion_inicial}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {usuario.documento || "Sin documento"} ·{" "}
                      {usuario.telefono || "Sin teléfono"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Asignar usuario</h2>

            {!usuarioSeleccionado ? (
              <p className="mt-4 text-slate-600">
                Selecciona un usuario pendiente para asignarlo a un comercial.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">
                    {usuarioSeleccionado.nombre || "Sin nombre"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {usuarioSeleccionado.documento || "Sin documento"} ·{" "}
                    {usuarioSeleccionado.telefono || "Sin teléfono"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Clasificación inicial:{" "}
                    {usuarioSeleccionado.clasificacion_inicial || "No definida"}
                  </p>
                </div>

                <input
                  className="w-full rounded-2xl border border-slate-300 p-4 outline-none"
                  placeholder="Nombre del gerente que asigna"
                  value={gerenteAsigno}
                  onChange={(e) => setGerenteAsigno(e.target.value)}
                />

                <select
                  className="w-full rounded-2xl border border-slate-300 p-4 outline-none"
                  value={comercialSeleccionado}
                  onChange={(e) => setComercialSeleccionado(e.target.value)}
                >
                  <option value="">Selecciona un comercial</option>
                  {comerciales.map((comercial) => (
                    <option key={comercial.id} value={comercial.id}>
                      {comercial.nombre} — {conteoPorComercial[comercial.id] || 0} asignado(s)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={asignarUsuario}
                  disabled={guardando}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {guardando ? "Asignando..." : "Asignar a comercial"}
                </button>
              </div>
            )}

            {mensaje && <p className="mt-4 text-sm text-slate-600">{mensaje}</p>}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Comerciales</h2>

            <form onSubmit={crearComercial} className="mt-4 space-y-3">
              <input
                className="w-full rounded-2xl border border-slate-300 p-4 outline-none"
                placeholder="Nombre del comercial"
                value={nuevoComercial.nombre}
                onChange={(e) => setNuevoComercial({ nombre: e.target.value })}
              />

              <button
                type="submit"
                disabled={guardandoComercial}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60"
              >
                {guardandoComercial ? "Guardando..." : "Crear comercial"}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {comerciales.length === 0 ? (
                <p className="text-slate-600">Aún no hay comerciales creados.</p>
              ) : (
                comerciales.map((comercial) => {
                  const carga = conteoPorComercial[comercial.id] || 0;
                  const color =
                    carga === 0
                      ? "bg-emerald-100 text-emerald-700"
                      : carga <= 2
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700";

                  return (
                    <div
                      key={comercial.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{comercial.nombre}</p>
                          <p className="text-sm text-slate-600">
                            {carga} usuario(s) asignado(s)
                          </p>
                        </div>

                        <span className={`rounded-full px-3 py-1 text-xs ${color}`}>
                          {carga === 0 ? "Disponible" : carga <= 2 ? "Ocupado" : "Cargado"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Usuarios ya asignados</h2>

          <div className="mt-4 space-y-4">
            {usuariosAsignados.length === 0 ? (
              <p className="text-slate-600">Aún no hay usuarios asignados.</p>
            ) : (
              usuariosAsignados.map((usuario) => (
                <div
                  key={usuario.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {usuario.nombre || "Sin nombre"}
                        </p>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                          Asignado
                        </span>

                        {usuario.comercial_nombre && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                            {usuario.comercial_nombre}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        {usuario.documento || "Sin documento"} ·{" "}
                        {usuario.telefono || "Sin teléfono"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Gerente: {usuario.gerente_asigno || "No registrado"}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Fecha asignación: {usuario.fecha_hora_asignacion || "No registrada"}
                      </p>
                    </div>

                    <a
                      href={`/usuarios/${usuario.id}`}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center"
                    >
                      Abrir ficha
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}