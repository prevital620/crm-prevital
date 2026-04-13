"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";

type Department = {
  id: string;
  name: string;
};

type Role = {
  id: string;
  name: string;
  code: string;
};

export default function NuevoUsuarioPage() {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    department_id: "",
    role_id: "",
  });

  async function cargarDatos() {
    try {
      setLoadingData(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (auth.roleCode !== "super_user") {
        setAuthorized(false);
        setError("No tienes permiso para crear usuarios.");
        setLoadingData(false);
        return;
      }

      setAuthorized(true);

      const [departmentsResult, rolesResult] = await Promise.all([
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("roles").select("id, name, code").order("name"),
      ]);

      if (departmentsResult.error) {
        setError("No se pudieron cargar los departamentos.");
        setLoadingData(false);
        return;
      }

      if (rolesResult.error) {
        setError("No se pudieron cargar los roles.");
        setLoadingData(false);
        return;
      }

      setDepartments(departmentsResult.data || []);
      setRoles(rolesResult.data || []);
      setLoadingData(false);
    } catch (err: any) {
      setError(err?.message || "No se pudo validar el acceso.");
      setLoadingData(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.full_name.trim()) {
      setError("El nombre completo es obligatorio.");
      return;
    }

    if (!form.email.trim()) {
      setError("El correo es obligatorio.");
      return;
    }

    if (!form.role_id) {
      setError("Debes seleccionar un rol.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "No se pudo crear el usuario.");
        setLoading(false);
        return;
      }

      setMensaje(
        `Usuario creado correctamente. Contraseña temporal: ${result.tempPassword}`
      );

      setForm({
        full_name: "",
        email: "",
        phone: "",
        job_title: "",
        department_id: "",
        role_id: "",
      });
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-[#D6E8DA] bg-white shadow-sm">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-[#7FA287]">Super Usuario</p>
              <h1 className="mt-2 text-3xl font-bold text-[#24312A]">
                Crear usuario
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Crea empleados del CRM, asígnales departamento, cargo y rol. La contraseña inicial será Prevital2026* y deberán cambiarla en el primer ingreso.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-3 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Inicio
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/usuarios"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Usuarios y roles
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
          <form onSubmit={crearUsuario} className="grid gap-4">
            <input
              className={inputClass}
              placeholder="Nombre completo"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
            />

            <input
              className={inputClass}
              placeholder="Correo de acceso"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              className={inputClass}
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <input
              className={inputClass}
              placeholder="Cargo"
              value={form.job_title}
              onChange={(e) =>
                setForm({ ...form, job_title: e.target.value })
              }
            />

            <select
              className={inputClass}
              value={form.department_id}
              onChange={(e) =>
                setForm({ ...form, department_id: e.target.value })
              }
            >
              <option value="">Selecciona un departamento</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>

            <select
              className={inputClass}
              value={form.role_id}
              onChange={(e) => setForm({ ...form, role_id: e.target.value })}
            >
              <option value="">Selecciona un rol</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-[#5F7D66] px-4 py-4 text-sm font-medium text-white transition hover:bg-[#4F6F5B] disabled:opacity-60"
            >
              {loading ? "Creando usuario..." : "Crear usuario"}
            </button>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              El cambio de correo y el borrado real del usuario requieren la lógica segura del backend o API de usuarios. Esta pantalla crea correctamente, pero el correo luego no debe editarse solo desde el cliente.
            </div>

            {mensaje ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
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

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#7FA287]/10";
