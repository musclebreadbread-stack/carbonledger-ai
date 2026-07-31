import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DASHBOARD_ROUTE } from "@/lib/navigation";
import { resolveAuthDeploymentMode } from "@/lib/auth/deployment-mode";

/**
 * Next.js Proxy (formerly Middleware; renamed in Next.js 16)
 * - Checks auth session on protected routes
 * - Redirects to /login if not authenticated
 * - Sends an already-authenticated visitor away from /login
 * - Adds company_id to request headers for RLS
 * - Rate limiting headers
 *
 * This is an optimistic check only, as the Next.js proxy guidance says it should
 * be: it decides where to send a *navigation*. Nothing here is the authorisation
 * boundary. Every Server Action re-resolves the actor and re-checks capability
 * and tenancy (see `src/lib/auth/actor.ts`), because an action is reachable by
 * POST whether or not a navigation ever passed through here.
 */

/**
 * Routes reachable without a session.
 *
 * `/` is the marketing landing page and must stay public — the authenticated
 * dashboard index lives at `/dashboard` (see src/app/(dashboard)/dashboard).
 */
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/api/health"];

/** Routes that are public but must match exactly, not by prefix. */
const PUBLIC_EXACT_ROUTES = ["/"];

/**
 * Public routes that an *already signed-in* visitor should not be looking at.
 *
 * Kept separate from `PUBLIC_ROUTES` because they need the opposite treatment:
 * reachable without a session, pointless with one. `/forgot-password` is not
 * here — wanting to change your password while signed in is reasonable.
 */
const AUTH_ROUTES = ["/login", "/register"];

function matches(pathname: string, routes: readonly string[]): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function isPublic(pathname: string): boolean {
  return PUBLIC_EXACT_ROUTES.includes(pathname) || matches(pathname, PUBLIC_ROUTES);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthRoute = matches(pathname, AUTH_ROUTES);

  // Public routes need no session. Auth routes are the exception: they are public
  // but we still want to know whether a session exists, to bounce a signed-in
  // visitor onward rather than showing them a login form.
  if (isPublic(pathname) && !isAuthRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const authMode = resolveAuthDeploymentMode(process.env);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (authMode === "demo") {
    /*
     * No Supabase project, so there is no session to check and nothing to
     * enforce. Every request is let through, including the dashboard: the demo
     * deployment is meant to be browsable.
     *
     * The consequence is stated in `src/lib/auth/current-actor.ts`: in this mode
     * the actor is a server-asserted stub unless a demo session cookie says
     * otherwise, and the UI says as much. Redirecting a signed-in demo visitor
     * away from /login is handled by the login page itself rather than here,
     * because verifying that cookie means reading the catalogue and `next/headers`,
     * neither of which belongs in the proxy.
     */
    return response;
  }

  if (authMode === "disabled") {
    if (isAuthRoute) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in: /login and /register have nothing to offer.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = DASHBOARD_ROUTE;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Redirect to login if not authenticated on protected routes
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Add company_id header for RLS
  if (user?.user_metadata?.company_id) {
    response.headers.set("x-company-id", user.user_metadata.company_id);
  }

  // Rate limiting headers
  response.headers.set("X-RateLimit-Limit", "100");
  response.headers.set("X-RateLimit-Remaining", "99");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
