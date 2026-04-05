"use client";

import Image from "next/image";
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
    <main className="min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#d7e2da] bg-white/90 p-8 shadow-sm md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,205,189,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(143,191,122,0.14),transparent_26%)]" />

          <div className="relative">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#d7e2da]">
                <Image
                  src="/prevital-logo.jpeg"
                  alt="Prevital"
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7fa287]">
                  Medicina preventiva
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">
                  CRM Prevital
                </h1>
              </div>
            </div>

            <div className="max-w-xl">
              <p className="text-base leading-7 text-slate-600 md:text-lg">
                Plataforma interna para gestionar usuarios, leads, recepción,
                seguimiento comercial y control operativo de Prevital.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoCard title="Leads" subtitle="Captación y seguimiento" />
              <InfoCard title="Recepción" subtitle="Agenda y admisión" />
              <InfoCard title="Comercial" subtitle="Cierre y control" />
            </div>

            <div className="mt-8 rounded-3xl border border-[#d7e2da] bg-white/80 p-5">
              <p className="text-sm font-semibold text-slate-800">
                Acceso seguro para personal autorizado
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ingresa con tu usuario institucional. Si es tu primer acceso,
                el sistema puede pedirte cambio de contraseña antes de entrar.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#d7e2da] bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <p className="text-sm font-medium text-[#7fa287]">Bienvenido</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Iniciar sesión
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ingresa con tu usuario de acceso y contraseña para entrar al CRM.
            </p>
          </div>

          <form onSubmit={handleLogin} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                Usuario de acceso
              </span>
              <input
                className="rounded-2xl border border-slate-300 bg-white px-4 py-4 outline-none transition focus:border-[#7fa287]"
                type="email"
                placeholder="correo@prevital.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="username"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                Contraseña
              </span>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 pr-20 outline-none transition focus:border-[#7fa287]"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-2xl bg-[#5f7d66] px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </form>

          <div className="mt-6 rounded-2xl bg-[#f3f7f4] p-4">
            <p className="text-xs leading-5 text-slate-600">
              Sistema interno de uso exclusivo para personal autorizado de
              Prevital.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-[#d7e2da] bg-white/80 p-4">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}