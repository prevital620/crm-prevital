"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [mensaje, setMensaje] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

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

      setUsers(((data ?? []) as unknown) as UserRow[]);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function toggleEstadoUsuario(user: UserRow, nextActive: boolean) {
    try {
      setSavingUserId(user.id);
      setError("");
      setMensaje("");

      const response = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: nextActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "No se pudo actualizar el estado del usuario."
        );
      }

      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, is_active: nextActive } : item
        )
      );

      setMensaje(
        nextActive
          ? "Usuario reactivado correctamente."
          : "Usuario desactivado correctamente."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el estado del usuario.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function eliminarUsuario(user: UserRow) {
    const confirmado = window.confirm(
      `¿Seguro que quieres eliminar a ${user.full_name}? Esta acción borrará el acceso del usuario.`
    );

    if (!confirmado) return;

    try {
      setSavingUserId(user.id);
      setError("");
      setMensaje("");

      const response = await fetch(`/api/usuarios/${user.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo eliminar el usuario.");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setMensaje("Usuario eliminado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo eliminar el usuario.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function restablecerContrasena(user: UserRow) {
    const confirmado = window.confirm(
      `¿Restablecer la contraseña de ${user.full_name} a Prevital2026*?`
    );

    if (!confirmado) return;

    try {
      setSavingUserId(user.id);
      setError("");
      setMensaje("");

      const response = await fetch(`/api/usuarios/${user.id}/reset-password`, {
        method: "PATCH",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo restablecer la contraseña.");
      }

      setMensaje(
        "Contraseña restablecida correctamente a Prevital2026*. El usuario deberá cambiarla en el próximo ingreso."
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo restablecer la contraseña.");
    } finally {
      setSavingUserId(null);
    }
  }

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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) => {
      const department = user.departments?.[0]?.name || "";
      const roleNames = (user.user_roles || [])
        .flatMap((item) => item.roles || [])
        .map((role) => role.name || "")
        .filter(Boolean)
        .join(" ");
      const roleCodes = (user.user_roles || [])
        .flatMap((item) => item.roles || [])
        .map((role) => role.code || "")
        .filter(Boolean)
        .join(" ");

      return (
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.phone || "").toLowerCase().includes(q) ||
        (user.job_title || "").toLowerCase().includes(q) ||
        department.toLowerCase().includes(q) ||
        roleNames.toLowerCase().includes(q) ||
        roleCodes.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const resumen = useMemo(() => {
    return {
      total: users.length,
      activos: users.filter((item) => item.is_active).length,
      inactivos: users.filter((item) => !item.is_active).length,
    };
  }, [users]);

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

      <div className="mx-auto max-w-7xl space-y-6">
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
                Usuarios y roles
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Consulta empleados creados en el CRM, edítalos, desactívalos o elimínalos cuando sea necesario.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
            >
              Inicio
            </Link>

            {authorized ? (
              <Link
                href="/usuarios/nuevo"
                className="inline-flex items-center justify-center rounded-2xl bg-[#5F7D66] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
              >
                Crear usuario
              </Link>
            ) : null}
          </div>
        </section>

        {authorized ? (
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard title="Usuarios" value={String(resumen.total)} />
            <StatCard title="Activos" value={String(resumen.activos)} />
            <StatCard title="Inactivos" value={String(resumen.inactivos)} />
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {mensaje}
          </div>
        ) : null}

        {!authorized ? null : (
          <section className="rounded-3xl border border-[#D6E8DA] bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">
                  Usuarios registrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lista general de empleados creados en el sistema.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
                <input
                  className="w-full rounded-2xl border border-[#D6E8DA] p-4 outline-none transition focus:border-[#7FA287] md:min-w-[280px]"
                  placeholder="Buscar por nombre, cargo, teléfono o rol"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button
                  onClick={cargarUsuarios}
                  className="rounded-xl border border-[#D6E8DA] px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6]"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D6E8DA] bg-[#F8F7F4] p-6 text-sm text-slate-500">
                No hay usuarios que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => {
                  const firstDepartment = user.departments?.[0];
                  const roleNames = (user.user_roles || [])
                    .flatMap((item) => item.roles || [])
                    .map((role) => role.name || "")
                    .filter(Boolean);
                  const roleCodes = (user.user_roles || [])
                    .flatMap((item) => item.roles || [])
                    .map((role) => role.code || "")
                    .filter(Boolean);

                  return (
                    <div
                      key={user.id}
                      className="group rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#BCD7C2] hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-[#24312A]">
                              {user.full_name}
                            </h3>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                user.is_active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700"
                              }`}
                            >
                              {user.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                            <InfoItem label="Teléfono" value={user.phone || "Sin teléfono"} />
                            <InfoItem label="Cargo" value={user.job_title || "Sin cargo"} />
                            <InfoItem
                              label="Departamento"
                              value={firstDepartment?.name || "Sin departamento"}
                            />
                            <InfoItem label="Rol" value={roleNames.length > 0 ? roleNames.join(" · ") : "Sin rol"} />
                            <InfoItem label="Código rol" value={roleCodes.length > 0 ? roleCodes.join(" · ") : "Sin código"} />
                            <InfoItem label="Creado" value={formatDate(user.created_at)} />
                          </div>
                        </div>

                        <div className="w-full rounded-2xl border border-[#E3ECE5] bg-[#F8F7F4] p-4 lg:w-[360px]">
                          <p className="mb-3 text-sm font-medium text-slate-700">Acciones</p>

                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/usuarios/${user.id}`}
                              className="rounded-2xl bg-[#5F7D66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4F6F5B]"
                            >
                              Editar
                            </Link>

                            <button
                              type="button"
                              onClick={() => void restablecerContrasena(user)}
                              disabled={savingUserId === user.id}
                              className="rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                            >
                              {savingUserId === user.id ? "Procesando..." : "Restablecer contraseña"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleEstadoUsuario(user, !user.is_active)}
                              disabled={savingUserId === user.id}
                              className="rounded-2xl border border-[#D6E8DA] bg-white px-4 py-2 text-sm font-medium text-[#4F6F5B] transition hover:bg-[#F4FAF6] disabled:opacity-60"
                            >
                              {savingUserId === user.id
                                ? "Guardando..."
                                : user.is_active
                                ? "Desactivar"
                                : "Reactivar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void eliminarUsuario(user)}
                              disabled={savingUserId === user.id}
                              className="rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                            >
                              {savingUserId === user.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>

                          <p className="mt-3 text-xs text-slate-500">
                            Puedes editar, restablecer la contraseña temporal, desactivar o eliminar el acceso por backend.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-[#D6E8DA] bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#BCD7C2] hover:shadow-md">
      <div className="mb-3 h-1 w-full rounded-full bg-gradient-to-r from-[#A8CDBD] via-[#7FA287] to-[#5F7D66]" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[#24312A]">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-[#24312A]">{label}:</span> {value}
    </p>
  );
}
