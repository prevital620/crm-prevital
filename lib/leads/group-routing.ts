export function normalizeOperationalGroupCode(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
}

const opcLeadOperationalGroupCode = "CZ";

function isOpcLead(source: string | null | undefined, commissionSourceType?: string | null) {
  return (
    String(source || "").trim().toLowerCase() === "opc" ||
    String(commissionSourceType || "").trim().toLowerCase() === "opc"
  );
}

export function resolveLeadOperationalGroupCode(params: {
  source: string | null | undefined;
  commissionSourceType?: string | null | undefined;
  creatorGroupCode: string | null | undefined;
  assignedUserGroupCode: string | null | undefined;
}) {
  if (isOpcLead(params.source, params.commissionSourceType)) {
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
    creatorGroupCode: params.creatorGroupCode,
    assignedUserGroupCode: params.assignedUserGroupCode,
  });

  return (
    leadGroupCode === currentGroupCode ||
    params.leadCreatedByUserId === params.currentUserId ||
    params.leadAssignedToUserId === params.currentUserId
  );
}
