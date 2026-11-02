import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canRunManualBackup } from "@/lib/backupAdmins";
import { BACKUP_WORKFLOW, dispatch, hasToken, listRuns, runSince, summarize } from "@/lib/githubActions";

// Starts and reports on the "DB backup" workflow (see docs/backups.md).

async function authorize(reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Anyone signed in may trigger the automatic rollover backup (it's just
  // a backup - harmless); the manual button is for the listed admins.
  if (reason !== "rollover" && !canRunManualBackup(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!hasToken()) return NextResponse.json({ error: "missing_token" }, { status: 503 });
  return null;
}

// Starts a backup, unless one is already queued or running - then reports
// that one instead, so repeated clicks never stack up runs.
export async function POST(request: Request) {
  const { reason: raw } = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = raw === "rollover" ? "rollover" : "manual";
  const denied = await authorize(reason);
  if (denied) return denied;

  const runs = await listRuns(BACKUP_WORKFLOW);
  if (runs instanceof NextResponse) return runs;
  const active = runs.find((r) => r.status !== "completed");
  if (active) return NextResponse.json({ started: false, run: summarize(active) });

  const startedAt = new Date().toISOString();
  const failed = await dispatch(BACKUP_WORKFLOW, { reason });
  if (failed) return failed;
  return NextResponse.json({ started: true, since: startedAt });
}

export async function GET(request: Request) {
  const denied = await authorize("manual");
  if (denied) return denied;
  const runs = await listRuns(BACKUP_WORKFLOW);
  if (runs instanceof NextResponse) return runs;
  return NextResponse.json({ run: runSince(runs, new URL(request.url).searchParams.get("since")) });
}
