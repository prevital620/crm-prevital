export function normalizeOperationalGroupCode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

const opcLeadOperationalGroupCode = "CZ";
const opcLeadOperationalRouteStartsAt = Date.parse("2026-05-02T05:00:00.000Z");

function isOpcLead(source: string | null | undefined, commissionSourceType?: string | null) {
  return (
    String(source || "").trim().toLowerCase() === "opc" ||
    String(commissionSourceType || "").trim().toLowerCase() === "opc"
  );
}

function shouldRouteOpcLeadToCz(createdAt: string | null | undefined) {
  if (!createdAt) return false;

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return false;

  return timestamp >= opcLeadOperationalRouteStartsAt;
}

export function resolveLeadOperationalGroupCode(params: {
  source: string | null | undefined;
  commissionSourceType?: string | null | undefined;
  createdAt: string | null | undefined;
  creatorGroupCode: string | null | undefined;
  assignedUserGroupCode: string | null | undefined;
}) {
  if (
    isOpcLead(params.source, params.commissionSourceType) &&
    shouldRouteOpcLeadToCz(params.createdAt)
  ) {
    return opcLeadOperationalGroupCode;
  }

  return (
    normalizeOperationalGroupCode(params.assignedUserGroupCode) ||
    normalizeOperationalGroupCode(params.creatorGroupCode)
  );
}

export function leadBelongsToOperationalGroup(params: {
  currentGroupCode: string | null | undefined;
  source: string | null | undefined;
  commissionSourceType?: string | null | undefined;
  createdAt: string | null | undefined;
  creatorGroupCode: string | null | undefined;
  assignedUserGroupCode: string | null | undefined;
  currentUserId: string | null | undefined;
  leadCreatedByUserId: string | null | undefined;
  leadAssignedToUserId: string | null | undefined;
}) {
  const currentGroupCode = normalizeOperationalGroupCode(params.currentGroupCode);
  if (!currentGroupCode) return false;
  const leadGroupCode = resolveLeadOperationalGroupCode({
    source: params.source,
    commissionSourceType: params.commissionSourceType,
    createdAt: params.createdAt,
    creatorGroupCode: params.creatorGroupCode,
    assignedUserGroupCode: params.assignedUserGroupCode,
  });

  return (
    leadGroupCode === currentGroupCode ||
    params.leadCreatedByUserId === params.currentUserId ||
    params.leadAssignedToUserId === params.currentUserId
  );
}
