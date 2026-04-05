"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

type UserRow = {
  id: string;
  full_name: string;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  created_at: string;
  departments: { name: string }[] | null;
  user_roles: {
    roles: { name: string; code: string }[] | null;
  }[] | null;
};

export default function UsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState(false);

  async function cargarUsuarios() {
    try {
      setLoading(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (auth.roleCode !== "super_user") {
        setAuthorized(false);
        setError("No tienes permiso para entrar a este módulo.");
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          phone,
          job_title,
          is_active,
          created_at,
          departments (
            name
          ),
          user_roles!user_roles_user_id_fkey (
            roles (
              name,
              code
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers((data ?? []) as UserRow[]);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  function formatDate(dateString: string) {
    try {
      return new Date(dateString).toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return dateString;
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Super Usuario
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                Gestión de usuarios
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                Consulta los empleados creados en el CRM, su cargo,
                departamento, rol y estado.
              </p>
            </div>

            <SessionBadge />
          </div>

          {authorized ? (
            <div className="mt-4">
              <a
                href="/usuarios/nuevo"
                className="inline-flex rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white"
              >
                Crear usuario
              </a>
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!authorized ? null : (
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Usuarios registrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lista general de empleados creados en el sistema.
                </p>
              </div>

              <button
                onClick={cargarUsuarios}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Cargando usuarios...
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Aún no hay usuarios registrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-sm text-slate-500">
                      <th className="px-4">Nombre</th>
                      <th className="px-4">Teléfono</th>
                      <th className="px-4">Cargo</th>
                      <th className="px-4">Departamento</th>
                      <th className="px-4">Rol</th>
                      <th className="px-4">Estado</th>
                      <th className="px-4">Creado</th>
                      <th className="px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const firstDepartment = user.departments?.[0];
                      const firstRole = user.user_roles?.[0]?.roles?.[0];

                      return (
                        <tr key={user.id} className="rounded-2xl bg-slate-50">
                          <td className="rounded-l-2xl px-4 py-4 font-semibold text-slate-900">
                            {user.full_name}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {user.phone || "Sin teléfono"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {user.job_title || "Sin cargo"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {firstDepartment?.name || "Sin departamento"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {firstRole?.name || "Sin rol"}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                user.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {user.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-500">
                            {formatDate(user.created_at)}
                          </td>
                          <td className="rounded-r-2xl px-4 py-4">
                            <a
                              href={`/usuarios/${user.id}`}
                              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                            >
                              Editar
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}