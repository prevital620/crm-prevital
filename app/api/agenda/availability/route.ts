import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/server/user-security";
import { requireAgendaSchedulingAccess } from "@/lib/server/agenda-access";
import {
  getCommercialAgendaAvailability,
  normalizeAgendaDate,
  normalizeCommercialServiceType,
} from "@/lib/server/agenda-scheduling";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const authCheck = await requireAgendaSchedulingAccess(request);

    if (!authCheck.ok) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = normalizeAgendaDate(searchParams.get("date"));
    const serviceType = normalizeCommercialServiceType(
      searchParams.get("service_type")
    );

    if (!date) {
      return NextResponse.json(
        { error: "Debes indicar una fecha valida en formato YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (serviceType !== "valoracion") {
      return NextResponse.json(
        { error: "Por ahora la agenda WhatsApp IA solo permite service_type=valoracion." },
        { status: 400 }
      );
    }

    const availability = await getCommercialAgendaAvailability({
      date,
      serviceType,
      onlyAvailable: true,
    });

    return NextResponse.json(availability);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Error interno del servidor.") },
      { status: 500 }
    );
  }
}
