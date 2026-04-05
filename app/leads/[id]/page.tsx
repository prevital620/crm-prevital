"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";

type LeadData = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  age: number | null;
  marital_status: string | null;
  has_eps: boolean | null;
  affiliation_type: string | null;
  capture_location: string | null;
  interest_service: string | null;
  source: string | null;
  observations: string | null;
  city: string | null;
  status: string;
  created_at: string;
  created_by_user_id: string;
  assigned_to_user_id: string | null;
};

const maritalStatusOptions = [
  { value: "soltero", label: "Soltero(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "union_libre", label: "Unión libre" },
  { value: "separado", label: "Separado(a)" },
  { value: "viudo", label: "Viudo(a)" },
];

const interestServiceOptions = [
  { value: "detox", label: "Detox" },
  { value: "sueroterapia", label: "Sueroterapia" },
  { value: "valoracion", label: "Valoración" },
  { value: "nutricion", label: "Nutrición" },
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "medicina_general", label: "Medicina general" },
  { value: "otro", label: "Otro" },
];

const sourceOptions = [
  { value: "opc", label: "OPC" },
  { value: "redes_sociales", label: "Redes sociales" },
  { value: "referido", label: "Referido" },
  { value: "punto_fisico", label: "Punto físico" },
  { value: "otro", label: "Otro" },
];

const allowedRoles = [
  "super_user",
  "promotor_opc",
  "supervisor_opc",
  "supervisor_call_center",
  "confirmador",
  "tmk",
];

const opcVisibleStatuses = [
  "nuevo",
  "pendiente_contacto",
  "contactado",
  "agendado",
];

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

function Field({
  label,
  required = false,
  input,
}: {
  label: string;
  required?: boolean;
  input: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {input}
    </label>
  );
}

