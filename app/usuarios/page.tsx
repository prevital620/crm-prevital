"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";

type UserRow = {
  id: string;
  full_name: string;
  employee_code: string | null;
  commission_group_code: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
  auth_exists: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  departments: { name: string }[] | null;
  user_roles: {
    roles: { name: string; code: string }[] | null;
  }[] | null;
};

type CommissionGroupOption = {
  code: string;
};

type UserListViewer = {
  is_super_user: boolean;
  role_codes: string[];
  commission_group_code: string | null;
};

function getUserRoles(user: UserRow) {
  return (user.user_roles || [])
    .flatMap((item) => item.roles || [])
    .filter(Boolean);
}

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 p-4 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

export default function UsuariosPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [groupFilter, setGroupFilter] = useState("todos");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [commissionGroups, setCommissionGroups] = useState<CommissionGroupOption[]>([]);
  const [newCommissionGroupCode, setNewCommissionGroupCode] = useState("");
  const [savingCommissionGroup, setSavingCommissionGroup] = useState(false);
  const [viewer, setViewer] = useState<UserListViewer | null>(null);

  async function cargarUsuarios() {
    try {
      setLoading(true);
      setError("");

      const auth = await getCurrentUserRole();
      const allowedRoleCodes = [
        "super_user",
        "supervisor_opc",
        "supervisor_call_center",
      ];

      if (!auth.roleCode || !allowedRoleCodes.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a este módulo.");
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const usersResponse = await fetch("/api/usuarios");
      const result = await usersResponse.json();

      if (!usersResponse.ok) {
        throw new Error(result.error || "No se pudieron cargar los usuarios.");
      }

      const resultViewer = (result.viewer ?? null) as UserListViewer | null;
      setViewer(
        resultViewer ?? {
          is_super_user: auth.roleCode === "super_user",
          role_codes: auth.roleCode ? [auth.roleCode] : [],
          commission_group_code: null,
        }
      );

      if (resultViewer?.is_super_user || auth.roleCode === "super_user") {
        const groupsResponse = await fetch("/api/commission-groups");
        const groupsResult = await groupsResponse.json();

        if (!groupsResponse.ok) {
          throw new Error(groupsResult.error || "No se pudieron cargar los grupos de comision.");
        }

        setCommissionGroups(
          (((groupsResult.groups ?? []) as CommissionGroupOption[]) || []).sort((a, b) =>
            a.code.localeCompare(b.code, "es")
          )
        );
      } else {
        setCommissionGroups([]);
      }

      setUsers(((result.users ?? []) as unknown) as UserRow[]);
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function crearGrupoComision() {
    const code = newCommissionGroupCode.trim().toUpperCase();

    if (!code) {
      setError("Escribe el codigo del grupo que quieres crear. Ej: CB.");
      setMensaje("");
      return;
    }

    try {
      setSavingCommissionGroup(true);
      setError("");
      setMensaje("");

      const response = await fetch("/api/commission-groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo crear el grupo.");
      }

      setCommissionGroups((current) => {
        const next = [...current];
        if (!next.some((item) => item.code === result.code)) {
          next.push({ code: result.code });
        }
        return next.sort((a, b) => a.code.localeCompare(b.code, "es"));
      });
      setNewCommissionGroupCode("");
      setMensaje(`Grupo ${result.code} guardado correctamente.`);
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el grupo.");
      setMensaje("");
    } finally {
      setSavingCommissionGroup(false);
    }
  }

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
    if (!user.auth_exists) {
      setError(
        `El usuario ${user.full_name} no existe en autenticación. Debes recrearlo o revisar su correo antes de restablecer la contraseña.`
      );
      setMensaje("");
      return;
    }

    if (!user.email) {
      setError(
        `No hay un correo de acceso visible para ${user.full_name}. Revisa el correo del usuario antes de restablecer la contraseña.`
      );
      setMensaje("");
      return;
    }

    const confirmado = window.confirm(
      `¿Restablecer la contraseña de ${user.full_name} a Prevital2026*?

Correo de acceso: ${user.email}`
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

      const loginEmail = result.email || user.email;

      setMensaje(
        `Contraseña restablecida correctamente a Prevital2026*. ${user.full_name} debe ingresar con ${loginEmail} y cambiarla en el próximo ingreso.`
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

    return users.filter((user) => {
      const department = user.departments?.[0]?.name || "";
      const roles = getUserRoles(user);
      const roleNames = roles
        .map((role) => role.name || "")
        .filter(Boolean)
        .join(" ");
      const roleCodes = roles
        .map((role) => role.code || "")
        .filter(Boolean)
      const roleCodesText = roleCodes.join(" ");
      const groupCode = (user.commission_group_code || "").trim().toUpperCase();
      const matchesRole = roleFilter === "todos" || roleCodes.includes(roleFilter);
      const matchesGroup =
        groupFilter === "todos" ||
        (groupFilter === "sin_grupo" ? !groupCode : groupCode === groupFilter);
      const matchesSearch =
        !q ||
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.employee_code || "").toLowerCase().includes(q) ||
        groupCode.toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        (user.phone || "").toLowerCase().includes(q) ||
        (user.job_title || "").toLowerCase().includes(q) ||
        department.toLowerCase().includes(q) ||
        roleNames.toLowerCase().includes(q) ||
        roleCodesText.toLowerCase().includes(q);

      return matchesRole && matchesGroup && matchesSearch;
    });
  }, [users, search, roleFilter, groupFilter]);

  const roleOptions = useMemo(() => {
    const map = new Map<string, string>();

    users.forEach((user) => {
      getUserRoles(user).forEach((role) => {
        if (!role.code) return;
        if (!map.has(role.code)) {
          map.set(role.code, role.name || role.code);
        }
      });
    });

    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [users]);

  const groupOptions = useMemo(() => {
    const codes = new Set<string>();

    commissionGroups.forEach((group) => {
      if (group.code) codes.add(group.code.trim().toUpperCase());
    });

    users.forEach((user) => {
      const code = user.commission_group_code?.trim().toUpperCase();
      if (code) codes.add(code);
    });

    return Array.from(codes).sort((a, b) => a.localeCompare(b, "es"));
  }, [commissionGroups, users]);

  const resumen = useMemo(() => {
    return {
      total: users.length,
      activos: users.filter((item) => item.is_active).length,
      inactivos: users.filter((item) => !item.is_active).length,
    };
  }, [users]);

  const canManageAllUsers = Boolean(viewer?.is_super_user);
  const isSupervisorView = authorized && !canManageAllUsers;
  const viewerGroupCode = viewer?.commission_group_code || null;
  const pageBadge = canManageAllUsers ? "Super Usuario" : "Supervisor";
  const pageDescription = canManageAllUsers
    ? "Consulta empleados creados en el CRM, editarlos, desactivarlos o eliminarlos cuando sea necesario."
    : `Consulta el personal de tu grupo${
        viewerGroupCode ? ` ${viewerGroupCode}` : ""
      } y habilita o inhabilita su acceso cuando sea necesario.`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#BFE7D7]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
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
            <div className="relative h-14 w-14 overflow-hidden rounded-[20px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_#FFFFFF_0%,_#F0FBF5_60%,_#E2F4EA_100%)] shadow-[0_14px_30px_rgba(95,125,102,0.18)]">
            <Image
              src="/prevital-logo.jpeg"
              alt="Prevital"
              fill
              className="object-contain p-1"
              priority
            />
          </div>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">{pageBadge}</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">
                Usuarios y roles
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                {pageDescription}
              </p>
              <p className="hidden">
                Consulta empleados creados en el CRM, edítalos, desactívalos o elimínalos cuando sea necesario.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/crm"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </Link>

            {authorized && canManageAllUsers ? (
              <Link
                href="/usuarios/nuevo"
                className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
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

        {authorized && canManageAllUsers ? (
          <section className={panelClass}>
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">
                  Grupos de comision
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Aqui los creas tu misma: `CB`, `AV`, `BG`, etc. Despues los
                  escoges en los usuarios `OPC`, `TMK`, `Confirmador` y
                  supervisores.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(180deg,_rgba(247,252,248,0.98)_0%,_rgba(238,248,242,0.98)_100%)] p-4 text-sm text-[#496356] shadow-inner">
              1. Escribe un grupo de 2 letras, por ejemplo `CB`.
              <br />
              2. Pulsa `Crear grupo`.
              <br />
              3. Luego ve a crear o editar el usuario y escoge ese grupo en
              `Grupo de comision`.
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_auto]">
              <input
                className={inputClass}
                placeholder="Grupo de 2 letras. Ej: CB"
                maxLength={2}
                value={newCommissionGroupCode}
                onChange={(e) => setNewCommissionGroupCode(e.target.value.toUpperCase())}
              />

              <button
                type="button"
                onClick={() => void crearGrupoComision()}
                disabled={savingCommissionGroup}
                className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60 md:justify-self-start"
              >
                {savingCommissionGroup ? "Guardando..." : "Crear grupo"}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {commissionGroups.length === 0 ? (
                <span className="text-sm text-slate-500">Aun no hay grupos creados.</span>
              ) : (
                commissionGroups.map((group) => (
                  <span
                    key={group.code}
                    className="inline-flex rounded-full border border-[#D7EADF] bg-white px-3 py-1 text-sm font-semibold text-[#365243]"
                  >
                    {group.code}
                  </span>
                ))
              )}
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        {mensaje ? (
          <div className="rounded-[26px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(245,252,247,0.98)_0%,_rgba(237,248,241,0.98)_100%)] p-4 text-sm text-[#4F6F5B] shadow-[0_16px_32px_rgba(95,125,102,0.08)]">
            {mensaje}
          </div>
        ) : null}

        {!authorized ? null : (
          <section className={panelClass}>
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#24312A]">
                  Usuarios registrados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isSupervisorView
                    ? "Solo aparecen usuarios activos e inactivos del personal que puedes administrar en tu grupo."
                    : "Lista general de empleados creados en el sistema."}
                </p>
              </div>

              <div className="grid w-full gap-3 lg:w-auto lg:grid-cols-[220px_200px_280px_auto_auto]">
                <select
                  className={inputClass}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="todos">Todos los roles</option>
                  {roleOptions.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClass}
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  disabled={isSupervisorView}
                >
                  <option value="todos">
                    {isSupervisorView && viewerGroupCode
                      ? `Grupo ${viewerGroupCode}`
                      : "Todos los grupos"}
                  </option>
                  <option value="sin_grupo">Sin grupo</option>
                  {groupOptions.map((code) => (
                    <option key={code} value={code}>
                      Grupo {code}
                    </option>
                  ))}
                </select>

                <input
                  className={inputClass}
                  placeholder="Buscar por nombre, cargo, teléfono o rol"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter("todos");
                    setGroupFilter("todos");
                    setSearch("");
                  }}
                  className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Limpiar
                </button>

                <button
                  onClick={cargarUsuarios}
                  className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {!loading ? (
              <p className="mb-4 text-sm text-[#607368]">
                Mostrando {filteredUsers.length} de {users.length} usuarios.
              </p>
            ) : null}

            {loading ? (
              <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                Cargando usuarios...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
                No hay usuarios que coincidan con los filtros.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => {
                  const firstDepartment = user.departments?.[0];
                  const roles = getUserRoles(user);
                  const roleNames = roles
                    .map((role) => role.name || "")
                    .filter(Boolean);
                  const roleCodes = roles
                    .map((role) => role.code || "")
                    .filter(Boolean);

                  return (
                    <div
                      key={user.id}
                    className="group rounded-[30px] border border-[#D6E8DA] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(246,252,248,0.94)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.1)] transition duration-200 hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-[#24312A]">
                              {user.full_name}
                            </h3>

                            {user.employee_code ? (
                              <span className="inline-flex rounded-full border border-[#CFE4D8] bg-[#F4FBF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
                                {user.employee_code}
                              </span>
                            ) : null}

                            {user.commission_group_code ? (
                              <span className="inline-flex rounded-full border border-[#D7EADF] bg-white px-3 py-1 text-xs font-semibold text-[#365243]">
                                Grupo {user.commission_group_code}
                              </span>
                            ) : null}

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
                            <InfoItem label="Correo" value={user.email || "Sin correo de acceso"} />
                            <InfoItem label="Acceso auth" value={user.auth_exists ? "Activo en autenticación" : "No existe en autenticación"} />
                            <InfoItem label="Teléfono" value={user.phone || "Sin teléfono"} />
                            <InfoItem label="Cargo" value={user.job_title || "Sin cargo"} />
                            <InfoItem
                              label="Departamento"
                              value={firstDepartment?.name || "Sin departamento"}
                            />
                            <InfoItem label="Rol" value={roleNames.length > 0 ? roleNames.join(" · ") : "Sin rol"} />
                            <InfoItem label="Código rol" value={roleCodes.length > 0 ? roleCodes.join(" · ") : "Sin código"} />
                            <InfoItem label="Creado" value={formatDate(user.created_at)} />
                            <InfoItem label="Último ingreso" value={user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Sin registro"} />
                          </div>
                        </div>

                        <div className="w-full rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner lg:w-[360px]">
                          <p className="mb-3 text-sm font-medium text-[#32453A]">Acciones</p>

                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/usuarios/${user.id}`}
                              className={`${canManageAllUsers ? "" : "hidden"} rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(95,125,102,0.18)] transition hover:-translate-y-0.5 hover:brightness-105`}
                            >
                              Editar
                            </Link>

                            <button
                              type="button"
                              onClick={() => void restablecerContrasena(user)}
                              disabled={savingUserId === user.id}
                              className={`${canManageAllUsers ? "" : "hidden"} rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60`}
                            >
                              {savingUserId === user.id ? "Procesando..." : "Restablecer contraseña"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleEstadoUsuario(user, !user.is_active)}
                              disabled={savingUserId === user.id}
                              className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:opacity-60"
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
                              className={`${canManageAllUsers ? "" : "hidden"} rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60`}
                            >
                              {savingUserId === user.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>

                          <p className="mt-3 text-xs text-[#607368]">
                            {canManageAllUsers
                              ? "Puedes editar, restablecer la contraseÃ±a temporal, desactivar o eliminar el acceso por backend."
                              : "Como supervisor, solo puedes habilitar o inhabilitar el acceso de personal de tu grupo."}
                          </p>
                          <p className="hidden">
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
    <div className="group overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)] transition duration-200 hover:-translate-y-1 hover:border-[#9BC4AF] hover:shadow-[0_22px_48px_rgba(95,125,102,0.16)]">
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
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
