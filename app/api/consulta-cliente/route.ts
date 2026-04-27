import { NextResponse } from "next/server";

import {
  canUseCustomerConsult,
  getCustomerConsultSessionContext,
  type CustomerConsultScope,
} from "@/lib/customers/access";
import {
  inferCommercialTeam,
  type CommercialTeamKey,
} from "@/lib/commercial/team";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createRouteHandlerSupabaseClient } from "@/lib/server/supabase-server";
import { getErrorMessage } from "@/lib/server/user-security";

type ProfileContext = {
  id: string;
  full_name: string | null;
  job_title: string | null;
  is_active: boolean;
  department_names: string[];
  role_codes: string[];
  role_names: string[];
  team_key: CommercialTeamKey | null;
};

type DepartmentRelation =
  | { name: string | null }
  | Array<{ name: string | null }>
  | null
  | undefined;

type CommercialCaseRow = {
  id: string;
  reception_code: string | null;
  support_code: string | null;
  lead_id: string | null;
  appointment_id: string | null;
  customer_name: string;
  phone: string | null;
  city: string | null;
  status: string | null;
  created_at: string;
  assigned_commercial_user_id: string | null;
  assigned_by_user_id: string | null;
  sale_result: string | null;
  purchased_service: string | null;
  sale_value: number | null;
  volume_amount: number | null;
  cash_amount: number | null;
  portfolio_amount: number | null;
  payment_method: string | null;
  sale_origin_type: string | null;
  lead_source_type: string | null;
  commission_source_type: string | null;
  commercial_notes: string | null;
  sales_assessment: string | null;
  proposal_text: string | null;
  closing_notes: string | null;
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  interest_service: string | null;
  capture_location: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
  created_by_user_id: string | null;
  assigned_to_user_id: string | null;
};

type AppointmentRow = {
  id: string;
  lead_id: string | null;
  patient_name: string;
  phone: string | null;
  city: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service_type: string | null;
  notes: string | null;
  specialist_user_id: string | null;
};

type CustomerSummary = {
  ref: string;
  display_name: string;
  phone: string | null;
  city: string | null;
  origin_label: string;
  latest_status: string | null;
  latest_service: string | null;
  latest_created_at: string | null;
  has_lead: boolean;
  has_appointments: boolean;
  has_commercial_case: boolean;
};

type CustomerDetail = {
  ref: string;
  identity: {
    full_name: string;
    phone: string | null;
    city: string | null;
  };
  lead: {
    id: string;
    source: string | null;
    status: string | null;
    interest_service: string | null;
    capture_location: string | null;
    created_at: string;
    created_by_name: string | null;
  } | null;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
    service: string | null;
    city: string | null;
    notes: string | null;
  }>;
  commercial_cases: Array<{
      id: string;
      support_code: string | null;
      created_at: string;
    status: string | null;
    sale_result: string | null;
    purchased_service: string | null;
    sale_value: number | null;
    volume_amount: number | null;
    cash_amount: number | null;
    portfolio_amount: number | null;
    payment_method: string | null;
    sale_origin_type: string | null;
    lead_source_type: string | null;
    commission_source_type: string | null;
    commercial_name: string | null;
    assigned_by_name: string | null;
    commercial_notes: string | null;
    sales_assessment: string | null;
    proposal_text: string | null;
    closing_notes: string | null;
  }>;
};

function normalizeRoleCode(roleCode: string | null | undefined) {
  if (!roleCode) return null;

  return String(roleCode)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+(am|pm)$/i, "")
    .replace(/[\s-]+/g, "_");
}

