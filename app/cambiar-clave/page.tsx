"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CambiarClavePage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function validarSesion() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      setChecking(false);
    }

    validarSesion();
  }, [router]);

  async function guardarNuevaClave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!form.password.trim()) {
      setError("Debes escribir una nueva contraseña.");
      return;
    }

    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("No se encontró el usuario autenticado.");
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: form.password,
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          must_change_password: false,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setMensaje("Contraseña actualizada correctamente.");

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando sesión...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Prevital</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Cambiar contraseña
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <form onSubmit={guardarNuevaClave} className="grid gap-4">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="password"
              placeholder="Nueva contraseña"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar nueva contraseña"}
            </button>

            {mensaje ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
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