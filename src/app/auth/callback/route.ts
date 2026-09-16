import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // The most common failure here is our own `enforce_studio_domain`
    // trigger rejecting sign-up for a non-studio Google account.
    const message = error.message.includes("not authorized")
      ? "domain"
      : "unknown";
    return NextResponse.redirect(`${origin}/auth/auth-error?reason=${message}`);
  }

  return NextResponse.redirect(`${origin}/auth/auth-error?reason=missing_code`);
}
