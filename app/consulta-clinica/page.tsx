"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ClipboardPlus,
  FileCheck2,
  FileText,
  Paperclip,
  RefreshCcw,
  Search,
} from "lucide-react";

import LogoutButton from "@/components/logout-button";
import { PrevitalFilterBar, PrevitalFilterGroup, PrevitalInput, PrevitalSelect } from "@/components/layout/prevital-filter-bar";
import { PrevitalPageHeader } from "@/components/layout/prevital-page-header";
import { PrevitalBadge } from "@/components/ui/prevital-badge";
import { PrevitalButton } from "@/components/ui/prevital-button";
import { PrevitalCard, PrevitalCardContent, PrevitalCardHeader } from "@/components/ui/prevital-card";
import { getCurrentUserRole, normalizeRoleCode } from "@/lib/auth";
import {
  getClinicalEncounterBundleById,
  getClinicalEncounters,
  searchClinicalPatients,
} from "@/lib/clinical/client";
import type {
  ClinicalAttachment,
  ClinicalConsent,
  ClinicalEncounter,
  ClinicalEncounterBundle,
  ClinicalEvolution,
  ClinicalPatient,
} from "@/lib/clinical/types";
import { supabase } from "@/lib/supabase";

const ALLOWED_ROLES = [
  "nutricionista",
  "fisioterapeuta",
  "medico_general",
  "coordinador_clinico",
  "auditor_clinico",
] as const;

type SpecialtyFilter = "all" | "nutricion" | "fisioterapia" | "medicina_general";
type StatusFilter = "all" | "open" | "closed";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function summarizeConsent(consents: ClinicalConsent[]) {
  if (!consents.length) return "Sin consentimientos";
  const accepted = consents.filter((item) => item.accepted).length;
  return `${accepted}/${consents.length} aceptados`;
}

function summarizeAttachments(attachments: ClinicalAttachment[]) {
  if (!attachments.length) return "Sin anexos";
  return `${attachments.length} anexo${attachments.length === 1 ? "" : "s"}`;
}

function summarizeEvolutions(evolutions: ClinicalEvolution[]) {
  if (!evolutions.length) return "Sin evoluciones";
  return `${evolutions.length} evolución${evolutions.length === 1 ? "" : "es"}`;
}

function getEncounterActionHref(encounter: ClinicalEncounter) {
  if (!encounter.appointment_id) return null;

  if (encounter.specialty === "nutricion") {
    return `/nutricion/atencion/${encounter.appointment_id}`;
  }

  if (encounter.specialty === "fisioterapia") {
    return `/fisioterapia/atencion/${encounter.appointment_id}`;
  }

  return null;
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8F7F4] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B8B78]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value || "Sin dato"}</p>
    </div>
  );
}

function TextBlock({
  title,
  value,
}: {
  title: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value?.trim() || "Sin información registrada."}
      </p>
    </div>
  );
}

