"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUserRole } from "@/lib/auth";
import SessionBadge from "@/components/session-badge";
import { parseStoredCommercialNotes } from "@/lib/commercial/notes";
import {
  inferCommercialTeam,
  getCommercialTeamLabel,
  type CommercialTeamKey,
} from "@/lib/commercial/team";
import { resolveCommissionGroupCode } from "@/lib/commissions/group-code";

type AdminCommercialCase = {
  id: string;
  customer_name: string;
  phone: string | null;
  city: string | null;
  created_at: string;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  net_commission_base: number | null;
  gross_bonus_base: number | null;
  counts_for_commercial_bonus: boolean | null;
  payment_method: string | null;
  assigned_commercial_user_id: string | null;
  commission_source_type: string | null;
  opc_user_id: string | null;
  call_user_id: string | null;
  lead_id: string | null;
  sale_origin_type: string | null;
  commercial_notes: string | null;
};

type ProfileOption = {
  id: string;
  full_name: string;
  employee_code?: string | null;
  commission_group_code?: string | null;
  job_title: string | null;
  is_active: boolean | null;
  department_id?: string | null;
  department_names?: string[];
  role_names?: Array<{ code: string | null; name: string | null }>;
};

type CommissionEntry = {
  caseId: string;
  customerName: string;
  phone: string | null;
  createdAt: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryArea: string;
  commissionKind:
    | "opc"
    | "supervisor_opc"
    | "tmk"
    | "supervisor_call"
    | "comercial"
    | "gerencia_comercial";
  sourceType: string | null;
  saleOriginType: "lead" | "directo";
  isQ: boolean;
  hasSale: boolean;
  volume: number;
  cash: number;
  portfolio: number;
  baseNeta: number;
  fixedCommission: number;
  saleCommission: number;
  totalCommission: number;
};

type CollaboratorOption = {
  id: string;
  name: string;
  area: string;
  teamKey: CommercialTeamKey | null;
  groupCode: string | null;
  isActive: boolean;
};

type BonusRow = {
  collaboratorId: string;
  collaboratorName: string;
  teamKey: CommercialTeamKey | null;
  bonusBase: number;
  individualBonus: number;
  groupBonus: number;
  totalBonus: number;
};

type CaseCorrectionState = {
  caseId: string;
  customerName: string;
  assignedCommercialUserId: string;
  commissionSourceType: string;
  opcUserId: string;
  callUserId: string;
  saleOriginType: "lead" | "directo";
};

const allowedRoles = [
  "super_user",
  "administrador",
  "promotor_opc",
  "supervisor_opc",
  "tmk",
  "supervisor_call_center",
  "confirmador",
  "comercial",
  "gerencia_comercial",
];

function hoyISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inicioMesISO() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-CO")}`;
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

function commissionSourceLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    otro: "Otro",
  };

  if (!value) return "Sin definir";
  return map[value] || value;
}

function commissionKindLabel(value: CommissionEntry["commissionKind"]) {
  if (value === "opc") return "OPC";
  if (value === "supervisor_opc") return "Supervisor OPC";
  if (value === "tmk") return "TMK";
  if (value === "supervisor_call") return "Supervisor Call";
  if (value === "comercial") return "Comercial";
  return "Gerencia comercial";
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function normalizeArea(jobTitle: string | null | undefined) {
  const value = normalizeText(jobTitle);

  if (!value) return "Sin rol";
  if (value.includes("supervisor") && value.includes("opc")) return "Supervisor OPC";
  if (value.includes("supervisor") && value.includes("call")) return "Supervisor Call";
  if (value.includes("confirmador")) return "Call center";
  if (value.includes("promotor") || value === "opc" || value.includes(" opc")) return "OPC";
  if (value.includes("call center") || value === "call" || value.includes("call")) return "Call center";
  if (value.includes("tmk")) return "TMK";
  if (value.includes("gerencia comercial") || value.includes("gerente comercial")) return "Gerencia comercial";
  if (value.includes("comercial")) return "Comercial";
  if (value.includes("admin")) return "Administrador";

  return jobTitle || "Sin rol";
}

function getProfileDepartments(profile: ProfileOption | null | undefined) {
  return (profile?.department_names || []).filter(Boolean);
}

function getPrimaryProfileRole(profile: ProfileOption | null | undefined) {
  return (profile?.role_names || []).find(
    (item) => normalizeText(item?.code) || normalizeText(item?.name)
  ) || null;
}

function getCollaboratorArea(profile: ProfileOption | null | undefined) {
  const primaryRole = getPrimaryProfileRole(profile);
  const roleCode = normalizeText(primaryRole?.code);
  const roleName = normalizeText(primaryRole?.name);

  if (roleCode === "promotor_opc") return "OPC";
  if (roleCode === "supervisor_opc") return "Supervisor OPC";
  if (roleCode === "tmk") return "TMK";
  if (roleCode === "supervisor_call_center") return "Supervisor Call";
  if (roleCode === "confirmador") return "Call center";
  if (roleCode === "comercial") return "Comercial";
  if (roleCode === "gerencia_comercial" || roleCode === "gerente_comercial") {
    return "Gerencia comercial";
  }
  if (roleCode === "administrador" || roleCode === "super_user") return "Administrador";

  if (roleName.includes("promotor opc")) return "OPC";
  if (roleName.includes("supervisor opc")) return "Supervisor OPC";
  if (roleName === "tmk") return "TMK";
  if (roleName.includes("supervisor call")) return "Supervisor Call";
  if (roleName.includes("confirmador")) return "Call center";
  if (roleName.includes("gerencia comercial") || roleName.includes("gerente comercial")) {
    return "Gerencia comercial";
  }
  if (roleName.includes("comercial")) return "Comercial";
  if (roleName.includes("administrador")) return "Administrador";

  return normalizeArea(profile?.job_title);
}

function inferSaleOriginType(caseItem: AdminCommercialCase): "lead" | "directo" {
  if (caseItem.sale_origin_type === "lead" || caseItem.sale_origin_type === "directo") {
    return caseItem.sale_origin_type;
  }

  if (caseItem.lead_id || caseItem.commission_source_type === "base") {
    return "lead";
  }

  return "directo";
}

function extractInitialClassification(value: string | null | undefined) {
  const receptionSummary = parseStoredCommercialNotes(value).receptionSummary;
  const normalized = normalizeText(receptionSummary);
  const match = normalized.match(/clasificacion inicial:\s*(q|no q)/);
  if (!match) return null;
  return match[1] === "q" ? "Q" : "No Q";
}

function hasRealSale(caseItem: AdminCommercialCase) {
  return (
    Number(caseItem.volume_amount || 0) > 0 ||
    Number(caseItem.cash_amount || 0) > 0 ||
    Number(caseItem.portfolio_amount || 0) > 0
  );
}

function isCaseQ(caseItem: AdminCommercialCase) {
  if (hasRealSale(caseItem)) return true;
  return extractInitialClassification(caseItem.commercial_notes) === "Q";
}

function matchesCommissionQuickFilter(caseItem: AdminCommercialCase, quickFilter: string) {
  if (!quickFilter) return true;
  if (quickFilter === "opc") return Boolean(caseItem.opc_user_id);
  if (quickFilter === "tmk") return Boolean(caseItem.call_user_id);
  return (caseItem.commission_source_type || "") === quickFilter;
}

function getCommercialRate(baseNeta: number) {
  if (baseNeta <= 500000) return 0.05;
  if (baseNeta <= 1200000) return 0.06;
  if (baseNeta <= 2300000) return 0.07;
  if (baseNeta <= 3000000) return 0.1;
  if (baseNeta <= 4000000) return 0.12;
  return 0.15;
}

function getCommercialIndividualBonus(total: number) {
  if (total >= 52000000) return 3000000;
  if (total >= 42000000) return 2100000;
  if (total >= 32000000) return 1500000;
  if (total >= 27000000) return 1000000;
  if (total >= 21000000) return 600000;
  return 0;
}

function getCommissionAreaFromRole(roleCode: string | null | undefined) {
  if (roleCode === "promotor_opc") return "OPC";
  if (roleCode === "supervisor_opc") return "Supervisor OPC";
  if (roleCode === "tmk") return "TMK";
  if (roleCode === "supervisor_call_center") return "Supervisor Call";
  if (roleCode === "confirmador") return "Call center";
  if (roleCode === "comercial") return "Comercial";
  if (roleCode === "gerencia_comercial") return "Gerencia comercial";
  return "";
}

function buildCommissionEntries(
  caseItem: AdminCommercialCase,
  profileMap: Map<string, ProfileOption>
): CommissionEntry[] {
  const entries: CommissionEntry[] = [];
  const volume = Number(caseItem.volume_amount || 0);
  const cash = Number(caseItem.cash_amount || 0);
  const portfolio = Number(caseItem.portfolio_amount || 0);
  const baseNeta = Number(caseItem.net_commission_base || 0);
  const saleOriginType = inferSaleOriginType(caseItem);
  const sourceType = caseItem.commission_source_type || null;
  const hasSale = hasRealSale(caseItem);
  const isQ = isCaseQ(caseItem);

  if (caseItem.opc_user_id) {
    const opcProfile = profileMap.get(caseItem.opc_user_id);
    const fixedCommission =
      saleOriginType === "directo" ? (isQ ? 10000 : 0) : isQ ? 5000 : 1000;
    const saleCommission = hasSale
      ? baseNeta * (saleOriginType === "directo" ? 0.02 : 0.01)
      : 0;

    entries.push({
      caseId: caseItem.id,
      customerName: caseItem.customer_name,
      phone: caseItem.phone,
      createdAt: caseItem.created_at,
      beneficiaryId: caseItem.opc_user_id,
      beneficiaryName: opcProfile?.full_name || "OPC sin asignar",
      beneficiaryArea: normalizeArea(opcProfile?.job_title),
      commissionKind: "opc",
      sourceType,
      saleOriginType,
      isQ,
      hasSale,
      volume,
      cash,
      portfolio,
      baseNeta,
      fixedCommission,
      saleCommission,
      totalCommission: fixedCommission + saleCommission,
    });
  }

  if (caseItem.call_user_id) {
    const callProfile = profileMap.get(caseItem.call_user_id);
    const isBase = sourceType === "base";
    const fixedCommission = isQ ? (isBase ? 10000 : 5000) : 0;
    const saleCommission = hasSale ? baseNeta * (isBase ? 0.02 : 0.01) : 0;

    entries.push({
      caseId: caseItem.id,
      customerName: caseItem.customer_name,
      phone: caseItem.phone,
      createdAt: caseItem.created_at,
      beneficiaryId: caseItem.call_user_id,
      beneficiaryName: callProfile?.full_name || "TMK sin asignar",
      beneficiaryArea: normalizeArea(callProfile?.job_title),
      commissionKind: "tmk",
      sourceType,
      saleOriginType,
      isQ,
      hasSale,
      volume,
      cash,
      portfolio,
      baseNeta,
      fixedCommission,
      saleCommission,
      totalCommission: fixedCommission + saleCommission,
    });
  }

  return entries;
}

const panelClass =
  "rounded-[32px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.97)_0%,_rgba(247,252,248,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(95,125,102,0.12)]";

const inputClass =
  "w-full rounded-2xl border border-[#CFE4D8] bg-white/92 px-4 py-3 text-[#24312A] shadow-sm outline-none transition focus:border-[#7FA287] focus:ring-4 focus:ring-[#DDEFE4]";

const commissionSourceQuickFilters = [
  { value: "", label: "Todos" },
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "base", label: "Base" },
  { value: "redes", label: "Redes" },
  { value: "otro", label: "Otro" },
];

