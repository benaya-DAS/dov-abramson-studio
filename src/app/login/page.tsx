"use client";

import Image from "next/image";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Restricts the Google account chooser to the studio's Google
        // Workspace domain. This is a UX hint only — the database trigger
        // `enforce_studio_domain` is the actual security boundary.
        queryParams: {
          hd: process.env.NEXT_PUBLIC_STUDIO_DOMAIN || "studiodov.com",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-panel">
        <div className="mb-8 text-center">
          <Image
            src="/web-app-manifest-512x512.png"
            alt="סטודיו דב אברמסון"
            width={56}
            height={56}
            className="mx-auto mb-4 h-14 w-14 rounded-xl object-contain"
            priority
          />
          <h1 className="text-xl font-bold text-slate-900">סטודיו דב אברמסון</h1>
          <p className="mt-1 text-sm text-slate-500">מערכת ניהול פרויקטים פנימית</p>
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "מתחבר..." : "התחברות עם Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          הגישה מוגבלת לחשבונות Google של דוא&quot;ל הסטודיו בלבד.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.6 0-14.1 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 27 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.8 39.6 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.5 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
