import Link from "next/link";

const REASONS: Record<string, string> = {
  domain:
    'החשבון שבחרת אינו שייך לדומיין הסטודיו המורשה. יש להתחבר עם חשבון Google הרשמי של הסטודיו (@studiodov.com).',
  missing_code: "אירעה שגיאה בתהליך ההתחברות. נסו שוב.",
  unknown: "אירעה שגיאה לא צפויה בתהליך ההתחברות.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASONS[reason ?? "unknown"] ?? REASONS.unknown;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-panel dark:border-red-900/60 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-2xl dark:bg-red-950/40">
          🚫
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">הגישה נדחתה</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          חזרה למסך ההתחברות
        </Link>
      </div>
    </main>
  );
}
