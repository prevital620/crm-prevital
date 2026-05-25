"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import SessionBadge from "@/components/session-badge";

type WhatsappLead = {
  id: string;
  phone: string;
  profile_name: string | null;
  full_name: string | null;
  email: string | null;
  campaign_code: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
};

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

function todayISO() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartISO() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function statusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    collecting_name: "Pidiendo nombre",
    collecting_email: "Pidiendo correo",
    registered: "Registrado",
  };

  if (!status) return "Sin estado";
  return labels[status] || status;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  try {
    return new Date(value).toLocaleString("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function displayName(lead: WhatsappLead) {
  return lead.full_name || lead.profile_name || "Sin nombre";
}

export default function AdminWhatsappLeadsPage() {
  const [leads, setLeads] = useState<WhatsappLead[]>([]);
  const [status, setStatus] = useState("");
  const [campaignCode, setCampaignCode] = useState("PV_DETOX");
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const registeredCount = useMemo(
    () => leads.filter((lead) => lead.status === "registered").length,
    [leads]
  );

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (campaignCode.trim()) params.set("campaign_code", campaignCode.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const response = await fetch(`/api/whatsapp/leads?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudieron cargar los leads.");
      }

      setLeads((payload?.leads as WhatsappLead[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los leads.";
      setError(message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLeads();
  }

  function clearFilters() {
    setStatus("");
    setCampaignCode("PV_DETOX");
    setDateFrom(monthStartISO());
    setDateTo(todayISO());
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,_#F6FAF7_0%,_#EFF7F1_48%,_#F8FBF8_100%)] px-4 py-8 text-[#10233F] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-[#C7EEE1]/38 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-[#8CB88D]/16 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[430px] w-[430px] opacity-[0.04] md:h-[580px] md:w-[580px]">
          <Image
            src="/prevital-logo-vivo.png"
            alt="Prevital"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[34px] border border-[#CFE4D8] bg-[linear-gradient(135deg,_rgba(255,255,255,0.97)_0%,_rgba(242,251,246,0.95)_52%,_rgba(231,245,236,0.92)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.16)]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                WhatsApp
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">
                Leads WhatsApp
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                Consulta de inscripciones recibidas por WhatsApp SaleADS.
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Volver a admin
            </a>

            <button
              type="button"
              onClick={() => void loadLeads()}
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
            >
              Actualizar
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Total filtrado</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{leads.length}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Registrados</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">{registeredCount}</p>
          </div>
          <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-white/95 p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
            <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
            <p className="text-sm font-medium text-[#5B6E63]">Campana</p>
            <p className="mt-2 text-3xl font-bold text-[#24312A]">
              {campaignCode.trim() || "Todas"}
            </p>
          </div>
        </section>

        <section className={panelClass}>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Estado</label>
              <select
                className={inputClass}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="collecting_name">Pidiendo nombre</option>
                <option value="collecting_email">Pidiendo correo</option>
                <option value="registered">Registrado</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Campana</label>
              <input
                className={inputClass}
                value={campaignCode}
                onChange={(event) => setCampaignCode(event.target.value)}
                placeholder="PV_DETOX"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
              <input
                className={inputClass}
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                className={inputClass}
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#6C9C88_0%,_#5F7D66_55%,_#456A55_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(95,125,102,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Filtrar
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
              >
                Limpiar
              </button>
            </div>
          </form>
        </section>

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        <section className={panelClass}>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#0E2340]">Registros</h2>
              <p className="mt-1 text-sm text-[#496356]">Solo lectura.</p>
            </div>
            {loading ? <p className="text-sm text-[#607368]">Cargando...</p> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.22em] text-[#50695C]">
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Nombre</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Telefono</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Correo</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Campana</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Origen</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Estado</th>
                  <th className="border-b border-[#DCEDE3] px-4 py-3">Creacion</th>
                </tr>
              </thead>
              <tbody>
                {!loading && leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="rounded-2xl border border-dashed border-[#CFE4D8] px-4 py-8 text-center text-[#607368]"
                    >
                      No hay leads para esos filtros.
                    </td>
                  </tr>
                ) : null}

                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top text-[#10233F]">
                    <td className="border-b border-[#EDF5EF] px-4 py-4 font-semibold">
                      {displayName(lead)}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">{lead.phone}</td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.email || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.campaign_code || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {lead.source || "-"}
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      <span className="inline-flex rounded-full bg-[#E8F6EE] px-3 py-1 text-xs font-semibold text-[#4F6F5B] ring-1 ring-[#CFE4D8]">
                        {statusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="border-b border-[#EDF5EF] px-4 py-4">
                      {formatDateTime(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
