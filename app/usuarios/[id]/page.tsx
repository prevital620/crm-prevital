"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

type UserData = {
  id: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
};

export default function EditarUsuarioPage() {
  const params = useParams();
  const userId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    job_title: "",
    department_id: "",
    role_id: "",
    is_active: true,
  });

  async function cargarUsuario() {
    if (!userId) return;

    try {
      setLoading(true);
      setError("");
      setMensaje("");

      const auth = await getCurrentUserRole();

      if (auth.roleCode !== "super_user") {
        setAuthorized(false);
        setError("No tienes permiso para editar usuarios.");
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [
        userResult,
        departmentsResult,
        rolesResult,
        userRoleResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, job_title, department_id, is_active, created_at")
          .eq("id", userId)
          .single(),

        supabase
          .from("departments")
          .select("id, name")
          .order("name", { ascending: true }),

        supabase
          .from("roles")
          .select("id, name, code")
          .order("name", { ascending: true }),

        supabase
          .from("user_roles")
          .select("role_id")
          .eq("user_id", userId)
          .limit(1),
      ]);

      if (userResult.error) throw userResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (userRoleResult.error) throw userRoleResult.error;

      const user = userResult.data as UserData;
      const currentRoleId = userRoleResult.data?.[0]?.role_id || "";

      setDepartments((departmentsResult.data as Department[]) || []);
      setRoles((rolesResult.data as Role[]) || []);

      setForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        job_title: user.job_title || "",
        department_id: user.department_id || "",
        role_id: currentRoleId,
        is_active: user.is_active,
      });
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuario();
  }, [userId]);

  async function guardarCambios(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      setError("No se encontró el ID del usuario.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          job_title: form.job_title.trim() || null,
          department_id: form.department_id || null,
          is_active: form.is_active,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      const { error: deleteRoleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteRoleError) throw deleteRoleError;

      if (form.role_id) {
        const { error: insertRoleError } = await supabase
          .from("user_roles")
          .insert([
            {
              user_id: userId,
              role_id: form.role_id,
            },
          ]);

        if (insertRoleError) throw insertRoleError;
      }

      setMensaje("Usuario actualizado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Super Usuario
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Editar usuario
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Actualiza los datos básicos, departamento, rol y estado del empleado.
              </p>
            </div>

            <a
              href="/usuarios"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Volver
            </a>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <form onSubmit={guardarCambios} className="grid gap-4">
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

            <label className="flex items-center gap-3 rounded-2xl border border-slate-300 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              Usuario activo
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Guardando cambios..." : "Guardar cambios"}
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