export default function ConsultaClinicaPage() {
  const router = useRouter();

  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("Usuario");
  const [currentRoleLabel, setCurrentRoleLabel] = useState("Rol clínico");
  const [scopeLabel, setScopeLabel] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<SpecialtyFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [errorMessage, setErrorMessage] = useState("");
  const [patients, setPatients] = useState<ClinicalPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<ClinicalEncounter[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ClinicalEncounterBundle | null>(null);

  const selectedPatient = useMemo(
    () => patients.find((item) => item.id === selectedPatientId) || bundle?.patient || null,
    [patients, selectedPatientId, bundle]
  );

  const selectedEncounter = useMemo(
    () => encounters.find((item) => item.id === selectedEncounterId) || bundle?.encounter || null,
    [encounters, selectedEncounterId, bundle]
  );

  async function ensureAccess() {
    try {
      setCheckingSession(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const auth = await getCurrentUserRole();
      const effectiveRoles = Array.from(
        new Set(
          [auth.roleCode, ...(auth.allRoleCodes || [])]
            .map((role) => normalizeRoleCode(role))
            .filter(Boolean)
        )
      ) as string[];

      const allowed = effectiveRoles.some((role) =>
        (ALLOWED_ROLES as readonly string[]).includes(role)
      );

      if (!allowed) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setCurrentUserName(profile?.full_name || "Usuario");
      setCurrentRoleLabel(auth.allRoleNames?.join(" / ") || auth.roleName || "Rol clínico");
      setScopeLabel(
        effectiveRoles.some((role) => ["coordinador_clinico", "auditor_clinico"].includes(role))
          ? "Vista clínica ampliada autorizada."
          : "Mostrando solo historias clínicas vinculadas a tu atención."
      );
    } catch (error: any) {
      setErrorMessage(error?.message || "No fue posible validar el acceso clínico.");
    } finally {
      setCheckingSession(false);
    }
  }

  async function loadPatients(query = searchTerm) {
    try {
      setLoadingPatients(true);
      setErrorMessage("");
      const response = await searchClinicalPatients(query);
      setPatients(response);

      if (!response.length) {
        setSelectedPatientId(null);
        setEncounters([]);
        setSelectedEncounterId(null);
        setBundle(null);
        return;
      }

      const activePatientId = response.some((item) => item.id === selectedPatientId)
        ? selectedPatientId
        : response[0].id;

      setSelectedPatientId(activePatientId);
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudieron consultar los pacientes clínicos.");
      setPatients([]);
      setSelectedPatientId(null);
      setEncounters([]);
      setSelectedEncounterId(null);
      setBundle(null);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function loadEncounters(patientId: string) {
    try {
      setLoadingEncounters(true);
      setErrorMessage("");

      const items = await getClinicalEncounters({
        patientId,
        specialty: specialtyFilter === "all" ? null : specialtyFilter,
        status: statusFilter === "all" ? null : statusFilter,
      });

      setEncounters(items);

      if (!items.length) {
        setSelectedEncounterId(null);
        setBundle(null);
        return;
      }

      const activeEncounterId = items.some((item) => item.id === selectedEncounterId)
        ? selectedEncounterId
        : items[0].id;

      setSelectedEncounterId(activeEncounterId);
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudieron consultar los encuentros clínicos.");
      setEncounters([]);
      setSelectedEncounterId(null);
      setBundle(null);
    } finally {
      setLoadingEncounters(false);
    }
  }

  async function loadDetail(encounterId: string) {
    try {
      setLoadingDetail(true);
      setErrorMessage("");
      const response = await getClinicalEncounterBundleById(encounterId);
      setBundle(response);
    } catch (error: any) {
      setErrorMessage(error?.message || "No se pudo cargar el detalle clínico.");
      setBundle(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    void ensureAccess();
  }, []);

  useEffect(() => {
    if (!checkingSession) {
      void loadPatients();
    }
  }, [checkingSession]);

  useEffect(() => {
    if (selectedPatientId) {
      void loadEncounters(selectedPatientId);
    }
  }, [selectedPatientId, specialtyFilter, statusFilter]);

  useEffect(() => {
    if (selectedEncounterId) {
      void loadDetail(selectedEncounterId);
    }
  }, [selectedEncounterId]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
        <div className="mx-auto max-w-5xl">
          <PrevitalCard>
            <PrevitalCardContent className="p-8 text-sm text-slate-500">
              Validando acceso a consulta clínica...
            </PrevitalCardContent>
          </PrevitalCard>
        </div>
      </main>
    );
  }

  const encounterActionHref = selectedEncounter ? getEncounterActionHref(selectedEncounter) : null;

  return (
    <main className="min-h-screen bg-[#F8F7F4] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PrevitalPageHeader
          title="Consulta clínica"
          subtitle="Consulta segura de pacientes, encuentros e historia clínica sin mezclarla con la operación comercial."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[#D6E8DA] bg-[#EAF4EC] px-5 py-3 text-[#4F6F5B]">
                <p className="text-sm font-semibold">{currentUserName}</p>
                <p className="text-xs text-[#5E8F6C]">{currentRoleLabel}</p>
              </div>
              <LogoutButton />
            </div>
          }
        />

        <PrevitalFilterBar>
          <PrevitalFilterGroup>
            <PrevitalInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por paciente, documento, teléfono o ciudad"
              className="min-w-[280px] flex-1"
            />
            <PrevitalSelect
              value={specialtyFilter}
              onChange={(event) => setSpecialtyFilter(event.target.value as SpecialtyFilter)}
              className="min-w-[180px]"
            >
              <option value="all">Todas las áreas</option>
              <option value="nutricion">Nutrición</option>
              <option value="fisioterapia">Fisioterapia</option>
              <option value="medicina_general">Medicina general</option>
            </PrevitalSelect>
            <PrevitalSelect
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="min-w-[160px]"
            >
              <option value="all">Todos los estados</option>
              <option value="open">Abiertos</option>
              <option value="closed">Cerrados</option>
            </PrevitalSelect>
          </PrevitalFilterGroup>

          <div className="flex flex-wrap gap-3">
            <PrevitalButton
              variant="secondary"
              leftIcon={<Search className="h-4 w-4" />}
              onClick={() => void loadPatients(searchTerm)}
            >
              Buscar
            </PrevitalButton>
            <PrevitalButton
              variant="secondary"
              leftIcon={<RefreshCcw className="h-4 w-4" />}
              onClick={() => {
                setSearchTerm("");
                setSpecialtyFilter("all");
                setStatusFilter("all");
                void loadPatients("");
              }}
            >
              Actualizar
            </PrevitalButton>
            <PrevitalButton variant="secondary" onClick={() => router.push("/")}>
              Inicio
            </PrevitalButton>
          </div>
        </PrevitalFilterBar>

        {scopeLabel ? (
          <PrevitalCard>
            <PrevitalCardContent className="p-4 text-sm text-[#5E8F6C]">
              {scopeLabel}
            </PrevitalCardContent>
          </PrevitalCard>
        ) : null}

        {errorMessage ? (
          <PrevitalCard className="border-rose-200 bg-rose-50">
            <PrevitalCardContent className="p-4 text-sm text-rose-700">
              {errorMessage}
            </PrevitalCardContent>
          </PrevitalCard>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[320px,360px,1fr]">
          <PrevitalCard>
            <PrevitalCardHeader
              title="Pacientes"
              description={
                loadingPatients
                  ? "Buscando pacientes..."
                  : `${patients.length} paciente${patients.length === 1 ? "" : "s"} encontrado${patients.length === 1 ? "" : "s"}`
              }
            />
            <PrevitalCardContent className="space-y-3">
              {patients.length ? (
                patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      patient.id === selectedPatientId
                        ? "border-[#7BA483] bg-[#F1F7F2] shadow-[0_10px_24px_rgba(79,111,91,0.08)]"
                        : "border-slate-200 bg-white hover:border-[#BED5C3] hover:bg-[#FBFCFA]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{patient.full_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {patient.document_number || "Sin documento"}
                        </p>
                      </div>
                      <PrevitalBadge status="nuevo">
                        {patient.age ? `${patient.age} años` : "Paciente"}
                      </PrevitalBadge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>{patient.phone || "Sin teléfono"}</p>
                      <p>{patient.city || "Sin ciudad"}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                  No hay pacientes clínicos para estos filtros.
                </div>
              )}
            </PrevitalCardContent>
          </PrevitalCard>

          <PrevitalCard>
            <PrevitalCardHeader
              title="Encuentros"
              description={
                selectedPatient
                  ? loadingEncounters
                    ? "Buscando encuentros..."
                    : `${encounters.length} encuentro${encounters.length === 1 ? "" : "s"} para ${selectedPatient.full_name}`
                  : "Selecciona un paciente para consultar su trazabilidad clínica."
              }
            />
            <PrevitalCardContent className="space-y-3">
              {selectedPatient ? (
                encounters.length ? (
                  encounters.map((encounter) => (
                    <button
                      key={encounter.id}
                      type="button"
                      onClick={() => setSelectedEncounterId(encounter.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        encounter.id === selectedEncounterId
                          ? "border-[#7BA483] bg-[#F1F7F2] shadow-[0_10px_24px_rgba(79,111,91,0.08)]"
                          : "border-slate-200 bg-white hover:border-[#BED5C3] hover:bg-[#FBFCFA]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold capitalize text-slate-800">
                            {encounter.specialty.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(encounter.started_at)}
                          </p>
                        </div>
                        <PrevitalBadge status={encounter.status}>
                          {encounter.status === "closed" ? "Cerrado" : "Abierto"}
                        </PrevitalBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>ID cita: {encounter.appointment_id || "Sin cita"}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                    No hay encuentros clínicos para este paciente con los filtros actuales.
                  </div>
                )
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                  Elige un paciente para ver sus encuentros.
                </div>
              )}
            </PrevitalCardContent>
          </PrevitalCard>

          <div className="space-y-6">
            <PrevitalCard>
              <PrevitalCardHeader
                title="Detalle clínico"
                description={
                  selectedEncounter
                    ? `Consulta segura del encuentro ${selectedEncounter.id.slice(0, 8)}`
                    : "Selecciona un encuentro para ver la historia clínica."
                }
                action={
                  encounterActionHref ? (
                    <PrevitalButton
                      variant="secondary"
                      onClick={() => router.push(encounterActionHref)}
                    >
                      Abrir atención
                    </PrevitalButton>
                  ) : null
                }
              />
              <PrevitalCardContent className="space-y-6">
                {loadingDetail ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                    Cargando detalle clínico...
                  </div>
                ) : bundle ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoTile label="Paciente" value={bundle.patient.full_name} />
                      <InfoTile label="Documento" value={bundle.patient.document_number} />
                      <InfoTile label="Teléfono" value={bundle.patient.phone} />
                      <InfoTile label="Ciudad" value={bundle.patient.city} />
                      <InfoTile label="EPS" value={bundle.patient.eps} />
                      <InfoTile label="Ocupación" value={bundle.patient.occupation} />
                      <InfoTile label="Edad" value={bundle.patient.age} />
                      <InfoTile label="Sexo" value={bundle.patient.sex} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoTile label="Especialidad" value={bundle.encounter.specialty} />
                      <InfoTile label="Estado" value={bundle.encounter.status} />
                      <InfoTile label="Inicio" value={formatDateTime(bundle.encounter.started_at)} />
                      <InfoTile label="Cierre" value={formatDateTime(bundle.encounter.closed_at)} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <ClipboardPlus className="h-4 w-4 text-[#5E8F6C]" />
                          Evoluciones
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {summarizeEvolutions(bundle.evolutions)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <FileCheck2 className="h-4 w-4 text-[#5E8F6C]" />
                          Consentimientos
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {summarizeConsent(bundle.consents)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <Paperclip className="h-4 w-4 text-[#5E8F6C]" />
                          Anexos
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {summarizeAttachments(bundle.attachments)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <TextBlock title="Motivo de consulta" value={bundle.history?.chief_complaint} />
                      <TextBlock title="Enfermedad actual" value={bundle.history?.current_illness} />
                      <TextBlock title="Revisión por sistemas" value={bundle.history?.review_of_systems} />
                      <TextBlock title="Examen físico" value={bundle.history?.physical_exam} />
                      <TextBlock title="Valoración clínica" value={bundle.history?.assessment} />
                      <TextBlock title="Plan clínico" value={bundle.history?.plan} />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <TextBlock title="Antecedentes patológicos" value={bundle.background?.pathological} />
                      <TextBlock title="Antecedentes quirúrgicos" value={bundle.background?.surgical} />
                      <TextBlock title="Tóxicos" value={bundle.background?.toxic} />
                      <TextBlock title="Alergias" value={bundle.background?.allergies} />
                      <TextBlock title="Medicamentos" value={bundle.background?.medications} />
                      <TextBlock title="Familiares" value={bundle.background?.family_history} />
                    </div>

                    <PrevitalCard className="border-slate-200 shadow-none">
                      <PrevitalCardHeader
                        title="Evoluciones registradas"
                        description="Seguimiento cronológico del paciente dentro del encuentro clínico."
                      />
                      <PrevitalCardContent className="space-y-3">
                        {bundle.evolutions.length ? (
                          bundle.evolutions.map((evolution) => (
                            <div
                              key={evolution.id}
                              className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <Activity className="h-4 w-4 text-[#5E8F6C]" />
                                {formatDateTime(evolution.evolution_date)}
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {evolution.note}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                            Este encuentro todavía no tiene evoluciones clínicas.
                          </div>
                        )}
                      </PrevitalCardContent>
                    </PrevitalCard>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <PrevitalCard className="border-slate-200 shadow-none">
                        <PrevitalCardHeader
                          title="Consentimientos"
                          description="Registro de aceptación documental por encuentro."
                        />
                        <PrevitalCardContent className="space-y-3">
                          {bundle.consents.length ? (
                            bundle.consents.map((consent) => (
                              <div
                                key={consent.id}
                                className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {consent.consent_type}
                                  </p>
                                  <PrevitalBadge status={consent.accepted ? "asistio" : "cancelada"}>
                                    {consent.accepted ? "Aceptado" : "Pendiente"}
                                  </PrevitalBadge>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                  {formatDateTime(consent.accepted_at || consent.created_at)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                              No hay consentimientos guardados para este encuentro.
                            </div>
                          )}
                        </PrevitalCardContent>
                      </PrevitalCard>

                      <PrevitalCard className="border-slate-200 shadow-none">
                        <PrevitalCardHeader
                          title="Anexos"
                          description="Archivos o referencias vinculadas al encuentro clínico."
                        />
                        <PrevitalCardContent className="space-y-3">
                          {bundle.attachments.length ? (
                            bundle.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="rounded-2xl border border-slate-200 bg-[#F8F7F4] p-4"
                              >
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                  <FileText className="h-4 w-4 text-[#5E8F6C]" />
                                  {attachment.file_name}
                                </div>
                                <p className="mt-2 break-all text-xs text-slate-500">
                                  {attachment.file_url}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {attachment.mime_type || "Tipo no especificado"} · {formatDateTime(attachment.created_at)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                              No hay anexos registrados para este encuentro.
                            </div>
                          )}
                        </PrevitalCardContent>
                      </PrevitalCard>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8F7F4] p-5 text-sm text-slate-500">
                    Selecciona un encuentro para revisar la historia clínica.
                  </div>
                )}
              </PrevitalCardContent>
            </PrevitalCard>
          </div>
        </div>
      </div>
    </main>
  );
}
