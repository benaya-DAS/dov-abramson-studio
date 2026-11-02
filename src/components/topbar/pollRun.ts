// Polls /api/backup or /api/restore until the GitHub run started at
// `since` finishes. Resolves to the finished run, an error code, or null
// if it timed out (or the caller unmounted).
export type PolledRun = { status: string; conclusion: string | null; url: string };

// Errors that won't fix themselves by waiting - stop and report these.
const FATAL = new Set(["bad_token", "missing_token", "forbidden", "unauthorized"]);
// Anything else (a network blip, a non-JSON page, a 5xx) is retried this
// many times in a row before giving up - one failed check must never be
// reported as a failed backup/restore.
const MAX_CONSECUTIVE_FAILURES = 6;

export async function pollRun(
  endpoint: "/api/backup" | "/api/restore",
  since: string,
  { maxMinutes, cancelled }: { maxMinutes: number; cancelled: () => boolean }
): Promise<{ run: PolledRun } | { error: string } | null> {
  let failures = 0;
  for (let i = 0; i < (maxMinutes * 60) / 5 && !cancelled(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const res = await fetch(`${endpoint}?since=${encodeURIComponent(since)}`);
      const body = await res.json();
      if (res.ok) {
        failures = 0;
        if (body.run?.status === "completed") return { run: body.run };
        continue;
      }
      if (FATAL.has(body.error)) return { error: body.error };
    } catch {
      // fall through - counted as a transient failure below
    }
    if (++failures >= MAX_CONSECUTIVE_FAILURES) return { error: "status_unknown" };
  }
  return null;
}
