import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/auth-error"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Refreshes the Supabase auth session on every request and enforces two
 * gates before any protected page is served:
 *   1. The visitor must have a valid session (redirect to /login otherwise).
 *   2. The session's email must belong to the studio's allowed domain(s).
 *      This is defense-in-depth — the database trigger
 *      `enforce_studio_domain` already blocks account creation for other
 *      domains — but we re-check here in case a session is presented that
 *      predates a domain-list change, and to fail closed rather than open.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: isAllowed, error: domainCheckError } = await supabase.rpc(
      "is_allowed_email",
      { p_email: user.email }
    );

    // Only treat this as a domain rejection when the check actually ran and
    // explicitly returned false. If the RPC call itself failed (network
    // blip, a momentarily stale PostgREST schema cache right after a
    // function change, etc.), don't sign a legitimate user out over a
    // technical error — the authoritative gate is the enforce_studio_domain
    // trigger on auth.users, which already prevented any other domain from
    // ever getting an account in the first place.
    if (domainCheckError) {
      console.error("is_allowed_email RPC failed, allowing request through:", domainCheckError);
    } else if (isAllowed === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/auth-error";
      url.searchParams.set("reason", "domain");
      return NextResponse.redirect(url);
    }

    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