function normalizeDigits(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeDepartmentNames(departments: DepartmentRelation) {
  const list = Array.isArray(departments)
    ? departments
    : departments && typeof departments === "object"
      ? [departments]
      : [];

  return list.map((item) => item?.name || "").filter(Boolean);
}

function customerRefFromData(data: {
  leadId?: string | null;
  phone?: string | null;
  caseId?: string | null;
  appointmentId?: string | null;
}) {
  if (data.leadId) return `lead:${data.leadId}`;

  const phoneDigits = normalizeDigits(data.phone);
  if (phoneDigits) return `phone:${phoneDigits}`;

  if (data.caseId) return `case:${data.caseId}`;
  if (data.appointmentId) return `appointment:${data.appointmentId}`;

  return `unknown:${crypto.randomUUID()}`;
}

function leadDisplayName(lead: LeadRow) {
  return (
    lead.full_name ||
    [lead.first_name || "", lead.last_name || ""].filter(Boolean).join(" ").trim() ||
    "Cliente sin nombre"
  );
}

function formatOriginLabel(input: {
  caseRow?: CommercialCaseRow;
  lead?: LeadRow;
}) {
  const source =
    input.caseRow?.commission_source_type ||
    input.caseRow?.lead_source_type ||
    input.lead?.source ||
    null;

  const map: Record<string, string> = {
    opc: "OPC",
    tmk: "TMK",
    redes: "Redes",
    base: "Base",
    referido: "Referido",
    otro: "Otro",
  };

  if (!source) return "Sin origen";
  return map[source] || source;
}

function buildProfileContexts(
  profiles: Array<{
    id: string;
    full_name: string | null;
    job_title: string | null;
    is_active: boolean | null;
    departments?: DepartmentRelation;
  }>,
  roleRows: Array<{
    user_id: string;
    roles?: { code?: string | null; name?: string | null } | null;
  }>
) {
  const roleMap = new Map<string, Array<{ code: string | null; name: string | null }>>();

  roleRows.forEach((row) => {
    const existing = roleMap.get(row.user_id) || [];
    existing.push({
      code: normalizeRoleCode(row.roles?.code || null),
      name: row.roles?.name || null,
    });
    roleMap.set(row.user_id, existing);
  });

  return profiles.map<ProfileContext>((profile) => {
    const roles = roleMap.get(profile.id) || [];
    const roleCodes = unique(roles.map((role) => role.code).filter(Boolean) as string[]);
    const roleNames = unique(roles.map((role) => role.name).filter(Boolean) as string[]);
    const departmentNames = normalizeDepartmentNames(profile.departments);

    return {
      id: profile.id,
      full_name: profile.full_name,
      job_title: profile.job_title,
      is_active: Boolean(profile.is_active),
      department_names: departmentNames,
      role_codes: roleCodes,
      role_names: roleNames,
      team_key: inferCommercialTeam({
        full_name: profile.full_name,
        job_title: profile.job_title,
        role_name: roleNames.join(" "),
        departments: departmentNames.map((name) => ({ name })),
      }),
    };
  });
}

function resolveAccessibleCommercialIds(
  scope: CustomerConsultScope,
  currentUserId: string,
  profiles: ProfileContext[]
) {
  if (scope === "full") return null;
  if (scope === "self") return [currentUserId];
  if (scope !== "team") return [];

  const currentProfile = profiles.find((profile) => profile.id === currentUserId);
  const currentTeam = currentProfile?.team_key || null;

  if (!currentTeam) return [];

  return profiles
    .filter(
      (profile) =>
        profile.is_active &&
        profile.team_key === currentTeam &&
        profile.role_codes.includes("comercial")
    )
    .map((profile) => profile.id);
}

const clinicalSelfRoleCodes = new Set([
  "nutricionista",
  "fisioterapeuta",
  "medico_general",
]);

function matchesPhoneDigits(value: string | null | undefined, digits: string) {
  return normalizeDigits(value) === digits;
}

function applySearchFilter<T extends { phone?: string | null; city?: string | null }>(
  items: T[],
  searchTerm: string,
  nameResolver: (item: T) => string
) {
  const normalizedSearch = normalizeText(searchTerm);
  const searchDigits = normalizeDigits(searchTerm);

  return items.filter((item) => {
    const nameMatch = normalizeText(nameResolver(item)).includes(normalizedSearch);
    const cityMatch = normalizeText(item.city).includes(normalizedSearch);
    const phoneMatch = searchDigits ? normalizeDigits(item.phone).includes(searchDigits) : false;
    return nameMatch || cityMatch || phoneMatch;
  });
}

function buildCustomerSummaries(params: {
  cases: CommercialCaseRow[];
  leads: LeadRow[];
  appointments: AppointmentRow[];
}) {
  const leadMap = new Map(params.leads.map((item) => [item.id, item]));
  const appointmentMap = new Map(params.appointments.map((item) => [item.id, item]));
  const summaryMap = new Map<string, CustomerSummary>();

  const ensureSummary = (ref: string, payload: Partial<CustomerSummary>) => {
    const existing = summaryMap.get(ref);
    if (!existing) {
      summaryMap.set(ref, {
        ref,
        display_name: payload.display_name || "Cliente sin nombre",
        phone: payload.phone || null,
        city: payload.city || null,
        origin_label: payload.origin_label || "Sin origen",
        latest_status: payload.latest_status || null,
        latest_service: payload.latest_service || null,
        latest_created_at: payload.latest_created_at || null,
        has_lead: Boolean(payload.has_lead),
        has_appointments: Boolean(payload.has_appointments),
        has_commercial_case: Boolean(payload.has_commercial_case),
      });
      return;
    }

    summaryMap.set(ref, {
      ...existing,
      display_name: existing.display_name || payload.display_name || "Cliente sin nombre",
      phone: existing.phone || payload.phone || null,
      city: existing.city || payload.city || null,
      origin_label:
        existing.origin_label !== "Sin origen"
          ? existing.origin_label
          : payload.origin_label || "Sin origen",
      latest_status: existing.latest_status || payload.latest_status || null,
      latest_service: existing.latest_service || payload.latest_service || null,
      latest_created_at: existing.latest_created_at || payload.latest_created_at || null,
      has_lead: existing.has_lead || Boolean(payload.has_lead),
      has_appointments: existing.has_appointments || Boolean(payload.has_appointments),
      has_commercial_case: existing.has_commercial_case || Boolean(payload.has_commercial_case),
    });
  };

  params.cases.forEach((caseRow) => {
    const linkedLead = caseRow.lead_id ? leadMap.get(caseRow.lead_id) || null : null;
    const linkedAppointment = caseRow.appointment_id
      ? appointmentMap.get(caseRow.appointment_id) || null
      : null;
    const ref = customerRefFromData({
      leadId: caseRow.lead_id,
      phone: caseRow.phone,
      caseId: caseRow.id,
      appointmentId: caseRow.appointment_id,
    });

    ensureSummary(ref, {
      display_name: caseRow.customer_name || linkedLead?.full_name || linkedAppointment?.patient_name,
      phone: caseRow.phone || linkedLead?.phone || linkedAppointment?.phone || null,
      city: caseRow.city || linkedLead?.city || linkedAppointment?.city || null,
      origin_label: formatOriginLabel({ caseRow, lead: linkedLead || undefined }),
      latest_status: caseRow.status || linkedAppointment?.status || linkedLead?.status || null,
      latest_service:
        caseRow.purchased_service || linkedAppointment?.service_type || linkedLead?.interest_service || null,
      latest_created_at: caseRow.created_at,
      has_lead: Boolean(caseRow.lead_id),
      has_appointments: Boolean(caseRow.appointment_id),
      has_commercial_case: true,
    });
  });

  params.leads.forEach((lead) => {
    const ref = customerRefFromData({ leadId: lead.id, phone: lead.phone });
    ensureSummary(ref, {
      display_name: leadDisplayName(lead),
      phone: lead.phone,
      city: lead.city,
      origin_label: formatOriginLabel({ lead }),
      latest_status: lead.status,
      latest_service: lead.interest_service,
      latest_created_at: lead.created_at,
      has_lead: true,
      has_appointments: params.appointments.some((item) => item.lead_id === lead.id),
      has_commercial_case: params.cases.some((item) => item.lead_id === lead.id),
    });
  });

  params.appointments.forEach((appointment) => {
    const ref = customerRefFromData({
      leadId: appointment.lead_id,
      phone: appointment.phone,
      appointmentId: appointment.id,
    });

    ensureSummary(ref, {
      display_name: appointment.patient_name,
      phone: appointment.phone,
      city: appointment.city,
      latest_status: appointment.status,
      latest_service: appointment.service_type,
      latest_created_at: `${appointment.appointment_date}T${appointment.appointment_time}:00`,
      has_appointments: true,
      has_commercial_case: params.cases.some(
        (item) => item.appointment_id === appointment.id || item.lead_id === appointment.lead_id
      ),
    });
  });

  return Array.from(summaryMap.values()).sort((a, b) => {
    return new Date(b.latest_created_at || 0).getTime() - new Date(a.latest_created_at || 0).getTime();
  });
}

function buildCustomerDetail(params: {
  ref: string;
  cases: CommercialCaseRow[];
  leads: LeadRow[];
  appointments: AppointmentRow[];
  profileMap: Map<string, ProfileContext>;
}) {
  if (!params.cases.length && !params.leads.length && !params.appointments.length) {
    return null;
  }

  const primaryCase = params.cases[0] || null;
  const primaryLead = params.leads[0] || null;
  const primaryAppointment = params.appointments[0] || null;

  const fullName =
    primaryCase?.customer_name ||
    (primaryLead ? leadDisplayName(primaryLead) : null) ||
    primaryAppointment?.patient_name ||
    "Cliente sin nombre";

  const phone = primaryCase?.phone || primaryLead?.phone || primaryAppointment?.phone || null;
  const city = primaryCase?.city || primaryLead?.city || primaryAppointment?.city || null;

  return {
    ref: params.ref,
    identity: {
      full_name: fullName,
      phone,
      city,
    },
    lead: primaryLead
      ? {
          id: primaryLead.id,
          source: primaryLead.source,
          status: primaryLead.status,
          interest_service: primaryLead.interest_service,
          capture_location: primaryLead.capture_location,
          created_at: primaryLead.created_at,
          created_by_name: primaryLead.created_by_user_id
            ? params.profileMap.get(primaryLead.created_by_user_id)?.full_name || null
            : null,
        }
      : null,
    appointments: params.appointments
      .slice()
      .sort((a, b) => {
        return (
          new Date(`${b.appointment_date}T${b.appointment_time}:00`).getTime() -
          new Date(`${a.appointment_date}T${a.appointment_time}:00`).getTime()
        );
      })
      .map((appointment) => ({
        id: appointment.id,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        status: appointment.status,
        service: appointment.service_type,
        city: appointment.city,
        notes: appointment.notes,
      })),
    commercial_cases: params.cases
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((caseRow) => ({
          id: caseRow.id,
          reception_code: caseRow.reception_code,
          support_code: caseRow.support_code,
          created_at: caseRow.created_at,
        status: caseRow.status,
        sale_result: caseRow.sale_result,
        purchased_service: caseRow.purchased_service,
        sale_value: caseRow.sale_value,
        volume_amount: caseRow.volume_amount,
        cash_amount: caseRow.cash_amount,
        portfolio_amount: caseRow.portfolio_amount,
        payment_method: caseRow.payment_method,
        sale_origin_type: caseRow.sale_origin_type,
        lead_source_type: caseRow.lead_source_type,
        commission_source_type: caseRow.commission_source_type,
        commercial_name: caseRow.assigned_commercial_user_id
          ? params.profileMap.get(caseRow.assigned_commercial_user_id)?.full_name || null
          : null,
        assigned_by_name: caseRow.assigned_by_user_id
          ? params.profileMap.get(caseRow.assigned_by_user_id)?.full_name || null
          : null,
        commercial_notes: caseRow.commercial_notes,
        sales_assessment: caseRow.sales_assessment,
        proposal_text: caseRow.proposal_text,
        closing_notes: caseRow.closing_notes,
      })),
  } satisfies CustomerDetail;
}

function resolveCustomerReferenceData(ref: string) {
  const [kind, rawValue] = ref.split(":", 2);
  return {
    kind,
    value: rawValue || "",
  };
}

export async function GET(request: Request) {
  const supabase = await createRouteHandlerSupabaseClient();
  const session = await getCustomerConsultSessionContext(supabase);

  if (!canUseCustomerConsult(session)) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar clientes." },
      { status: 403 }
    );
  }

  const currentSession = session!;
  const searchTerm = new URL(request.url).searchParams.get("q")?.trim() || "";
  const selectedRef = new URL(request.url).searchParams.get("ref")?.trim() || "";

  try {
    const [profilesResult, roleRowsResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, job_title, is_active, departments(name)"),
      supabaseAdmin
        .from("user_roles")
        .select(
          `
          user_id,
          roles (
            code,
            name
          )
        `
        ),
    ]);

    if (profilesResult.error) {
      throw profilesResult.error;
    }

    if (roleRowsResult.error) {
      throw roleRowsResult.error;
    }

    const profiles = buildProfileContexts(
      (profilesResult.data || []) as Array<{
        id: string;
        full_name: string | null;
        job_title: string | null;
        is_active: boolean | null;
        departments?: DepartmentRelation;
      }>,
      ((roleRowsResult.data as Array<{
        user_id: string;
        roles?: { code?: string | null; name?: string | null } | null;
      }>) || []).map((row) => ({
        user_id: row.user_id,
        roles: Array.isArray(row.roles) ? row.roles[0] : row.roles,
      }))
    );

    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const isClinicalSelfScope =
      currentSession.scope === "self" &&
      clinicalSelfRoleCodes.has(currentSession.effectiveRole || "");
    const accessibleCommercialIds = resolveAccessibleCommercialIds(
      currentSession.scope,
      currentSession.user.id,
      profiles
    );

    let appointmentRows: AppointmentRow[] = [];
    let specialistAppointmentIds: string[] = [];
    let specialistLeadIds: string[] = [];

    if (isClinicalSelfScope) {
      let specialistAppointmentsQuery = supabaseAdmin
        .from("appointments")
        .select(
          `
          id,
          lead_id,
          patient_name,
          phone,
          city,
          appointment_date,
          appointment_time,
          status,
          service_type,
          notes,
          specialist_user_id
        `
        )
        .eq("specialist_user_id", currentSession.user.id)
        .order("appointment_date", { ascending: false })
        .limit(searchTerm ? 120 : 60);

      if (searchTerm) {
        const normalizedDigits = normalizeDigits(searchTerm);
        const terms = [
          `patient_name.ilike.%${searchTerm}%`,
          `city.ilike.%${searchTerm}%`,
        ];

        if (normalizedDigits) {
          terms.push(`phone.ilike.%${normalizedDigits}%`);
        }

        specialistAppointmentsQuery = specialistAppointmentsQuery.or(terms.join(","));
      }

      const { data: specialistAppointments, error: specialistAppointmentsError } =
        await specialistAppointmentsQuery;

      if (specialistAppointmentsError) {
        throw specialistAppointmentsError;
      }

      appointmentRows = (specialistAppointments || []) as AppointmentRow[];
      specialistAppointmentIds = unique(
        appointmentRows.map((item) => item.id).filter(Boolean)
      );
      specialistLeadIds = unique(
        appointmentRows.map((item) => item.lead_id).filter(Boolean) as string[]
      );
    }

    let casesQuery = supabaseAdmin
      .from("commercial_cases")
        .select(
          `
        id,
        reception_code,
        support_code,
        lead_id,
        appointment_id,
        customer_name,
        phone,
        city,
        status,
        created_at,
        assigned_commercial_user_id,
        assigned_by_user_id,
        sale_result,
        purchased_service,
        sale_value,
        volume_amount,
        cash_amount,
        portfolio_amount,
        payment_method,
        sale_origin_type,
        lead_source_type,
        commission_source_type,
        commercial_notes,
        sales_assessment,
        proposal_text,
        closing_notes
      `
      )
      .order("created_at", { ascending: false })
      .limit(searchTerm ? 120 : 60);

    if (isClinicalSelfScope) {
      if (specialistAppointmentIds.length === 0 && specialistLeadIds.length === 0) {
        return NextResponse.json({
          items: [] as CustomerSummary[],
          detail: null,
          scope: currentSession.scope,
        });
      }

      if (specialistAppointmentIds.length > 0 && specialistLeadIds.length > 0) {
        casesQuery = casesQuery.or(
          `appointment_id.in.(${specialistAppointmentIds.join(",")}),lead_id.in.(${specialistLeadIds.join(",")})`
        );
      } else if (specialistAppointmentIds.length > 0) {
        casesQuery = casesQuery.in("appointment_id", specialistAppointmentIds);
      } else {
        casesQuery = casesQuery.in("lead_id", specialistLeadIds);
      }
    } else if (accessibleCommercialIds && currentSession.scope !== "full") {
      if (accessibleCommercialIds.length === 0) {
        return NextResponse.json({
          items: [] as CustomerSummary[],
          detail: null,
          scope: currentSession.scope,
        });
      }

      casesQuery = casesQuery.in("assigned_commercial_user_id", accessibleCommercialIds);
    }

    if (searchTerm) {
      const normalizedDigits = normalizeDigits(searchTerm);
      const terms = [
        `customer_name.ilike.%${searchTerm}%`,
        `city.ilike.%${searchTerm}%`,
      ];

      if (normalizedDigits) {
        terms.push(`phone.ilike.%${normalizedDigits}%`);
      }

      casesQuery = casesQuery.or(terms.join(","));
    }

    const { data: caseRows, error: caseError } = await casesQuery;

    if (caseError) {
      throw caseError;
    }

    const cases = (caseRows || []) as CommercialCaseRow[];
    const caseLeadIds = unique(cases.map((item) => item.lead_id).filter(Boolean) as string[]);
    const caseAppointmentIds = unique(
      cases.map((item) => item.appointment_id).filter(Boolean) as string[]
    );

    let leadRows: LeadRow[] = [];

    if (currentSession.scope === "full") {
      const [leadResult, appointmentResult] = await Promise.all([
        (() => {
          let query = supabaseAdmin
            .from("leads")
            .select(
              `
              id,
              first_name,
              last_name,
              full_name,
              phone,
              city,
              interest_service,
              capture_location,
              source,
              status,
              created_at,
              created_by_user_id,
              assigned_to_user_id
            `
            )
            .order("created_at", { ascending: false })
            .limit(searchTerm ? 80 : 30);

          if (searchTerm) {
            const normalizedDigits = normalizeDigits(searchTerm);
            const terms = [
              `full_name.ilike.%${searchTerm}%`,
              `first_name.ilike.%${searchTerm}%`,
              `last_name.ilike.%${searchTerm}%`,
              `city.ilike.%${searchTerm}%`,
            ];

            if (normalizedDigits) {
              terms.push(`phone.ilike.%${normalizedDigits}%`);
            }

            query = query.or(terms.join(","));
          }

          return query;
        })(),
        (() => {
          let query = supabaseAdmin
            .from("appointments")
            .select(
              `
              id,
              lead_id,
              patient_name,
              phone,
              city,
              appointment_date,
              appointment_time,
              status,
              service_type,
              notes,
              specialist_user_id
            `
            )
            .order("appointment_date", { ascending: false })
            .limit(searchTerm ? 80 : 30);

          if (searchTerm) {
            const normalizedDigits = normalizeDigits(searchTerm);
            const terms = [
              `patient_name.ilike.%${searchTerm}%`,
              `city.ilike.%${searchTerm}%`,
            ];

            if (normalizedDigits) {
              terms.push(`phone.ilike.%${normalizedDigits}%`);
            }

            query = query.or(terms.join(","));
          }

          return query;
        })(),
      ]);

      if (leadResult.error) throw leadResult.error;
      if (appointmentResult.error) throw appointmentResult.error;

      leadRows = (leadResult.data || []) as LeadRow[];
      appointmentRows = (appointmentResult.data || []) as AppointmentRow[];
    } else if (isClinicalSelfScope) {
      if (specialistLeadIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("leads")
          .select(
            `
            id,
            first_name,
            last_name,
            full_name,
            phone,
            city,
            interest_service,
            capture_location,
            source,
            status,
            created_at,
            created_by_user_id,
            assigned_to_user_id
          `
          )
          .in("id", specialistLeadIds);

        if (error) throw error;
        leadRows = (data || []) as LeadRow[];
      }
    } else {
      if (caseLeadIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("leads")
          .select(
            `
            id,
            first_name,
            last_name,
            full_name,
            phone,
            city,
            interest_service,
            capture_location,
            source,
            status,
            created_at,
            created_by_user_id,
            assigned_to_user_id
          `
          )
          .in("id", caseLeadIds);

        if (error) throw error;
        leadRows = (data || []) as LeadRow[];
      }

      if (caseAppointmentIds.length > 0 || caseLeadIds.length > 0) {
        let query = supabaseAdmin
          .from("appointments")
          .select(
            `
            id,
            lead_id,
            patient_name,
            phone,
            city,
            appointment_date,
            appointment_time,
            status,
            service_type,
            notes,
            specialist_user_id
          `
          )
          .order("appointment_date", { ascending: false });

        if (caseAppointmentIds.length > 0 && caseLeadIds.length > 0) {
          query = query.or(
            `id.in.(${caseAppointmentIds.join(",")}),lead_id.in.(${caseLeadIds.join(",")})`
          );
        } else if (caseAppointmentIds.length > 0) {
          query = query.in("id", caseAppointmentIds);
        } else if (caseLeadIds.length > 0) {
          query = query.in("lead_id", caseLeadIds);
        }

        const { data, error } = await query.limit(80);
        if (error) throw error;
        appointmentRows = (data || []) as AppointmentRow[];
      }
    }

    if (searchTerm && currentSession.scope !== "full") {
      leadRows = applySearchFilter(leadRows, searchTerm, leadDisplayName);
      appointmentRows = applySearchFilter(appointmentRows, searchTerm, (item) => item.patient_name);
    }

    const summaries = buildCustomerSummaries({
      cases,
      leads: leadRows,
      appointments: appointmentRows,
    });

    let detail: CustomerDetail | null = null;

    if (selectedRef) {
      const { kind, value } = resolveCustomerReferenceData(selectedRef);
      let detailCases = cases;
      let detailLeads = leadRows;
      let detailAppointments = appointmentRows;

      if (kind === "lead") {
        detailCases = cases.filter((item) => item.lead_id === value);
        detailLeads = leadRows.filter((item) => item.id === value);
        detailAppointments = appointmentRows.filter((item) => item.lead_id === value);
      } else if (kind === "phone") {
        detailCases = cases.filter((item) => matchesPhoneDigits(item.phone, value));
        detailLeads = leadRows.filter((item) => matchesPhoneDigits(item.phone, value));
        detailAppointments = appointmentRows.filter((item) => matchesPhoneDigits(item.phone, value));
      } else if (kind === "case") {
        detailCases = cases.filter((item) => item.id === value);
        const linkedLeadIds = unique(
          detailCases.map((item) => item.lead_id).filter(Boolean) as string[]
        );
        const linkedAppointmentIds = unique(
          detailCases.map((item) => item.appointment_id).filter(Boolean) as string[]
        );
        detailLeads = leadRows.filter((item) => linkedLeadIds.includes(item.id));
        detailAppointments = appointmentRows.filter(
          (item) => linkedAppointmentIds.includes(item.id) || linkedLeadIds.includes(item.lead_id || "")
        );
      } else if (kind === "appointment") {
        detailAppointments = appointmentRows.filter((item) => item.id === value);
        const linkedLeadIds = unique(
          detailAppointments.map((item) => item.lead_id).filter(Boolean) as string[]
        );
        detailLeads = leadRows.filter((item) => linkedLeadIds.includes(item.id));
        detailCases = cases.filter(
          (item) => item.appointment_id === value || linkedLeadIds.includes(item.lead_id || "")
        );
      }

      detail = buildCustomerDetail({
        ref: selectedRef,
        cases: detailCases,
        leads: detailLeads,
        appointments: detailAppointments,
        profileMap,
      });
    }

    return NextResponse.json({
      items: summaries,
      detail,
      scope: currentSession.scope,
    });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "No fue posible consultar la trazabilidad del cliente.") },
      { status: 500 }
    );
  }
}
