export type CommercialTeamKey = "am" | "pm";

type TeamProfileInput = {
  full_name?: string | null;
  job_title?: string | null;
  role_name?: string | null;
  departments?: { name: string | null }[] | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function inferCommercialTeamFromStrings(
  values: Array<string | null | undefined>
): CommercialTeamKey | null {
  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean);

  for (const value of normalized) {
    if (/\b(a\.?\s?m\.?|am|manana|jornada manana|turno manana)\b/.test(value)) {
      return "am";
    }

    if (/\b(p\.?\s?m\.?|pm|tarde|jornada tarde|turno tarde)\b/.test(value)) {
      return "pm";
    }
  }

  return null;
}

export function inferCommercialTeam(
  profile: TeamProfileInput | null | undefined
): CommercialTeamKey | null {
  if (!profile) return null;

  const departmentNames = Array.isArray(profile.departments)
    ? profile.departments.map((item) => item?.name || "")
    : [];

  return inferCommercialTeamFromStrings([
    profile.full_name || "",
    profile.job_title || "",
    profile.role_name || "",
    ...departmentNames,
  ]);
}

export function inferCommercialTeamFromDate(
  dateString: string | null | undefined
): CommercialTeamKey | null {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return date.getHours() < 13 ? "am" : "pm";
}

export function getCommercialTeamLabel(team: CommercialTeamKey | null | undefined) {
  if (team === "am") return "Equipo AM";
  if (team === "pm") return "Equipo PM";
  return "Equipo comercial";
}
