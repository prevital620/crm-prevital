"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "prevital_last_user";

export default function LoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    async function checkSession() {
      const savedUser =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY) || ""
          : "";

      if (savedUser) {
        setForm((prev) => ({
          ...prev,
          email: savedUser,
        }));
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setCheckingSession(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", session.user.id)
        .single();

      if (profile?.must_change_password) {
        router.push("/cambiar-clave");
        return;
      }

      router.push("/");
    }

    checkSession();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = form.email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: form.password,
      });

      if (error) throw error;

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, normalizedEmail);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("No se pudo obtener el usuario autenticado.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile?.must_change_password) {
        router.push("/cambiar-clave");
      } else {
        router.push("/");
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
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
            Iniciar sesión
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Ingresa con tu usuario de acceso y contraseña para entrar al CRM.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <form onSubmit={handleLogin} className="grid gap-4">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              type="email"
              placeholder="Usuario de acceso"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              autoComplete="username"
            />

            <div className="relative">
              <input
                className="w-full rounded-2xl border border-slate-300 p-4 pr-16 outline-none"
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
              >
                {showPassword ? "Ocultar" : "Ver"}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

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