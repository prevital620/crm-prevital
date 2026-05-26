import "server-only";

import { requireWhatsappLeadsAccess } from "@/lib/server/whatsapp-access";

function hasInternalAgendaSecret(request: Request) {
  const secret = process.env.AGENDA_API_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization") || "";
  const headerSecret =
    request.headers.get("x-agenda-secret") ||
    request.headers.get("x-cron-secret") ||
    "";

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}

export async function requireAgendaSchedulingAccess(request: Request) {
  if (hasInternalAgendaSecret(request)) {
    return {
      ok: true as const,
      user: null,
      source: "internal_secret" as const,
    };
  }

  const whatsappAccess = await requireWhatsappLeadsAccess();

  if (!whatsappAccess.ok) {
    return whatsappAccess;
  }

  return {
    ok: true as const,
    user: whatsappAccess.user,
    source: "crm_session" as const,
  };
}
