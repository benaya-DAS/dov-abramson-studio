import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canRunManualBackup } from "@/lib/backupAdmins";

// Starts and reports on the "DB backup" GitHub Actions workflow
// (.github/workflows/db-backup.yml - see docs/backups.md). The token
// (GITHUB_BACKUP_TOKEN, a fine-grained token limited to this repo's
// Actions) only ever lives here on the server. The workflow file is fixed
// below on purpose: nothing a caller sends can make this run anything else
// - in particular not db-restore.yml, which the same token could start.
const REPO = "benaya-DAS/dov-abramson-studio";
const WORKFLOW = "db-backup.yml";
const API = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}`;

type Run = { id: number; status: string; conclusion: string | null; created_at: string; html_url: string };

async function github(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_BACKUP_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
}

async function latestRuns(): Promise<Run[] | NextResponse> {
  const res = await github("/runs?per_page=5");
  if (!res.ok) return githubError(res);
  const body = (await res.json()) as { workflow_runs: Run[] };
  return body.workflow_runs;
}

function githubError(res: Response) {
  console.error("GitHub API error:", res.status);
  const expired = res.status === 401 || res.status === 403;
  return NextResponse.json({ error: expired ? "bad_token" : "github_error" }, { status: 502 });
}

function summarize(run: Run) {
  return { status: run.status, conclusion: run.conclusion, createdAt: run.created_at, url: run.html_url };
}

async function authorize(reason: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Anyone signed in may trigger the automatic pre-rollover backup (it's
  // just a backup - harmless); the manual button is for the listed admins.
  if (reason !== "rollover" && !canRunManualBackup(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!process.env.GITHUB_BACKUP_TOKEN) {
    return NextResponse.json({ error: "missing_token" }, { status: 503 });
  }
  return null;
}

// Starts a backup, unless one is already queued or running - then reports
// that one instead, so repeated clicks never stack up runs.
export async function POST(request: Request) {
  const { reason } = (await request.json().catch(() => ({}))) as { reason?: string };
  const denied = await authorize(reason === "rollover" ? "rollover" : "manual");
  if (denied) return denied;

  const runs = await latestRuns();
  if (runs instanceof NextResponse) return runs;
  const active = runs.find((r) => r.status !== "completed");
  if (active) return NextResponse.json({ started: false, run: summarize(active) });

  const startedAt = new Date().toISOString();
  const res = await github("/dispatches", { method: "POST", body: JSON.stringify({ ref: "main" }) });
  if (!res.ok) return githubError(res);
  return NextResponse.json({ started: true, since: startedAt });
}

// The newest run created at or after `since` (the click time; a few seconds
// of slack for clock skew), or null while GitHub hasn't listed it yet.
export async function GET(request: Request) {
  const denied = await authorize("manual");
  if (denied) return denied;

  const since = new URL(request.url).searchParams.get("since");
  const after = since ? Date.parse(since) - 30_000 : 0;
  const runs = await latestRuns();
  if (runs instanceof NextResponse) return runs;
  const run = runs.find((r) => Date.parse(r.created_at) >= after);
  return NextResponse.json({ run: run ? summarize(run) : null });
}
