"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import { digitsOnly } from "@/lib/users/userLookup";
import SessionBadge from "@/components/session-badge";
import {
  parseLeadImportFile,
  type ImportDetectedColumns,
  type ImportParsedRow,
} from "@/lib/leads/import-file";

type CandidateRow = ImportParsedRow & {
  normalizedPhone: string;
  firstName: string;
  lastName: string;
  status: "listo" | "duplicado_archivo" | "duplicado_base" | "invalido";
  reason: string;
};

const allowedRoles = [
  "super_user",
  "supervisor_call_center",
  "confirmador",
  "tmk",
];

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#D6E8DA] bg-white/92 px-4 py-4 text-base text-[#24312A] shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

export default function ImportarLeadsPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentRoleCode, setCurrentRoleCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [fileName, setFileName] = useState("");
  const [detectedColumns, setDetectedColumns] = useState<ImportDetectedColumns | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<"csv" | "xlsx" | null>(null);
  const [parsedRows, setParsedRows] = useState<CandidateRow[]>([]);

  const autoAssignsLead =
    currentRoleCode === "tmk" ||
    currentRoleCode === "confirmador" ||
    currentRoleCode === "supervisor_call_center";

  useEffect(() => {
    void cargarAcceso();
  }, []);

  async function cargarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesion para usar este modulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para importar leads.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", auth.user.id)
        .single();

      if (profileError || !profile) {
        setAuthorized(false);
        setError("No se pudo cargar el perfil del usuario actual.");
        return;
      }

      setAuthorized(true);
      setCurrentUserId(profile.id);
      setCurrentUserName(profile.full_name || "Usuario actual");
      setCurrentRoleCode(auth.roleCode);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;

    setLoading(true);
    setError("");
    setMensaje("");
    setParsedRows([]);
    setDetectedColumns(null);
    setDetectedFormat(null);
    setFileName(file.name);

    try {
      const parsed = await parseLeadImportFile(file);
      const rows = parsed.rows;

      setDetectedColumns(parsed.columns);
      setDetectedFormat(parsed.format);

      if (rows.length === 0) {
        throw new Error("El archivo no tiene filas validas para revisar.");
      }

      const existingPhones = await loadExistingPhones();
      const seenInFile = new Set<string>();

      const candidates = rows.map((row) => {
        const normalizedPhone = digitsOnly(row.telefono);
        const { firstName, lastName } = splitFullName(row.nombre);

        if (!parsed.columns.nameHeader) {
          return buildCandidateRow(row, normalizedPhone, firstName, lastName, "invalido", "Columna de nombre no encontrada.");
        }

        if (!parsed.columns.phoneHeader) {
          return buildCandidateRow(row, normalizedPhone, firstName, lastName, "invalido", "Columna de telefono no encontrada.");
        }

        if (!row.nombre.trim()) {
          return buildCandidateRow(row, normalizedPhone, firstName, lastName, "invalido", "Nombre vacio.");
        }

        if (!normalizedPhone) {
          return buildCandidateRow(row, normalizedPhone, firstName, lastName, "invalido", "Telefono vacio.");
        }

        if (existingPhones.has(normalizedPhone)) {
          return buildCandidateRow(
            row,
            normalizedPhone,
            firstName,
            lastName,
            "duplicado_base",
            "Telefono ya existe en base."
          );
        }

        if (seenInFile.has(normalizedPhone)) {
          return buildCandidateRow(
            row,
            normalizedPhone,
            firstName,
            lastName,
            "duplicado_archivo",
            "Telefono repetido en archivo."
          );
        }

        seenInFile.add(normalizedPhone);

        return buildCandidateRow(
          row,
          normalizedPhone,
          firstName,
          lastName,
          "listo",
          "Listo para importar."
        );
      });

      setParsedRows(candidates);
      setMensaje("Archivo analizado correctamente.");
    } catch (err: any) {
      setError(err?.message || "No se pudo analizar el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function importarLeads() {
    if (!currentUserId) {
      setError("No se encontro el usuario actual.");
      return;
    }

    const readyRows = parsedRows.filter((row) => row.status === "listo");

    if (readyRows.length === 0) {
      setError("No hay filas listas para importar.");
      return;
    }

    setLoading(true);
    setError("");
    setMensaje("");

    try {
      const chunks = chunkArray(readyRows, 200);

      for (const chunk of chunks) {
        const payload = chunk.map((row) => ({
          first_name: row.firstName,
          last_name: row.lastName || null,
          phone: row.normalizedPhone,
          city: row.ciudad.trim() || null,
          observations: row.observaciones.trim() || null,
          source: "redes",
          status: "nuevo",
          created_by_user_id: currentUserId,
          assigned_to_user_id: autoAssignsLead ? currentUserId : null,
        }));

        const { error: insertError } = await supabase.from("leads").insert(payload);

        if (insertError) throw insertError;
      }

      const insertedPhones = new Set(readyRows.map((row) => row.normalizedPhone));

      setParsedRows((prev) =>
        prev.map((row) =>
          insertedPhones.has(row.normalizedPhone)
            ? {
                ...row,
                status: "duplicado_base",
                reason: "Importado correctamente en esta carga.",
              }
            : row
        )
      );

      const duplicates = parsedRows.filter(
        (row) => row.status === "duplicado_archivo" || row.status === "duplicado_base"
      ).length;
      const invalids = parsedRows.filter((row) => row.status === "invalido").length;

      setMensaje(
        `Importacion completada. Nuevos: ${readyRows.length}. Repetidos ignorados: ${duplicates}. Filas invalidas: ${invalids}. Origen aplicado: redes.`
      );
    } catch (err: any) {
      setError(err?.message || "No se pudieron importar los leads.");
    } finally {
      setLoading(false);
    }
  }

  function descargarPlantilla() {
    const template = [
      "nombre;telefono;ciudad;observaciones",
      "Ana Perez;3001234567;Medellin;Lead de campana detox",
      "Juan Ramirez;3019876543;Bello;Interesado en valoracion",
    ].join("\n");

    const blob = new Blob(["\uFEFF" + template], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_importacion_leads_redes.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => {
    return {
      total: parsedRows.length,
      ready: parsedRows.filter((row) => row.status === "listo").length,
      duplicates: parsedRows.filter(
        (row) => row.status === "duplicado_archivo" || row.status === "duplicado_base"
      ).length,
      invalid: parsedRows.filter((row) => row.status === "invalido").length,
    };
  }, [parsedRows]);

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] pb-10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
          <section className={panelClass}>
            <p className="text-sm text-slate-500">Validando acceso...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] pb-10">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
          <section className="rounded-[28px] border border-[#F2C9C9] bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-700">
              {error || "No tienes permiso para entrar a este modulo."}
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8F7F4] pb-10">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[380px] w-[380px] opacity-[0.045] md:h-[520px] md:w-[520px]">
          <Image
            src="/prevital-logo.jpeg"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center gap-3">
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

        <section className="relative mb-6 overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                Leads
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3.05rem]">
                Importar leads de redes
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Sube un archivo CSV o XLSX. El sistema crea solo los leads nuevos,
                aplica origen automatico redes e ignora repetidos por telefono.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#4F6F5B]">
                <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-[#D8ECE1]">
                  Plantilla CSV simple
                </span>
                <span className="rounded-full bg-[#F3F8F5] px-3 py-1 ring-1 ring-[#D8ECE1]">
                  Tambien acepta XLSX directo
                </span>
                <span className="rounded-full bg-[#F3F8F5] px-3 py-1 ring-1 ring-[#D8ECE1]">
                  Origen fijo: redes
                </span>
                <span className="rounded-full bg-[#F3F8F5] px-3 py-1 ring-1 ring-[#D8ECE1]">
                  Duplicados ignorados por telefono
                </span>
                {autoAssignsLead ? (
                  <span className="rounded-full bg-[#F3F8F5] px-3 py-1 ring-1 ring-[#D8ECE1]">
                    Se asignan a tu usuario
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 md:items-end">
              <SessionBadge />
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-5 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Inicio
                </Link>

                <Link
                  href="/leads"
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_14px_28px_rgba(95,125,102,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Consultar leads
                </Link>

                <Link
                  href="/call-center?filter=redes&date=today"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-[#F3F8F5] px-5 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-white"
                >
                  Ver leads redes hoy
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={panelClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#24312A]">
                  Carga del archivo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Usa la plantilla o sube el XLSX tal como sale de Excel.
                </p>
              </div>

              <button
                type="button"
                onClick={descargarPlantilla}
                className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Descargar plantilla
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  Archivo CSV o XLSX
                </div>
                <input
                  className={inputClass}
                  type="file"
                  accept=".csv,.txt,.xlsx"
                  onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Se detectan automaticamente columnas como Nombre completo, Telefono, Celular, Phone Number y similares.
                </p>
              </label>

              <div className="rounded-[26px] border border-[#D7EADF] bg-[linear-gradient(135deg,_#F7FCF8_0%,_#EEF8F2_62%,_#E4F3EA_100%)] p-4 shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6B8B77]">
                  Responsable de la carga
                </p>
                <p className="mt-2 text-xl font-semibold text-[#24312A]">
                  {currentUserName}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Todos los leads de esta carga quedan con origen redes.
                </p>
              </div>

              {fileName ? (
                <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4 text-sm text-[#4F6F5B]">
                  Archivo cargado: <span className="font-semibold">{fileName}</span>
                  {detectedFormat ? (
                    <span className="ml-2 text-slate-500">
                      ({detectedFormat.toUpperCase()})
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void importarLeads()}
                  disabled={loading || summary.ready === 0}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-5 py-4 text-base font-semibold text-white shadow-[0_16px_30px_rgba(95,125,102,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
                >
                  {loading ? "Procesando..." : "Importar leads validos"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFileName("");
                    setDetectedColumns(null);
                    setDetectedFormat(null);
                    setParsedRows([]);
                    setMensaje("");
                    setError("");
                  }}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-[#D6E8DA] bg-white/90 px-5 py-4 text-base font-semibold text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F4FAF6] sm:w-auto"
                >
                  Limpiar
                </button>
              </div>

              {mensaje ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  <p>{mensaje}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href="/call-center?filter=redes&date=today"
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-[#2D6B4A] transition hover:bg-emerald-100"
                    >
                      Ir a Gestión de leads
                    </Link>
                    <Link
                      href="/leads"
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-[#2D6B4A] transition hover:bg-emerald-100"
                    >
                      Ver leads creados
                    </Link>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <section className={panelClass}>
            <h2 className="text-xl font-semibold text-[#24312A]">Resumen de analisis</h2>
            <p className="mt-1 text-sm text-slate-500">
              Revisa antes de importar cuantas filas entran y cuantas se ignoran.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <SummaryCard title="Filas leidas" value={summary.total} tone="neutral" />
              <SummaryCard title="Listas para importar" value={summary.ready} tone="success" />
              <SummaryCard title="Repetidas ignoradas" value={summary.duplicates} tone="warning" />
              <SummaryCard title="Invalidas" value={summary.invalid} tone="danger" />
            </div>

            <div className="mt-5 rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-4 text-sm text-slate-600">
              <p className="font-medium text-[#24312A]">Columnas esperadas</p>
              <p className="mt-2">
                Minimas: <span className="font-semibold">nombre</span> y{" "}
                <span className="font-semibold">telefono</span>.
              </p>
              <p className="mt-1">
                Opcionales: <span className="font-semibold">ciudad</span> y{" "}
                <span className="font-semibold">observaciones</span>.
              </p>
            </div>

            {detectedColumns ? (
              <div className="mt-5 rounded-2xl border border-[#D6E8DA] bg-white p-4 text-sm text-slate-600 shadow-sm">
                <p className="font-medium text-[#24312A]">Columnas detectadas</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <DetectedField
                    label="Nombre"
                    value={detectedColumns.nameHeader || "No encontrada"}
                    found={Boolean(detectedColumns.nameHeader)}
                  />
                  <DetectedField
                    label="Telefono"
                    value={detectedColumns.phoneHeader || "No encontrada"}
                    found={Boolean(detectedColumns.phoneHeader)}
                  />
                  <DetectedField
                    label="Ciudad"
                    value={detectedColumns.cityHeader || "No detectada"}
                    found={Boolean(detectedColumns.cityHeader)}
                  />
                  <DetectedField
                    label="Observaciones"
                    value={detectedColumns.notesHeader || "No detectada"}
                    found={Boolean(detectedColumns.notesHeader)}
                  />
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Encabezados leidos:{" "}
                  {detectedColumns.headers.length > 0
                    ? detectedColumns.headers.join(" | ")
                    : "Sin encabezados detectados"}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <section className={`${panelClass} mt-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#24312A]">
                Vista previa
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Primeras filas procesadas con su estado antes de importar.
              </p>
            </div>
            <div className="rounded-full border border-[#D6E8DA] bg-[#F4FAF6] px-3 py-1 text-xs font-semibold text-[#4F6F5B]">
              {parsedRows.length} filas analizadas
            </div>
          </div>

          {parsedRows.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Sube un archivo para ver la vista previa antes de importar.
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-3xl border border-[#D6E8DA]">
              <div className="max-h-[560px] overflow-auto bg-white">
                <table className="min-w-full divide-y divide-[#E5EFE8]">
                  <thead className="bg-[#F4FAF6]">
                    <tr className="text-left text-xs uppercase tracking-[0.2em] text-[#6B8B77]">
                      <th className="px-4 py-3">Fila</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Telefono</th>
                      <th className="px-4 py-3">Ciudad</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF5F0]">
                    {parsedRows.slice(0, 120).map((row) => (
                      <tr key={`${row.rowNumber}-${row.normalizedPhone}-${row.nombre}`}>
                        <td className="px-4 py-3 text-sm text-slate-500">{row.rowNumber}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#24312A]">{row.nombre || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.telefono || "-"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{row.ciudad || "-"}</td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-[#D6E8DA] bg-[#F8F7F4] text-[#4F6F5B]";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function DetectedField({
  label,
  value,
  found,
}: {
  label: string;
  value: string;
  found: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#D6E8DA] bg-[#F8F7F4] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B8B77]">
        {label}
      </p>
      <p className={`mt-2 text-sm font-medium ${found ? "text-[#24312A]" : "text-rose-700"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: CandidateRow["status"] }) {
  const config =
    status === "listo"
      ? {
          label: "Listo",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : status === "duplicado_base"
      ? {
          label: "Repetido en base",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : status === "duplicado_archivo"
      ? {
          label: "Repetido en archivo",
          className: "border-orange-200 bg-orange-50 text-orange-700",
        }
      : {
          label: "Invalido",
          className: "border-rose-200 bg-rose-50 text-rose-700",
        };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function buildCandidateRow(
  row: ImportParsedRow,
  normalizedPhone: string,
  firstName: string,
  lastName: string,
  status: CandidateRow["status"],
  reason: string
): CandidateRow {
  return {
    ...row,
    normalizedPhone,
    firstName,
    lastName,
    status,
    reason,
  };
}

function splitFullName(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

async function loadExistingPhones() {
  const phones = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("leads")
      .select("phone")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const rows = (data || []) as Array<{ phone: string | null }>;
    rows.forEach((row) => {
      const normalized = digitsOnly(row.phone);
      if (normalized) phones.add(normalized);
    });

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return phones;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
