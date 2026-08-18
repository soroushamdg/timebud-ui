import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Skip auth check for Stripe webhook and the Vercel Cron reminder job —
  // neither carries a logged-in user's session cookie, and the cron route
  // authenticates itself separately via a CRON_SECRET bearer token.
  if (
    request.nextUrl.pathname === "/api/stripe/webhook" ||
    request.nextUrl.pathname === "/api/cron/daily-reminder"
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No user + path not starting with /auth → redirect to /auth/login
  if (!user && !request.nextUrl.pathname.startsWith("/auth")) {
    const redirectUrl = new URL("/auth/login", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy cookies from response to redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // User exists + path starts with /auth → redirect to /
  if (user && request.nextUrl.pathname.startsWith("/auth")) {
    const redirectUrl = new URL("/", request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy cookies from response to redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // /serwist/* (service worker, served via @serwist/turbopack's route handler) and
    // manifest.webmanifest must never require a login session — the browser fetches
    // them to register the service worker / evaluate installability, and a service
    // worker registration response can never be a redirect (browsers reject it
    // outright), so gating these behind auth silently breaks all PWA functionality.
    "/((?!_next/static|_next/image|favicon.ico|serwist/|manifest.webmanifest|.*.(?:svg|png|jpg|jpeg|gif|webp)$|auth).*)",
  ],
};