export default function EditarLeadPage() {
  const params = useParams();
  const leadId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [saving, setSaving] = useState(false);

  const [authorized, setAuthorized] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    age: "",
    marital_status: "",
    has_eps: "",
    affiliation_type: "",
    capture_location: "",
    interest_service: "",
    source: "",
    observations: "",
    city: "",
    status: "nuevo",
  });

  async function validarAccesoYLead() {
    if (!leadId) return;

    try {
      setLoadingAuth(true);
      setError("");
      setMensaje("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a este lead.");
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          age,
          marital_status,
          has_eps,
          affiliation_type,
          capture_location,
          interest_service,
          source,
          observations,
          city,
          status,
          created_at,
          created_by_user_id,
          assigned_to_user_id
        `)
        .eq("id", leadId)
        .single();

      if (error) throw error;

      const lead = data as LeadData;

      const created = new Date(lead.created_at);
      const now = new Date();

      const isToday =
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate();

      let allowedView = false;
      let allowedEdit = false;

      if (auth.roleCode === "super_user") {
        allowedView = true;
        allowedEdit = true;
      }

      if (auth.roleCode === "promotor_opc") {
        const isOwner = lead.created_by_user_id === auth.user.id;
        const isOpcVisibleStatus = opcVisibleStatuses.includes(lead.status);

        allowedView = isOwner && isOpcVisibleStatus;
        allowedEdit = isOwner && isToday && isOpcVisibleStatus;
      }

      if (auth.roleCode === "supervisor_opc") {
        const isOpcVisibleStatus = opcVisibleStatuses.includes(lead.status);

        allowedView = isOpcVisibleStatus;
        allowedEdit = isToday && isOpcVisibleStatus;
      }

      if (auth.roleCode === "supervisor_call_center") {
        allowedView = true;
        allowedEdit = true;
      }

      if (auth.roleCode === "confirmador" || auth.roleCode === "tmk") {
        const isAssignedToUser = lead.assigned_to_user_id === auth.user.id;
        const isCreatedByUser = lead.created_by_user_id === auth.user.id;

        allowedView = isAssignedToUser || isCreatedByUser;
        allowedEdit = isAssignedToUser || isCreatedByUser;
      }

      if (!allowedView) {
        setAuthorized(false);
        setError("No tienes permiso para ver este lead.");
        return;
      }

      setAuthorized(true);
      setCanEdit(allowedEdit);
      setCreatedAt(lead.created_at);

      setForm({
        first_name: lead.first_name || "",
        last_name: lead.last_name || "",
        phone: lead.phone || "",
        age: lead.age ? String(lead.age) : "",
        marital_status: lead.marital_status || "",
        has_eps: lead.has_eps === null ? "" : lead.has_eps ? "si" : "no",
        affiliation_type: lead.affiliation_type || "",
        capture_location: lead.capture_location || "",
        interest_service: lead.interest_service || "",
        source: lead.source || "",
        observations: lead.observations || "",
        city: lead.city || "",
        status: lead.status || "nuevo",
      });
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo cargar el lead.");
    } finally {
      setLoadingAuth(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    validarAccesoYLead();
  }, [leadId]);

  async function guardarCambios(e: React.FormEvent) {
    e.preventDefault();

    if (!leadId) {
      setError("No se encontró el ID del lead.");
      return;
    }

    if (!canEdit) {
      setError("No tienes permiso para editar este lead.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim(),
          age: form.age ? Number(form.age) : null,
          marital_status: form.marital_status || null,
          has_eps:
            form.has_eps === ""
              ? null
              : form.has_eps === "si"
              ? true
              : false,
          affiliation_type: form.affiliation_type || null,
          capture_location: form.capture_location.trim() || null,
          interest_service: form.interest_service || null,
          source: form.source || null,
          observations: form.observations.trim() || null,
          city: form.city.trim() || null,
          status: form.status || "nuevo",
        })
        .eq("id", leadId);

      if (error) throw error;

      setMensaje("Lead actualizado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar el lead.");
    } finally {
      setSaving(false);
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

  if (loadingAuth || loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando lead...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 md:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            {error || "No tienes permiso para entrar a este lead."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-4xl px-4 pt-4 sm:px-6 sm:pt-6">
        <section className="mb-4 rounded-3xl bg-white p-5 shadow-sm sm:mb-6 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leads
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Editar lead
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Este acceso ya respeta el rol autenticado del usuario.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Creado: {createdAt ? formatDate(createdAt) : "Sin fecha"}
              </p>
            </div>

            <a
              href="/leads"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Volver a leads
            </a>
          </div>
        </section>

        {!canEdit ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Puedes ver este lead, pero no editarlo con tu rol actual o por la
            regla del mismo día.
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <form onSubmit={guardarCambios} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre"
                required
                input={
                  <input
                    className={inputClass}
                    placeholder="Nombre"
                    value={form.first_name}
                    onChange={(e) =>
                      setForm({ ...form, first_name: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="Apellido"
                input={
                  <input
                    className={inputClass}
                    placeholder="Apellido"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm({ ...form, last_name: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="Teléfono"
                required
                input={
                  <input
                    className={inputClass}
                    placeholder="Teléfono"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="Edad"
                input={
                  <input
                    className={inputClass}
                    placeholder="Edad"
                    type="number"
                    value={form.age}
                    onChange={(e) =>
                      setForm({ ...form, age: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="Estado civil"
                input={
                  <select
                    className={inputClass}
                    value={form.marital_status}
                    onChange={(e) =>
                      setForm({ ...form, marital_status: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona</option>
                    {maritalStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <Field
                label="Ciudad"
                input={
                  <input
                    className={inputClass}
                    placeholder="Ciudad"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="¿Tiene EPS?"
                input={
                  <select
                    className={inputClass}
                    value={form.has_eps}
                    onChange={(e) =>
                      setForm({ ...form, has_eps: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                }
              />

              <Field
                label="Tipo de afiliación"
                input={
                  <select
                    className={inputClass}
                    value={form.affiliation_type}
                    onChange={(e) =>
                      setForm({ ...form, affiliation_type: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona</option>
                    <option value="cotizante">Cotizante</option>
                    <option value="beneficiario">Beneficiario</option>
                    <option value="subsidiado">Subsidiado</option>
                  </select>
                }
              />

              <Field
                label="Lugar de captación"
                input={
                  <input
                    className={inputClass}
                    placeholder="Lugar de captación"
                    value={form.capture_location}
                    onChange={(e) =>
                      setForm({ ...form, capture_location: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                }
              />

              <Field
                label="Servicio de interés"
                input={
                  <select
                    className={inputClass}
                    value={form.interest_service}
                    onChange={(e) =>
                      setForm({ ...form, interest_service: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona</option>
                    {interestServiceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <Field
                label="Origen del lead"
                input={
                  <select
                    className={inputClass}
                    value={form.source}
                    onChange={(e) =>
                      setForm({ ...form, source: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="">Selecciona</option>
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                }
              />

              <Field
                label="Estado del lead"
                input={
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    disabled={!canEdit}
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="pendiente_contacto">
                      Pendiente de contacto
                    </option>
                    <option value="contactado">Contactado</option>
                    <option value="agendado">Agendado</option>
                    <option value="asistio">Asistió</option>
                    <option value="no_asistio">No asistió</option>
                    <option value="vendido">Vendido</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="descartado">Descartado</option>
                  </select>
                }
              />
            </div>

            <Field
              label="Observaciones"
              input={
                <textarea
                  className={`${inputClass} min-h-[120px] resize-none`}
                  placeholder="Observaciones"
                  value={form.observations}
                  onChange={(e) =>
                    setForm({ ...form, observations: e.target.value })
                  }
                  disabled={!canEdit}
                />
              }
            />

            <button
              type="submit"
              disabled={saving || !canEdit}
              className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white disabled:opacity-60"
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