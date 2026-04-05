"use client";

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
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Super Usuario</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Crear usuario
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Crea empleados del CRM, asígnales departamento, cargo y rol. El
            sistema les generará una contraseña temporal.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <form onSubmit={crearUsuario} className="grid gap-4">
            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Nombre completo"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Correo de acceso"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <input
              className="rounded-2xl border border-slate-300 p-4 outline-none"
              placeholder="Cargo"
              value={form.job_title}
              onChange={(e) =>
                setForm({ ...form, job_title: e.target.value })
              }
            />

            <select
              className="rounded-2xl border border-slate-300 p-4 outline-none"
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
              className="rounded-2xl border border-slate-300 p-4 outline-none"
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
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? "Creando usuario..." : "Crear usuario"}
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