import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createProxySupabaseClient } from "@/lib/server/supabase-server";
import { getVerifiedSessionState } from "@/lib/server/user-security";

function copyResponseState(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  source.headers.forEach((value, key) => {
    target.headers.set(key, value);
  });

  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  const supabase = createProxySupabaseClient(request, response);
  const sessionState = await getVerifiedSessionState(supabase);

  if (!sessionState.user) {
    if (pathname === "/cambiar-clave") {
      return copyResponseState(
        response,
        NextResponse.redirect(new URL("/login", request.url))
      );
    }

    return response;
  }

  if (pathname === "/login") {
    const destination = sessionState.mustChangePassword ? "/cambiar-clave" : "/";

    return copyResponseState(
      response,
      NextResponse.redirect(new URL(destination, request.url))
    );
  }

  if (sessionState.mustChangePassword && pathname !== "/cambiar-clave") {
    return copyResponseState(
      response,
      NextResponse.redirect(new URL("/cambiar-clave", request.url))
    );
  }

  if (!sessionState.mustChangePassword && pathname === "/cambiar-clave") {
    return copyResponseState(
      response,
      NextResponse.redirect(new URL("/", request.url))
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
