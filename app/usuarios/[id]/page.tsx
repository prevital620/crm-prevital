"use client";

import Image from "next/image";
import Link from "next/link";
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

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

export default function EditarUsuarioPage() {
  const params = useParams();
  const userId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    job_title: "",
    department_id: "",
    is_active: true,
  });
  const [email, setEmail] = useState("");

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

      const [userResult, departmentsResult, rolesResult, userRoleResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, job_title, department_id, is_active, created_at")
          .eq("id", userId)
          .single(),
        supabase.from("departments").select("id, name").order("name", { ascending: true }),
        supabase.from("roles").select("id, name, code").order("name", { ascending: true }),
        supabase.from("user_roles").select("role_id").eq("user_id", userId),
      ]);

      if (userResult.error) throw userResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (userRoleResult.error) throw userRoleResult.error;

      const user = userResult.data as UserData;
      const currentRoleIds =
        ((userRoleResult.data as Array<{ role_id: string }> | null) || [])
          .map((item) => item.role_id)
          .filter(Boolean);

      setDepartments((departmentsResult.data as Department[]) || []);
      setRoles((rolesResult.data as Role[]) || []);
      setSelectedRoleIds(currentRoleIds);
      setForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        job_title: user.job_title || "",
        department_id: user.department_id || "",
        is_active: user.is_active,
      });
      setEmail("");
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
      const response = await fetch(`/api/usuarios/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          job_title: form.job_title.trim() || null,
          department_id: form.department_id || null,
          is_active: form.is_active,
          role_ids: selectedRoleIds,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo actualizar el usuario.");
      }

      setMensaje("Usuario actualizado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarCorreo() {
    if (!userId) {
      setError("No se encontró el ID del usuario.");
      return;
    }

    if (!email.trim()) {
      setError("Debes escribir el nuevo correo.");
      return;
    }

    setSavingEmail(true);
    setError("");
    setMensaje("");

    try {
      const response = await fetch(`/api/usuarios/${userId}/email`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo actualizar el correo.");
      }

      setMensaje("Correo actualizado correctamente.");
      setEmail("");
    } catch (err: any) {
      setError(err?.message || "No se pudo cambiar el correo.");
    } finally {
      setSavingEmail(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className={`mx-auto max-w-3xl ${panelClass}`}>
          <p className="text-sm font-medium text-[#607368]">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(150,102,95,0.12)]">
          <p className="text-sm font-medium text-[#9A4E43]">
            {error || "No tienes permiso para entrar a este módulo."}
          </p>
        </div>
      </main>
    );
  }

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

      <div className="mx-auto max-w-3xl space-y-6">
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
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">Super Usuario</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">Editar usuario</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Actualiza datos básicos, departamento, roles múltiples y estado del empleado.
              </p>
            </div>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Inicio
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/usuarios"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Volver a usuarios
            </Link>
          </div>
        </section>

        <section className={panelClass}>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-[#24312A]">Cambiar correo de acceso</h2>
            <p className="mt-1 text-sm text-[#607368]">
              Este cambio usa una ruta segura del backend. Debes crear también la API correspondiente.
            </p>
          </div>

          <div className="grid gap-4">
            <input
              className={inputClass}
              type="email"
              placeholder="nuevo.correo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              type="button"
              onClick={cambiarCorreo}
              disabled={savingEmail}
              className="rounded-2xl border border-[#CFE4D8] bg-white/90 px-4 py-4 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:opacity-60"
            >
              {savingEmail ? "Actualizando correo..." : "Actualizar correo"}
            </button>

            <div className="rounded-[26px] border border-[#F0D7A1] bg-[linear-gradient(180deg,_rgba(255,251,242,0.98)_0%,_rgba(255,246,224,0.98)_100%)] p-4 text-sm text-[#9A6A17] shadow-[0_16px_32px_rgba(154,106,23,0.08)]">
              Si la ruta del backend todavía no existe, este botón no podrá cambiar el correo. Primero va este archivo y luego te paso la API.
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <form onSubmit={guardarCambios} className="grid gap-4">
            <input
              className={inputClass}
              placeholder="Nombre completo"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
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
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
            />

            <select
              className={inputClass}
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
            >
              <option value="">Selecciona un departamento</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>

            <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4">
              <p className="mb-3 text-sm font-medium text-[#24312A]">
                Roles y accesos permitidos
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {roles.map((role) => {
                  const checked = selectedRoleIds.includes(role.id);

                  return (
                    <label
                      key={role.id}
                      className="flex items-start gap-3 rounded-[24px] border border-[#D6E8DA] bg-white/92 p-4 text-sm text-[#607368] shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedRoleIds((prev) => {
                            if (isChecked) {
                              return Array.from(new Set([...prev, role.id]));
                            }
                            return prev.filter((item) => item !== role.id);
                          });
                        }}
                      />
                      <span>
                        <span className="block font-medium text-[#24312A]">{role.name}</span>
                        <span className="text-xs text-[#607368]">{role.code}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="mt-3 text-xs text-[#607368]">
                Puedes aprobar varios accesos al mismo usuario, por ejemplo Comercial y Fisioterapia.
              </p>
            </div>

            <label className="flex items-center gap-3 rounded-[24px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 text-sm text-[#32453A] shadow-inner">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Usuario activo
            </label>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-4 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
            >
              {saving ? "Guardando cambios..." : "Guardar cambios"}
            </button>

            {mensaje ? (
              <div className="rounded-[26px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(245,252,247,0.98)_0%,_rgba(237,248,241,0.98)_100%)] p-4 text-sm text-[#4F6F5B] shadow-[0_16px_32px_rgba(95,125,102,0.08)]">
                {mensaje}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
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
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-4 text-base text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";
