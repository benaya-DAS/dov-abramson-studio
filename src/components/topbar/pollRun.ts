// Polls /api/backup or /api/restore until the GitHub run started at
// `since` finishes. Resolves to the finished run, or an error code.
export type PolledRun = { status: string; conclusion: string | null; url: string };

export async function pollRun(
  endpoint: "/api/backup" | "/api/restore",
  since: string,
  { maxMinutes, cancelled }: { maxMinutes: number; cancelled: () => boolean }
): Promise<{ run: PolledRun } | { error: string } | null> {
  for (let i = 0; i < (maxMinutes * 60) / 5 && !cancelled(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const res = await fetch(`${endpoint}?since=${encodeURIComponent(since)}`);
    const body = await res.json();
    if (!res.ok) return { error: body.error };
    if (body.run?.status === "completed") return { run: body.run };
  }
  return null; // timed out (or unmounted)
}
