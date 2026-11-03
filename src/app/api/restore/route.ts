import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONFIRM_RESTORE_WORD, canRestore } from "@/lib/backupAdmins";
import {
  BACKUP_WORKFLOW,
  RESTORE_WORKFLOW,
  dispatch,
  hasToken,
  listRuns,
  runSince,
  summarize,
  type Run,
} from "@/lib/githubActions";

// "שחזור מגיבוי" in the user menu (see docs/backups.md). Restoring replaces
// everyone's data, so only RESTORE_ADMIN_EMAILS get in, the request must
// carry the typed confirmation word, and the backup to restore is looked
// up here by run id - its times never come from the browser.

// Backups are pruned at 30 days; stop listing a day early so the oldest
// entry is never one whose file has just been deleted.
const LIST_DAYS = 29;

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!canRestore(user.email)) return { denied: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  if (!hasToken()) return { denied: NextResponse.json({ error: "missing_token" }, { status: 503 }) };
  return { email: user.email! };
}

function kind(run: Run) {
  if (run.display_title.includes("(rollover)")) return "rollover";
  if (run.event === "schedule") return "scheduled";
  return "manual";
}

async function successfulBackups(): Promise<Run[] | NextResponse> {
  const since = new Date(Date.now() - LIST_DAYS * 86_400_000).toISOString().slice(0, 10);
  return listRuns(BACKUP_WORKFLOW, `status=success&per_page=100&created=${encodeURIComponent(`>=${since}`)}`);
}

// ?since=<iso> - status of the restore started then (for polling).
// Otherwise - the list of backups to choose from, plus restore state.
export async function GET(request: Request) {
  const auth = await authorize();
  if (auth.denied) return auth.denied;

  const restores = await listRuns(RESTORE_WORKFLOW);
  if (restores instanceof NextResponse) return restores;

  const since = new URL(request.url).searchParams.get("since");
  if (since !== null) return NextResponse.json({ run: runSince(restores, since) });

  const backups = await successfulBackups();
  if (backups instanceof NextResponse) return backups;
  // The last real restore, if its safety copy (db-backups/pre-restore,
  // pruned at 30 days like the backups) is still there to undo it with. A
  // dry run (db-restore.yml's test mode) changes nothing and leaves no copy.
  const undoableSince = Date.now() - LIST_DAYS * 86_400_000;
  const lastRestore = restores.find(
    (r) => r.status === "completed" && r.conclusion === "success" && !/dry[ -]run/i.test(r.display_title)
  );
  const undoable = lastRestore && Date.parse(lastRestore.created_at) >= undoableSince ? lastRestore : null;
  return NextResponse.json({
    backups: backups.map((r) => ({ id: r.id, createdAt: r.created_at, kind: kind(r) })),
    active: restores.find((r) => r.status !== "completed") ? true : false,
    lastRestoreAt: undoable?.created_at ?? null,
  });
}

// { action: "restore", runId, confirm } or { action: "undo", confirm }
export async function POST(request: Request) {
  const auth = await authorize();
  if (auth.denied) return auth.denied;

  const body = (await request.json().catch(() => ({}))) as { action?: string; runId?: number; confirm?: string };
  if (body.confirm !== CONFIRM_RESTORE_WORD) return NextResponse.json({ error: "not_confirmed" }, { status: 400 });

  const restores = await listRuns(RESTORE_WORKFLOW);
  if (restores instanceof NextResponse) return restores;
  const active = restores.find((r) => r.status !== "completed");
  if (active) return NextResponse.json({ error: "already_running", run: summarize(active) }, { status: 409 });

  let inputs: Record<string, string>;
  if (body.action === "undo") {
    inputs = { backup_file: "pre-restore/latest" };
  } else if (body.action === "restore" && typeof body.runId === "number") {
    const backups = await successfulBackups();
    if (backups instanceof NextResponse) return backups;
    const run = backups.find((r) => r.id === body.runId);
    if (!run) return NextResponse.json({ error: "backup_not_found" }, { status: 404 });
    inputs = { backup_file: "", backup_after: run.created_at, backup_before: run.updated_at };
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const startedAt = new Date().toISOString();
  const failed = await dispatch(RESTORE_WORKFLOW, { ...inputs, confirm: "RESTORE", requested_by: auth.email });
  if (failed) return failed;
  return NextResponse.json({ since: startedAt });
}