const commissionSourceOptions = [
  { value: "base", label: "Base" },
  { value: "opc", label: "OPC" },
  { value: "tmk", label: "TMK" },
  { value: "redes", label: "Redes" },
  { value: "otro", label: "Otro" },
];

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(245,252,247,0.96)_100%)] p-5 shadow-[0_18px_40px_rgba(95,125,102,0.12)]">
      <div className="mb-3 h-1.5 w-full rounded-full bg-gradient-to-r from-[#C7EEE1] via-[#8CB88D] to-[#4F7B63]" />
      <p className="text-sm font-medium text-[#5B6E63]">{title}</p>
      <p className="mt-2 text-[1.6rem] font-bold leading-tight tracking-tight text-[#24312A] md:text-[1.85rem]">
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-[#607368] md:text-xs">{subtitle}</p>
    </div>
  );
}

export default function AdminComisionesPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentRoleCode, setCurrentRoleCode] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [cases, setCases] = useState<AdminCommercialCase[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState(inicioMesISO());
  const [dateTo, setDateTo] = useState(hoyISO());
  const [search, setSearch] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [commissionSourceFilter, setCommissionSourceFilter] = useState("");
  const [goalAm, setGoalAm] = useState("150000000");
  const [goalPm, setGoalPm] = useState("150000000");
  const [showInactive, setShowInactive] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseCorrectionState | null>(null);
  const [savingCorrection, setSavingCorrection] = useState(false);

  async function validarAcceso() {
    try {
      setLoadingAuth(true);
      setError("");

      const auth = await getCurrentUserRole();

      if (!auth.user || !auth.roleCode) {
        setAuthorized(false);
        setError("Debes iniciar sesión para usar este módulo.");
        return;
      }

      if (!allowedRoles.includes(auth.roleCode)) {
        setAuthorized(false);
        setError("No tienes permiso para entrar a Comisiones.");
        return;
      }

      setCurrentRoleCode(auth.roleCode);
      setCurrentUserId(auth.user.id);
      setAuthorized(true);
    } catch (err: any) {
      setAuthorized(false);
      setError(err?.message || "No se pudo validar el acceso.");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function cargarDatos() {
    try {
      setLoading(true);
      setError("");

      const [casesResult, profilesResult, departmentsResult, userRolesResult] = await Promise.all([
        supabase
          .from("commercial_cases")
          .select(`
            id,
            customer_name,
            phone,
            city,
            created_at,
            volume_amount,
            cash_amount,
            portfolio_amount,
            net_commission_base,
            gross_bonus_base,
            counts_for_commercial_bonus,
            payment_method,
            assigned_commercial_user_id,
            commission_source_type,
            opc_user_id,
            call_user_id,
            lead_id,
            sale_origin_type,
            commercial_notes
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, employee_code, commission_group_code, job_title, is_active, department_id")
          .order("full_name", { ascending: true }),
        supabase.from("departments").select("id, name"),
        supabase.from("user_roles").select(`
          user_id,
          roles (
            code,
            name
          )
        `),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (userRolesResult.error) throw userRolesResult.error;

      const departmentMap = new Map<string, string>();
      ((departmentsResult.data as Array<{ id: string; name: string | null }> | null) || []).forEach(
        (item) => {
          if (item?.id) {
            departmentMap.set(item.id, item.name || "");
          }
        }
      );

      const rolesByUser = new Map<string, Array<{ code: string | null; name: string | null }>>();
      (
        (userRolesResult.data as
          | Array<{
              user_id: string;
              roles:
                | { code: string | null; name: string | null }
                | Array<{ code: string | null; name: string | null }>
                | null;
            }>
          | null) || []
      ).forEach((item) => {
        if (!item?.user_id) return;
        const current = rolesByUser.get(item.user_id) || [];
        const roleItems = Array.isArray(item.roles)
          ? item.roles
          : item.roles
            ? [item.roles]
            : [];

        roleItems.forEach((role) => {
          current.push({
            code: role?.code || null,
            name: role?.name || null,
          });
        });

        rolesByUser.set(item.user_id, current);
      });

      setCases((casesResult.data as AdminCommercialCase[]) || []);
      setProfiles(
        (((profilesResult.data as ProfileOption[] | null) || []).map((profile) => ({
          ...profile,
          department_names: profile.department_id
            ? [departmentMap.get(profile.department_id) || ""].filter(Boolean)
            : [],
          role_names: rolesByUser.get(profile.id) || [],
        })) as ProfileOption[]) || []
      );
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los datos de comisiones.");
    } finally {
      setLoading(false);
    }
  }

  function abrirCorreccion(caseItem: AdminCommercialCase) {
    setEditingCase({
      caseId: caseItem.id,
      customerName: caseItem.customer_name,
      assignedCommercialUserId: caseItem.assigned_commercial_user_id || "",
      commissionSourceType: caseItem.commission_source_type || "otro",
      opcUserId: caseItem.opc_user_id || "",
      callUserId: caseItem.call_user_id || "",
      saleOriginType: inferSaleOriginType(caseItem),
    });
    setError("");
  }

  async function guardarCorreccion() {
    if (!editingCase) return;

    try {
      setSavingCorrection(true);
      setError("");

      const payload = {
        assigned_commercial_user_id: editingCase.assignedCommercialUserId || null,
        commission_source_type: editingCase.commissionSourceType || null,
        opc_user_id: editingCase.opcUserId || null,
        call_user_id: editingCase.callUserId || null,
        sale_origin_type: editingCase.saleOriginType,
      };

      const { error: updateError } = await supabase
        .from("commercial_cases")
        .update(payload)
        .eq("id", editingCase.caseId);

      if (updateError) throw updateError;

      await cargarDatos();
      setEditingCase(null);
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la corrección del caso.");
    } finally {
      setSavingCorrection(false);
    }
  }

  useEffect(() => {
    void validarAcceso();
  }, []);

  useEffect(() => {
    if (authorized) {
      void cargarDatos();
    }
  }, [authorized]);

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileOption>();
    profiles.forEach((item) => map.set(item.id, item));
    return map;
  }, [profiles]);

  const caseMap = useMemo(() => {
    const map = new Map<string, AdminCommercialCase>();
    cases.forEach((item) => map.set(item.id, item));
    return map;
  }, [cases]);

  const collaboratorOptions = useMemo(() => {
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.full_name || "Sin nombre",
      area: getCollaboratorArea(profile),
      teamKey: inferCommercialTeam({
        full_name: profile.full_name,
        job_title: profile.job_title,
        role_name:
          getPrimaryProfileRole(profile)?.name || getPrimaryProfileRole(profile)?.code || "",
        departments: getProfileDepartments(profile).map((name) => ({ name })),
      }),
      groupCode: resolveCommissionGroupCode({
        commissionGroupCode: profile.commission_group_code,
        employeeCode: profile.employee_code,
      }),
      isActive: profile.is_active !== false,
    }));
  }, [profiles]);

  const isAdminView = currentRoleCode === "super_user" || currentRoleCode === "administrador";
  const commissionAreaForRole = useMemo(
    () => getCommissionAreaFromRole(currentRoleCode),
    [currentRoleCode]
  );
  const isSelfScopedRole =
    currentRoleCode === "promotor_opc" ||
    currentRoleCode === "tmk" ||
    currentRoleCode === "comercial";
  const isTeamScopedRole =
    currentRoleCode === "supervisor_opc" ||
    currentRoleCode === "supervisor_call_center" ||
    currentRoleCode === "confirmador" ||
    currentRoleCode === "gerencia_comercial";
  const canSeeCommercialBonuses =
    isAdminView || currentRoleCode === "comercial" || currentRoleCode === "gerencia_comercial";
  const canManageInactiveFilter = isAdminView || isTeamScopedRole;
  const effectiveAreaFilter =
    isAdminView || isSelfScopedRole ? areaFilter || commissionAreaForRole || "" : "";
  const effectiveCollaboratorFilter =
    isAdminView || isSelfScopedRole
      ? collaboratorFilter || currentUserId || ""
      : isTeamScopedRole
        ? collaboratorFilter
        : "";
  const effectiveShowInactive = canManageInactiveFilter ? showInactive : false;

  const visibleCollaboratorOptions = useMemo(() => {
    if (effectiveShowInactive) return collaboratorOptions;
    return collaboratorOptions.filter((item) => item.isActive);
  }, [collaboratorOptions, effectiveShowInactive]);

  const collaboratorOptionMap = useMemo(() => {
    const map = new Map<string, CollaboratorOption>();
    collaboratorOptions.forEach((item) => map.set(item.id, item));
    return map;
  }, [collaboratorOptions]);
  const currentCollaborator = currentUserId ? collaboratorOptionMap.get(currentUserId) || null : null;

  const teamScopedCollaboratorLabel = useMemo(() => {
    if (currentRoleCode === "supervisor_opc") return "OPC";
    if (currentRoleCode === "supervisor_call_center" || currentRoleCode === "confirmador") return "TMK";
    if (currentRoleCode === "gerencia_comercial") return "Comercial";
    return "Colaborador";
  }, [currentRoleCode]);

  const teamScopedEmptyLabel = useMemo(() => {
    if (currentRoleCode === "supervisor_opc") {
      return "No encontramos OPC activos asignados a tu equipo.";
    }
    if (currentRoleCode === "supervisor_call_center" || currentRoleCode === "confirmador") {
      return "No encontramos TMK activos asignados a tu equipo.";
    }
    if (currentRoleCode === "gerencia_comercial") {
      return "No encontramos comerciales activos asignados a tu equipo.";
    }
    return "No encontramos colaboradores en tu equipo.";
  }, [currentRoleCode]);

  useEffect(() => {
    if (!authorized || !currentUserId || isAdminView) return;

    if (isSelfScopedRole) {
      setAreaFilter((current) => current || commissionAreaForRole);
      setCollaboratorFilter((current) => current || currentUserId);
      return;
    }

    if (isTeamScopedRole) {
      setAreaFilter("");
      return;
    }

    setAreaFilter("");
    setCollaboratorFilter("");
  }, [
    authorized,
    currentUserId,
    isAdminView,
    commissionAreaForRole,
    isSelfScopedRole,
    isTeamScopedRole,
  ]);

  const commercialOptions = useMemo(() => {
    return visibleCollaboratorOptions.filter((item) =>
      ["Comercial", "Gerencia comercial"].includes(item.area)
    );
  }, [visibleCollaboratorOptions]);

  const opcOptions = useMemo(() => {
    return visibleCollaboratorOptions.filter((item) =>
      ["OPC", "Supervisor OPC"].includes(item.area)
    );
  }, [visibleCollaboratorOptions]);

  const tmkOptions = useMemo(() => {
    return visibleCollaboratorOptions.filter((item) =>
      ["TMK", "Call center", "Supervisor Call"].includes(item.area)
    );
  }, [visibleCollaboratorOptions]);

  const supervisorOpcOptions = useMemo(() => {
    return collaboratorOptions.filter((item) => item.area === "Supervisor OPC");
  }, [collaboratorOptions]);

  const supervisorCallOptions = useMemo(() => {
    return collaboratorOptions.filter((item) => item.area === "Supervisor Call");
  }, [collaboratorOptions]);

  const managerByTeam = useMemo(() => {
    const map = new Map<CommercialTeamKey, CollaboratorOption>();

    collaboratorOptions.forEach((item) => {
      if (item.area !== "Gerencia comercial" || !item.teamKey) return;
      if (!map.has(item.teamKey)) {
        map.set(item.teamKey, item);
      }
    });

    return map;
  }, [collaboratorOptions]);

  const supervisorOpcByTeam = useMemo(() => {
    const map = new Map<string, CollaboratorOption>();
    supervisorOpcOptions.forEach((item) => {
      if (item.teamKey && !map.has(item.teamKey)) {
        map.set(item.teamKey, item);
      }
    });
    return map;
  }, [supervisorOpcOptions]);

  const supervisorOpcByGroup = useMemo(() => {
    const map = new Map<string, CollaboratorOption>();
    supervisorOpcOptions.forEach((item) => {
      if (item.groupCode && !map.has(item.groupCode)) {
        map.set(item.groupCode, item);
      }
    });
    return map;
  }, [supervisorOpcOptions]);

  const supervisorCallByTeam = useMemo(() => {
    const map = new Map<string, CollaboratorOption>();
    supervisorCallOptions.forEach((item) => {
      if (item.teamKey && !map.has(item.teamKey)) {
        map.set(item.teamKey, item);
      }
    });
    return map;
  }, [supervisorCallOptions]);

  const supervisorCallByGroup = useMemo(() => {
    const map = new Map<string, CollaboratorOption>();
    supervisorCallOptions.forEach((item) => {
      if (item.groupCode && !map.has(item.groupCode)) {
        map.set(item.groupCode, item);
      }
    });
    return map;
  }, [supervisorCallOptions]);

  const fallbackSupervisorOpc =
    supervisorOpcOptions.length === 1 ? supervisorOpcOptions[0] : null;
  const fallbackSupervisorCall =
    supervisorCallOptions.length === 1 ? supervisorCallOptions[0] : null;
  const resolvedCurrentGroupCode = currentCollaborator?.groupCode || null;
  const resolvedCurrentTeamKey = useMemo(() => {
    if (currentCollaborator?.teamKey) return currentCollaborator.teamKey;

    if (currentRoleCode === "supervisor_opc") {
      const mappedTeam = Array.from(supervisorOpcByTeam.entries()).find(
        ([, item]) => item.id === currentUserId
      )?.[0];
      if (mappedTeam === "am" || mappedTeam === "pm") return mappedTeam;
      if (fallbackSupervisorOpc?.teamKey) return fallbackSupervisorOpc.teamKey;
    }

    if (currentRoleCode === "supervisor_call_center" || currentRoleCode === "confirmador") {
      const mappedTeam = Array.from(supervisorCallByTeam.entries()).find(
        ([, item]) => item.id === currentUserId
      )?.[0];
      if (mappedTeam === "am" || mappedTeam === "pm") return mappedTeam;
      if (fallbackSupervisorCall?.teamKey) return fallbackSupervisorCall.teamKey;
    }

    if (currentRoleCode === "gerencia_comercial") {
      const mappedTeam = Array.from(managerByTeam.entries()).find(
        ([, item]) => item.id === currentUserId
      )?.[0];
      if (mappedTeam === "am" || mappedTeam === "pm") return mappedTeam;
      if (managerByTeam.size === 1) {
        const onlyTeam = Array.from(managerByTeam.keys())[0];
        if (onlyTeam === "am" || onlyTeam === "pm") return onlyTeam;
      }
    }

    return null;
  }, [
    currentCollaborator?.teamKey,
    currentRoleCode,
    currentUserId,
    supervisorOpcByTeam,
    supervisorCallByTeam,
    fallbackSupervisorOpc?.teamKey,
    fallbackSupervisorCall?.teamKey,
    managerByTeam,
  ]);

  const areaOptions = useMemo(() => {
    const unique = new Set<string>();

    visibleCollaboratorOptions.forEach((item) => {
      if (item.area) unique.add(item.area);
    });

    return Array.from(unique).sort((a, b) => a.localeCompare(b, "es"));
  }, [visibleCollaboratorOptions]);

  const teamScopedCollaboratorOptions = useMemo(() => {
    const hasSupervisorScope =
      currentRoleCode === "supervisor_opc" ||
      currentRoleCode === "supervisor_call_center" ||
      currentRoleCode === "confirmador"
        ? Boolean(resolvedCurrentGroupCode || resolvedCurrentTeamKey)
        : Boolean(resolvedCurrentTeamKey);

    if (!isTeamScopedRole || !hasSupervisorScope) return [];

    if (currentRoleCode === "supervisor_opc") {
      if (resolvedCurrentGroupCode) {
        return visibleCollaboratorOptions.filter(
          (item) => item.area === "OPC" && item.groupCode === resolvedCurrentGroupCode
        );
      }

      return visibleCollaboratorOptions.filter(
        (item) => item.area === "OPC" && item.teamKey === resolvedCurrentTeamKey
      );
    }

    if (currentRoleCode === "supervisor_call_center" || currentRoleCode === "confirmador") {
      if (resolvedCurrentGroupCode) {
        return visibleCollaboratorOptions.filter(
          (item) =>
            ["TMK", "Call center"].includes(item.area) &&
            item.groupCode === resolvedCurrentGroupCode
        );
      }

      return visibleCollaboratorOptions.filter(
        (item) =>
          ["TMK", "Call center"].includes(item.area) &&
          item.teamKey === resolvedCurrentTeamKey
      );
    }

    if (currentRoleCode === "gerencia_comercial") {
      return visibleCollaboratorOptions.filter(
        (item) => item.area === "Comercial" && item.teamKey === resolvedCurrentTeamKey
      );
    }

    return [];
  }, [
    resolvedCurrentGroupCode,
    resolvedCurrentTeamKey,
    currentRoleCode,
    isTeamScopedRole,
    visibleCollaboratorOptions,
  ]);

  const filteredCollaboratorOptions = useMemo(() => {
    if (isTeamScopedRole) {
      return teamScopedCollaboratorOptions;
    }

    const baseOptions = visibleCollaboratorOptions;
    if (!effectiveAreaFilter) return baseOptions;
    return baseOptions.filter((item) => item.area === effectiveAreaFilter);
  }, [isTeamScopedRole, teamScopedCollaboratorOptions, visibleCollaboratorOptions, effectiveAreaFilter]);

  useEffect(() => {
    if ((!isAdminView && !isTeamScopedRole) || !collaboratorFilter) return;

    const stillExists = filteredCollaboratorOptions.some(
      (item) => item.id === collaboratorFilter
    );

    if (!stillExists) {
      setCollaboratorFilter("");
    }
  }, [isAdminView, isTeamScopedRole, collaboratorFilter, filteredCollaboratorOptions]);

  const casosFiltrados = useMemo(() => {
    const q = normalizeText(search);
    const selectedCollaborator = effectiveCollaboratorFilter
      ? collaboratorOptionMap.get(effectiveCollaboratorFilter) || null
      : null;

    return cases.filter((item) => {
      const createdDate = item.created_at?.slice(0, 10) || "";
      const commercialProfile = item.assigned_commercial_user_id
        ? profileMap.get(item.assigned_commercial_user_id)
        : null;
        const opcProfile = item.opc_user_id ? profileMap.get(item.opc_user_id) : null;
        const callProfile = item.call_user_id ? profileMap.get(item.call_user_id) : null;
        const opcGroupCode = item.opc_user_id
          ? collaboratorOptionMap.get(item.opc_user_id)?.groupCode || null
          : null;
        const callGroupCode = item.call_user_id
          ? collaboratorOptionMap.get(item.call_user_id)?.groupCode || null
          : null;
        const collaboratorName = commercialProfile?.full_name || "";
      const collaboratorArea = getCollaboratorArea(commercialProfile);
      const collaboratorTeam = inferCommercialTeam({
        full_name: commercialProfile?.full_name,
        job_title: commercialProfile?.job_title,
        role_name:
          getPrimaryProfileRole(commercialProfile)?.name ||
          getPrimaryProfileRole(commercialProfile)?.code ||
          "",
        departments: getProfileDepartments(commercialProfile).map((name) => ({ name })),
      });
      const opcName = item.opc_user_id ? profileMap.get(item.opc_user_id)?.full_name || "" : "";
      const callName = item.call_user_id ? profileMap.get(item.call_user_id)?.full_name || "" : "";
      const opcArea = getCollaboratorArea(opcProfile);
      const callArea = getCollaboratorArea(callProfile);
      const callTeam = callProfile
        ? inferCommercialTeam({
            full_name: callProfile.full_name,
            job_title: callProfile.job_title,
            role_name:
              getPrimaryProfileRole(callProfile)?.name ||
              getPrimaryProfileRole(callProfile)?.code ||
              "",
            departments: getProfileDepartments(callProfile).map((name) => ({ name })),
          })
        : null;

      const collaboratorAreaForFilter = areaFilter || selectedCollaborator?.area || "";
      const matchesDateFrom = dateFrom ? createdDate >= dateFrom : true;
      const matchesDateTo = dateTo ? createdDate <= dateTo : true;
      const matchesRoleScope = isAdminView
        ? true
        : currentRoleCode === "promotor_opc"
          ? item.opc_user_id === currentUserId
          : currentRoleCode === "tmk"
            ? item.call_user_id === currentUserId
            : currentRoleCode === "comercial"
              ? item.assigned_commercial_user_id === currentUserId
              : currentRoleCode === "supervisor_opc"
                ? Boolean(
                    (
                        (opcGroupCode
                          ? supervisorOpcByGroup.get(opcGroupCode)
                          : opcProfile
                        ? supervisorOpcByTeam.get(
                            inferCommercialTeam({
                              full_name: opcProfile.full_name,
                              job_title: opcProfile.job_title,
                              role_name:
                                getPrimaryProfileRole(opcProfile)?.name ||
                                getPrimaryProfileRole(opcProfile)?.code ||
                                "",
                              departments: getProfileDepartments(opcProfile).map((name) => ({
                                name,
                              })),
                            }) || ""
                          )
                        : null) || fallbackSupervisorOpc
                    )?.id === currentUserId
                  )
                : currentRoleCode === "confirmador"
                  ? Boolean(
                      resolvedCurrentGroupCode
                        ? callGroupCode === resolvedCurrentGroupCode
                        : resolvedCurrentTeamKey && callTeam === resolvedCurrentTeamKey
                    )
                : currentRoleCode === "supervisor_call_center"
                  ? Boolean(
                      (
                        (callGroupCode
                          ? supervisorCallByGroup.get(callGroupCode)
                          : callProfile
                          ? supervisorCallByTeam.get(
                              inferCommercialTeam({
                                full_name: callProfile.full_name,
                                job_title: callProfile.job_title,
                                role_name:
                                  getPrimaryProfileRole(callProfile)?.name ||
                                  getPrimaryProfileRole(callProfile)?.code ||
                                  "",
                                departments: getProfileDepartments(callProfile).map((name) => ({
                                  name,
                                })),
                              }) || ""
                            )
                          : null) || fallbackSupervisorCall
                      )?.id === currentUserId
                    )
                  : currentRoleCode === "gerencia_comercial"
                    ? Boolean(resolvedCurrentTeamKey && collaboratorTeam === resolvedCurrentTeamKey)
                    : true;
      const matchesCollaborator = effectiveCollaboratorFilter
        ? collaboratorAreaForFilter === "Gerencia comercial"
          ? Boolean(selectedCollaborator?.teamKey && collaboratorTeam === selectedCollaborator.teamKey)
          : collaboratorAreaForFilter === "Supervisor OPC"
            ? Boolean(
                (
                  (opcProfile
                    ? supervisorOpcByTeam.get(
                        inferCommercialTeam({
                          full_name: opcProfile.full_name,
                          job_title: opcProfile.job_title,
                          role_name:
                            getPrimaryProfileRole(opcProfile)?.name ||
                            getPrimaryProfileRole(opcProfile)?.code ||
                            "",
                          departments: getProfileDepartments(opcProfile).map((name) => ({
                            name,
                          })),
                        }) || ""
                      )
                    : null) || fallbackSupervisorOpc
                )?.id === effectiveCollaboratorFilter
              )
            : collaboratorAreaForFilter === "Supervisor Call"
              ? Boolean(
                  (
                    (callProfile
                      ? supervisorCallByTeam.get(
                          inferCommercialTeam({
                            full_name: callProfile.full_name,
                            job_title: callProfile.job_title,
                            role_name:
                              getPrimaryProfileRole(callProfile)?.name ||
                              getPrimaryProfileRole(callProfile)?.code ||
                              "",
                            departments: getProfileDepartments(callProfile).map((name) => ({
                              name,
                            })),
                          }) || ""
                        )
                      : null) || fallbackSupervisorCall
                  )?.id === effectiveCollaboratorFilter
                )
          : collaboratorAreaForFilter === "Comercial"
            ? item.assigned_commercial_user_id === effectiveCollaboratorFilter
            : collaboratorAreaForFilter === "OPC" || collaboratorAreaForFilter === "Supervisor OPC"
              ? item.opc_user_id === effectiveCollaboratorFilter
              : collaboratorAreaForFilter === "TMK" ||
                  collaboratorAreaForFilter === "Call center" ||
                  collaboratorAreaForFilter === "Supervisor Call"
                ? item.call_user_id === effectiveCollaboratorFilter
                : [
                    item.assigned_commercial_user_id || "",
                    item.opc_user_id || "",
                    item.call_user_id || "",
                  ].includes(effectiveCollaboratorFilter)
        : true;
      const matchesArea = effectiveAreaFilter
        ? effectiveAreaFilter === "Gerencia comercial"
          ? Boolean(collaboratorTeam)
          : effectiveAreaFilter === "Supervisor OPC"
            ? Boolean(item.opc_user_id)
            : effectiveAreaFilter === "Supervisor Call"
              ? Boolean(item.call_user_id)
          : [collaboratorArea, opcArea, callArea].includes(effectiveAreaFilter)
        : true;
      const matchesCommissionSource = matchesCommissionQuickFilter(item, commissionSourceFilter);
      const matchesSearch = q
        ? normalizeText(item.customer_name).includes(q) ||
          normalizeText(item.phone).includes(q) ||
          normalizeText(item.city).includes(q) ||
          normalizeText(collaboratorName).includes(q) ||
          normalizeText(opcName).includes(q) ||
          normalizeText(callName).includes(q)
        : true;

      return (
        matchesDateFrom &&
        matchesDateTo &&
        matchesRoleScope &&
        matchesCollaborator &&
        matchesArea &&
        matchesCommissionSource &&
        matchesSearch
      );
    });
  }, [
    cases,
    profileMap,
    dateFrom,
    dateTo,
    effectiveCollaboratorFilter,
    collaboratorOptionMap,
    effectiveAreaFilter,
    commissionSourceFilter,
    search,
    supervisorOpcByTeam,
    supervisorCallByTeam,
    supervisorOpcByGroup,
    supervisorCallByGroup,
    fallbackSupervisorOpc,
    fallbackSupervisorCall,
    isAdminView,
    currentRoleCode,
    currentUserId,
    currentCollaborator,
    resolvedCurrentGroupCode,
    resolvedCurrentTeamKey,
  ]);

  const commissionEntries = useMemo(() => {
    const rawEntries = casosFiltrados.flatMap((item) => buildCommissionEntries(item, profileMap));

    casosFiltrados.forEach((item) => {
      const saleOriginType = inferSaleOriginType(item);
      const sourceType = item.commission_source_type || null;
      const isQ = isCaseQ(item);
      const hasSale = hasRealSale(item);
      const volume = Number(item.volume_amount || 0);
      const cash = Number(item.cash_amount || 0);
      const portfolio = Number(item.portfolio_amount || 0);
      const baseNeta = Number(item.net_commission_base || 0);

      if (item.opc_user_id) {
        const opc = collaboratorOptionMap.get(item.opc_user_id);
        const supervisorOpc =
          (opc?.groupCode ? supervisorOpcByGroup.get(opc.groupCode) : null) ||
          (opc?.teamKey ? supervisorOpcByTeam.get(opc.teamKey) : null) ||
          fallbackSupervisorOpc;

        if (supervisorOpc) {
          const fixedCommission = isQ
            ? saleOriginType === "directo"
              ? 6000
              : 3000
            : 0;
          const saleCommission = hasSale
            ? baseNeta * (saleOriginType === "directo" ? 0.02 : 0.01)
            : 0;

          rawEntries.push({
            caseId: item.id,
            customerName: item.customer_name,
            phone: item.phone,
            createdAt: item.created_at,
            beneficiaryId: supervisorOpc.id,
            beneficiaryName: supervisorOpc.name,
            beneficiaryArea: supervisorOpc.area,
            commissionKind: "supervisor_opc",
            sourceType,
            saleOriginType,
            isQ,
            hasSale,
            volume,
            cash,
            portfolio,
            baseNeta,
            fixedCommission,
            saleCommission,
            totalCommission: fixedCommission + saleCommission,
          });
        }
      }

      if (item.call_user_id) {
        const call = collaboratorOptionMap.get(item.call_user_id);
        const supervisorCall =
          (call?.groupCode ? supervisorCallByGroup.get(call.groupCode) : null) ||
          (call?.teamKey ? supervisorCallByTeam.get(call.teamKey) : null) ||
          fallbackSupervisorCall;

        if (supervisorCall) {
          const isBase = sourceType === "base";
          const fixedCommission = isQ ? (isBase ? 6000 : 3000) : 0;
          const saleCommission = hasSale ? baseNeta * (isBase ? 0.02 : 0.01) : 0;

          rawEntries.push({
            caseId: item.id,
            customerName: item.customer_name,
            phone: item.phone,
            createdAt: item.created_at,
            beneficiaryId: supervisorCall.id,
            beneficiaryName: supervisorCall.name,
            beneficiaryArea: supervisorCall.area,
            commissionKind: "supervisor_call",
            sourceType,
            saleOriginType,
            isQ,
            hasSale,
            volume,
            cash,
            portfolio,
            baseNeta,
            fixedCommission,
            saleCommission,
            totalCommission: fixedCommission + saleCommission,
          });
        }
      }

      if (!hasRealSale(item) || !item.assigned_commercial_user_id) return;

      const commercial = collaboratorOptionMap.get(item.assigned_commercial_user_id);
      const teamKey = commercial?.teamKey || null;
      const manager = teamKey ? managerByTeam.get(teamKey) : null;

      rawEntries.push({
        caseId: item.id,
        customerName: item.customer_name,
        phone: item.phone,
        createdAt: item.created_at,
        beneficiaryId: item.assigned_commercial_user_id,
        beneficiaryName: commercial?.name || "Comercial sin asignar",
        beneficiaryArea: commercial?.area || "Comercial",
        commissionKind: "comercial",
        sourceType: item.commission_source_type || null,
        saleOriginType: inferSaleOriginType(item),
        isQ: isCaseQ(item),
        hasSale: true,
        volume: Number(item.volume_amount || 0),
        cash: Number(item.cash_amount || 0),
        portfolio: Number(item.portfolio_amount || 0),
        baseNeta,
        fixedCommission: 0,
        saleCommission: baseNeta * getCommercialRate(baseNeta),
        totalCommission: baseNeta * getCommercialRate(baseNeta),
      });

      if (manager) {
        const managerCommission = baseNeta * 0.035;
        rawEntries.push({
          caseId: item.id,
          customerName: item.customer_name,
          phone: item.phone,
          createdAt: item.created_at,
          beneficiaryId: manager.id,
          beneficiaryName: manager.name,
          beneficiaryArea: manager.area,
          commissionKind: "gerencia_comercial",
          sourceType: item.commission_source_type || null,
          saleOriginType: inferSaleOriginType(item),
          isQ: isCaseQ(item),
          hasSale: true,
          volume: Number(item.volume_amount || 0),
          cash: Number(item.cash_amount || 0),
          portfolio: Number(item.portfolio_amount || 0),
          baseNeta,
          fixedCommission: 0,
          saleCommission: managerCommission,
          totalCommission: managerCommission,
        });
      }
    });

    return rawEntries.filter((item) => {
      const matchesArea = areaFilter
          ? effectiveAreaFilter === "Comercial"
            ? item.commissionKind === "comercial"
          : effectiveAreaFilter === "Gerencia comercial"
            ? item.commissionKind === "gerencia_comercial"
            : effectiveAreaFilter === "OPC" || effectiveAreaFilter === "Supervisor OPC"
              ? effectiveAreaFilter === "Supervisor OPC"
                ? item.commissionKind === "supervisor_opc"
                : item.commissionKind === "opc"
              : effectiveAreaFilter === "TMK" ||
                  effectiveAreaFilter === "Call center" ||
                  effectiveAreaFilter === "Supervisor Call"
                ? effectiveAreaFilter === "Supervisor Call"
                  ? item.commissionKind === "supervisor_call"
                  : item.commissionKind === "tmk"
                : true
        : true;
      const matchesCollaborator = effectiveCollaboratorFilter
        ? item.beneficiaryId === effectiveCollaboratorFilter
        : true;

      return matchesArea && matchesCollaborator;
    });
  }, [
    casosFiltrados,
    profileMap,
    collaboratorOptionMap,
    managerByTeam,
    effectiveAreaFilter,
    effectiveCollaboratorFilter,
    supervisorOpcByTeam,
    supervisorCallByTeam,
    supervisorOpcByGroup,
    supervisorCallByGroup,
    fallbackSupervisorOpc,
    fallbackSupervisorCall,
  ]);

  const scopedCommissionEntries = useMemo(() => {
    if (isAdminView || isSelfScopedRole) {
      return commissionEntries;
    }

    if (currentRoleCode === "supervisor_opc") {
      return commissionEntries.filter((item) => {
        if (item.commissionKind === "supervisor_opc") {
          return item.beneficiaryId === currentUserId;
        }

        if (item.commissionKind !== "opc") return false;

        return casosFiltrados.some(
          (caseItem) => caseItem.id === item.caseId && caseItem.opc_user_id === item.beneficiaryId
        );
      });
    }

    if (currentRoleCode === "supervisor_call_center" || currentRoleCode === "confirmador") {
      return commissionEntries.filter((item) => {
        if (item.commissionKind === "supervisor_call") {
          return item.beneficiaryId === currentUserId;
        }

        if (item.commissionKind !== "tmk") return false;

        return casosFiltrados.some(
          (caseItem) => caseItem.id === item.caseId && caseItem.call_user_id === item.beneficiaryId
        );
      });
    }

    if (currentRoleCode === "gerencia_comercial") {
      return commissionEntries.filter((item) => {
        if (!currentCollaborator?.teamKey) return false;
        const scopedTeamKey = resolvedCurrentTeamKey;
        if (!scopedTeamKey) return false;

        if (item.commissionKind === "gerencia_comercial") {
          return item.beneficiaryId === currentUserId;
        }

        const beneficiary = collaboratorOptionMap.get(item.beneficiaryId);
        return beneficiary?.teamKey === scopedTeamKey;
      });
    }

    return commissionEntries;
  }, [
    commissionEntries,
    isAdminView,
    isSelfScopedRole,
    currentRoleCode,
    currentUserId,
    casosFiltrados,
    collaboratorOptionMap,
    resolvedCurrentTeamKey,
  ]);

  const ventasFiltradas = useMemo(() => {
    const visibleCaseIds = new Set(
      scopedCommissionEntries.filter((item) => item.hasSale).map((item) => item.caseId)
    );

    if (visibleCaseIds.size === 0 && !effectiveAreaFilter && !effectiveCollaboratorFilter) {
      return casosFiltrados.filter((item) => hasRealSale(item));
    }

    return casosFiltrados.filter((item) => hasRealSale(item) && visibleCaseIds.has(item.id));
  }, [casosFiltrados, scopedCommissionEntries, effectiveAreaFilter, effectiveCollaboratorFilter]);

  const bonusRows = useMemo(() => {
    if (
      !canSeeCommercialBonuses ||
      effectiveAreaFilter === "OPC" ||
      effectiveAreaFilter === "Supervisor OPC" ||
      effectiveAreaFilter === "TMK" ||
      effectiveAreaFilter === "Call center" ||
      effectiveAreaFilter === "Supervisor Call" ||
      effectiveAreaFilter === "Gerencia comercial"
    ) {
      return [];
    }

    const selectedCollaborator = effectiveCollaboratorFilter
      ? collaboratorOptionMap.get(effectiveCollaboratorFilter) || null
      : null;

    if (
      selectedCollaborator &&
      !["Comercial", "Gerencia comercial"].includes(selectedCollaborator.area)
    ) {
      return [];
    }

    const byCommercial = new Map<string, BonusRow>();
    const teamTotals = new Map<CommercialTeamKey, number>();

    ventasFiltradas.forEach((item) => {
      if (!item.assigned_commercial_user_id) return;
      if (!item.counts_for_commercial_bonus) return;

      const commercial = collaboratorOptionMap.get(item.assigned_commercial_user_id);
      const teamKey = commercial?.teamKey || null;
      const bonusBase = Number(item.gross_bonus_base || item.volume_amount || 0);

      if (!byCommercial.has(item.assigned_commercial_user_id)) {
        byCommercial.set(item.assigned_commercial_user_id, {
          collaboratorId: item.assigned_commercial_user_id,
          collaboratorName: commercial?.name || "Comercial sin asignar",
          teamKey,
          bonusBase: 0,
          individualBonus: 0,
          groupBonus: 0,
          totalBonus: 0,
        });
      }

      const current = byCommercial.get(item.assigned_commercial_user_id)!;
      current.bonusBase += bonusBase;

      if (teamKey) {
        teamTotals.set(teamKey, (teamTotals.get(teamKey) || 0) + bonusBase);
      }
    });

    byCommercial.forEach((item) => {
      item.individualBonus = getCommercialIndividualBonus(item.bonusBase);
    });

    const metaAm = Number(goalAm || 0);
    const metaPm = Number(goalPm || 0);

    (["am", "pm"] as CommercialTeamKey[]).forEach((teamKey) => {
      const teamTarget = teamKey === "am" ? metaAm : metaPm;
      const teamTotal = teamTotals.get(teamKey) || 0;
      if (!teamTarget || teamTotal < teamTarget) return;

      const winner = Array.from(byCommercial.values())
        .filter((item) => item.teamKey === teamKey)
        .sort((a, b) => b.bonusBase - a.bonusBase)[0];

      if (winner) {
        winner.groupBonus += 1000000;
      }
    });

    return Array.from(byCommercial.values())
      .map((item) => ({
        ...item,
        totalBonus: item.individualBonus + item.groupBonus,
      }))
      .filter((item) =>
        effectiveCollaboratorFilter ? item.collaboratorId === effectiveCollaboratorFilter : true
      )
      .filter((item) => item.totalBonus > 0 || item.bonusBase > 0)
      .sort((a, b) => b.totalBonus - a.totalBonus || b.bonusBase - a.bonusBase);
  }, [
    ventasFiltradas,
    collaboratorOptionMap,
    goalAm,
    goalPm,
    effectiveAreaFilter,
    effectiveCollaboratorFilter,
    canSeeCommercialBonuses,
  ]);

  const resumen = useMemo(() => {
    const totalBonos = bonusRows.reduce((acc, item) => acc + item.totalBonus, 0);
    return {
      total: ventasFiltradas.length,
      volumen: ventasFiltradas.reduce((acc, item) => acc + Number(item.volume_amount || 0), 0),
      caja: ventasFiltradas.reduce((acc, item) => acc + Number(item.cash_amount || 0), 0),
      baseNeta: ventasFiltradas.reduce((acc, item) => acc + Number(item.net_commission_base || 0), 0),
      bonosTotal: totalBonos,
      comisionTotal:
        scopedCommissionEntries.reduce((acc, item) => acc + item.totalCommission, 0) + totalBonos,
    };
  }, [ventasFiltradas, scopedCommissionEntries, bonusRows]);

  const resumenPorColaborador = useMemo(() => {
    const map = new Map<
      string,
      {
        collaboratorId: string;
        collaboratorName: string;
        area: string;
        tipoComision: string;
        casosQ: number;
        ventas: number;
        fijo: number;
        variable: number;
        bono: number;
        baseNeta: number;
        totalComision: number;
      }
    >();

    scopedCommissionEntries.forEach((item) => {
      const collaboratorId = item.beneficiaryId;

      if (!map.has(collaboratorId)) {
        map.set(collaboratorId, {
          collaboratorId,
          collaboratorName: item.beneficiaryName,
          area: item.beneficiaryArea,
          tipoComision: commissionKindLabel(item.commissionKind),
          casosQ: 0,
          ventas: 0,
          fijo: 0,
          variable: 0,
          bono: 0,
          baseNeta: 0,
          totalComision: 0,
        });
      }

      const current = map.get(collaboratorId)!;
      if (item.isQ) current.casosQ += 1;
      if (item.hasSale) current.ventas += 1;
      current.fijo += item.fixedCommission;
      current.variable += item.saleCommission;
      current.baseNeta += item.baseNeta;
      current.totalComision += item.totalCommission;
    });

    bonusRows.forEach((item) => {
      if (!map.has(item.collaboratorId)) {
        const profile = collaboratorOptionMap.get(item.collaboratorId);
        map.set(item.collaboratorId, {
          collaboratorId: item.collaboratorId,
          collaboratorName: item.collaboratorName,
          area: profile?.area || "Comercial",
          tipoComision: profile?.area === "Gerencia comercial" ? "Gerencia comercial" : "Comercial",
          casosQ: 0,
          ventas: 0,
          fijo: 0,
          variable: 0,
          bono: 0,
          baseNeta: 0,
          totalComision: 0,
        });
      }

      const current = map.get(item.collaboratorId)!;
      current.bono += item.totalBonus;
      current.totalComision += item.totalBonus;
    });

    return Array.from(map.values()).sort((a, b) => b.totalComision - a.totalComision);
  }, [scopedCommissionEntries, bonusRows, collaboratorOptionMap]);

  if (loadingAuth) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className={`mx-auto max-w-7xl ${panelClass}`}>
          <p className="text-sm font-medium text-[#607368]">Validando acceso...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#EEFBF4_0%,_#F8FBF7_36%,_#FFFCF8_100%)] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-[32px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(150,102,95,0.12)]">
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
              <p className="inline-flex rounded-full border border-[#CFE4D8] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#5F7D66] shadow-sm">
                {isAdminView ? "Admin" : "Comisiones"}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#1F3128] md:text-[3rem]">
                {isAdminView ? "Comisiones" : "Mis comisiones"}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#496356] md:text-[15px]">
                {isAdminView
                  ? "Vista separada para revisar base neta, ventas y comisiones por colaborador."
                  : "Consulta en tiempo real tu fijo, variable, bonos y total según el rango filtrado."}
              </p>
            </div>

            <SessionBadge />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={isAdminView ? "/admin" : "/"}
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              {isAdminView ? "Volver a admin" : "Inicio"}
            </a>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/85 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Actualizar
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-[26px] border border-[#E6C9C5] bg-[linear-gradient(180deg,_rgba(255,250,249,0.98)_0%,_rgba(255,243,241,0.98)_100%)] p-4 text-sm text-[#9A4E43] shadow-[0_16px_32px_rgba(150,102,95,0.08)]">
            {error}
          </div>
        ) : null}

        <section className={panelClass}>
          <div
            className={`grid gap-4 md:grid-cols-2 ${
              isAdminView || isTeamScopedRole ? "xl:grid-cols-4" : "xl:grid-cols-3"
            }`}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Desde</label>
              <input
                className={inputClass}
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Hasta</label>
              <input
                className={inputClass}
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {isAdminView ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Área o rol</label>
                  <select
                    className={inputClass}
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {areaOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {isAdminView || isTeamScopedRole ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {isAdminView ? "Colaborador" : `${teamScopedCollaboratorLabel} del equipo`}
                </label>
                <select
                  className={inputClass}
                  value={collaboratorFilter}
                  onChange={(e) => setCollaboratorFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  {filteredCollaboratorOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.isActive ? "" : " (Inhabilitado)"}
                    </option>
                  ))}
                </select>
                {isTeamScopedRole && filteredCollaboratorOptions.length === 0 ? (
                  <p className="mt-2 text-xs leading-5 text-[#7A8A81]">
                    {teamScopedEmptyLabel}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Buscar</label>
              <input
                className={inputClass}
                placeholder="Cliente o colaborador"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {isAdminView ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Meta grupo AM</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={goalAm}
                    onChange={(e) => setGoalAm(e.target.value.replace(/\D/g, ""))}
                    placeholder="150000000"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Meta grupo PM</label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={goalPm}
                    onChange={(e) => setGoalPm(e.target.value.replace(/\D/g, ""))}
                    placeholder="150000000"
                  />
                </div>
              </>
            ) : null}
          </div>

          {canManageInactiveFilter ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#A8CDB5] text-[#4F7B63] focus:ring-[#DDEFE4]"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Incluir inhabilitados
              </label>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm text-[#4F6F5B] shadow-sm">
              {isTeamScopedRole
                ? "Mostrando las comisiones del equipo a tu cargo."
                : "Mostrando solo tus comisiones."}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setDateFrom(hoyISO());
                setDateTo(hoyISO());
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFrom(inicioMesISO());
                setDateTo(hoyISO());
                setAreaFilter(isAdminView || isTeamScopedRole ? "" : commissionAreaForRole);
                setCollaboratorFilter(isAdminView || isTeamScopedRole ? "" : currentUserId || "");
                setCommissionSourceFilter("");
                setSearch("");
              }}
              className="rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-3 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {commissionSourceQuickFilters.map((item) => {
              const isActive = commissionSourceFilter === item.value;

              return (
                <button
                  key={item.value || "all"}
                  type="button"
                  onClick={() => setCommissionSourceFilter(item.value)}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] text-white shadow-[0_14px_28px_rgba(95,125,102,0.18)]"
                      : "border border-[#CFE4D8] bg-white/88 text-[#4F6F5B] shadow-sm hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Ventas" value={String(resumen.total)} subtitle="Ventas reales filtradas" />
          <StatCard title="Volumen" value={formatMoney(resumen.volumen)} subtitle="Suma filtrada" />
          <StatCard title="Caja" value={formatMoney(resumen.caja)} subtitle="Pago recibido" />
          <StatCard title="Base neta" value={formatMoney(resumen.baseNeta)} subtitle="Base comisionable" />
          <StatCard title="Bonos" value={formatMoney(resumen.bonosTotal)} subtitle="Total mensual calculado" />
          <StatCard title="Comisión" value={formatMoney(resumen.comisionTotal)} subtitle="Total calculado" />
        </section>

        {(isAdminView || commissionAreaForRole === "Comercial" || commissionAreaForRole === "Gerencia comercial") && (
          <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Bonos comerciales mensuales</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Bonos individuales por volumen bruto y bono grupal para el #1 de AM o PM cuando el equipo cumple meta.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Cargando bonos...
            </div>
          ) : bonusRows.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              No hay bonos para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-[12px] leading-5 md:text-[13px]">
                <thead>
                  <tr className="border-b border-[#D7EADF] text-left text-xs uppercase tracking-[0.14em] text-[#5B6E63]">
                    <th className="px-3 py-3">Colaborador</th>
                    <th className="px-3 py-3">Equipo</th>
                    <th className="px-3 py-3">Base bono</th>
                    <th className="px-3 py-3">Bono individual</th>
                    <th className="px-3 py-3">Bono grupal</th>
                    <th className="px-3 py-3">Total bono</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusRows.map((item) => (
                    <tr key={item.collaboratorId} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.collaboratorName}</td>
                      <td className="px-3 py-3 text-slate-700">{getCommercialTeamLabel(item.teamKey)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.bonusBase)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.individualBonus)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.groupBonus)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalBonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </section>
        )}

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Resumen por colaborador</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Agrupado según la comisión calculada para el rango filtrado.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Cargando resumen...
            </div>
          ) : resumenPorColaborador.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              No hay datos para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-[12px] leading-5 md:text-[13px]">
                <thead>
                  <tr className="border-b border-[#D7EADF] text-left text-xs uppercase tracking-[0.14em] text-[#5B6E63]">
                    <th className="px-3 py-3">Colaborador</th>
                    <th className="px-3 py-3">Área</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Casos Q</th>
                    <th className="px-3 py-3">Ventas</th>
                    <th className="px-3 py-3">Fijo</th>
                    <th className="px-3 py-3">Venta</th>
                    <th className="px-3 py-3">Bono</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Total comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenPorColaborador.map((item) => (
                    <tr key={item.collaboratorId} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-medium text-slate-900">{item.collaboratorName}</td>
                      <td className="px-3 py-3 text-slate-700">{item.area}</td>
                      <td className="px-3 py-3 text-slate-700">{item.tipoComision}</td>
                      <td className="px-3 py-3 text-slate-700">{item.casosQ}</td>
                      <td className="px-3 py-3 text-slate-700">{item.ventas}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.fijo)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.variable)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.bono)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatMoney(item.baseNeta)}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalComision)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Detalle de comisión calculada</h2>
              <p className="mt-1 text-sm text-[#607368]">
                Una fila por beneficiario con su fijo, variable y total.
              </p>
            </div>
          </div>

          {isAdminView && editingCase ? (
            <div className="mt-5 rounded-[28px] border border-[#CFE4D8] bg-[linear-gradient(180deg,_rgba(247,252,248,0.96)_0%,_rgba(255,255,255,0.98)_100%)] p-5 shadow-[0_14px_32px_rgba(95,125,102,0.10)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[#24312A]">
                    Corregir caso: {editingCase.customerName}
                  </h3>
                  <p className="text-sm text-[#607368]">
                    Ajusta comercial, fuente, OPC, TMK y si fue lead o directo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingCase(null)}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/88 px-4 py-2 text-sm font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7]"
                >
                  Cerrar editor
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Comercial</label>
                  <select
                    className={inputClass}
                    value={editingCase.assignedCommercialUserId}
                    onChange={(e) =>
                      setEditingCase((current) =>
                        current
                          ? { ...current, assignedCommercialUserId: e.target.value }
                          : current
                      )
                    }
                  >
                    <option value="">Sin asignar</option>
                    {commercialOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Fuente comisión</label>
                  <select
                    className={inputClass}
                    value={editingCase.commissionSourceType}
                    onChange={(e) =>
                      setEditingCase((current) =>
                        current
                          ? { ...current, commissionSourceType: e.target.value }
                          : current
                      )
                    }
                  >
                    {commissionSourceOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">OPC</label>
                  <select
                    className={inputClass}
                    value={editingCase.opcUserId}
                    onChange={(e) =>
                      setEditingCase((current) =>
                        current ? { ...current, opcUserId: e.target.value } : current
                      )
                    }
                  >
                    <option value="">Sin OPC</option>
                    {opcOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">TMK / Call center</label>
                  <select
                    className={inputClass}
                    value={editingCase.callUserId}
                    onChange={(e) =>
                      setEditingCase((current) =>
                        current ? { ...current, callUserId: e.target.value } : current
                      )
                    }
                  >
                    <option value="">Sin TMK</option>
                    {tmkOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Origen venta</label>
                  <select
                    className={inputClass}
                    value={editingCase.saleOriginType}
                    onChange={(e) =>
                      setEditingCase((current) =>
                        current
                          ? {
                              ...current,
                              saleOriginType: e.target.value as "lead" | "directo",
                            }
                          : current
                      )
                    }
                  >
                    <option value="lead">Lead</option>
                    <option value="directo">Directo</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void guardarCorreccion()}
                  disabled={savingCorrection}
                  className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#5F7D66_0%,_#7FA287_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(95,125,102,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingCorrection ? "Guardando..." : "Guardar corrección"}
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              Cargando detalle...
            </div>
          ) : scopedCommissionEntries.length === 0 ? (
            <div className="mt-5 rounded-[26px] border border-dashed border-[#CFE4D8] bg-[#F7FCF8] p-6 text-sm text-[#607368]">
              No hay comisiones para esos filtros.
            </div>
          ) : (
            <div className="mt-5 overflow-auto">
              <table className="min-w-full text-[12px] leading-5 md:text-[13px]">
                <thead>
                  <tr className="border-b border-[#D7EADF] text-left text-xs uppercase tracking-[0.14em] text-[#5B6E63]">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Beneficiario</th>
                    <th className="px-3 py-3">Área</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Fuente</th>
                    <th className="px-3 py-3">Origen</th>
                    <th className="px-3 py-3">Q</th>
                    <th className="px-3 py-3">Base neta</th>
                    <th className="px-3 py-3">Fijo</th>
                    <th className="px-3 py-3">Venta</th>
                    <th className="px-3 py-3">Total</th>
                    <th className="px-3 py-3">Corregir</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedCommissionEntries.map((item) => {
                    const caseItem = caseMap.get(item.caseId);

                    return (
                      <tr
                        key={`${item.caseId}-${item.commissionKind}-${item.beneficiaryId}`}
                        className="border-b border-slate-100 align-top"
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{item.customerName}</div>
                          <div className="text-slate-500">{item.phone || "Sin teléfono"}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatDateTime(item.createdAt)}</td>
                        <td className="px-3 py-3 text-slate-700">{item.beneficiaryName}</td>
                        <td className="px-3 py-3 text-slate-700">{item.beneficiaryArea}</td>
                        <td className="px-3 py-3 text-slate-700">{commissionKindLabel(item.commissionKind)}</td>
                        <td className="px-3 py-3 text-slate-700">{commissionSourceLabel(item.sourceType)}</td>
                        <td className="px-3 py-3 text-slate-700">
                          {item.saleOriginType === "directo" ? "Directo" : "Lead"}
                        </td>
                        <td className="px-3 py-3 text-slate-700">{item.isQ ? "Q" : "No Q"}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.baseNeta)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.fixedCommission)}</td>
                        <td className="px-3 py-3 text-slate-700">{formatMoney(item.saleCommission)}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{formatMoney(item.totalCommission)}</td>
                        <td className="px-3 py-3">
                          {isAdminView ? (
                            <button
                              type="button"
                              onClick={() => caseItem && abrirCorreccion(caseItem)}
                              disabled={!caseItem}
                              className="inline-flex items-center justify-center rounded-2xl border border-[#CFE4D8] bg-white/88 px-3 py-2 text-xs font-medium text-[#4F6F5B] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9BC4AF] hover:bg-[#F5FCF7] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Editar caso
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Solo admin</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}


