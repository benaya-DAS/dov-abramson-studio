import { NextResponse } from "next/server";

// Server-only access to this repo's backup/restore GitHub Actions
// workflows (see docs/backups.md), via GITHUB_BACKUP_TOKEN - a
// fine-grained token limited to this repo's Actions, which never leaves
// the server. Only these two workflow files can be reached through here.
const REPO = "benaya-DAS/dov-abramson-studio";
export const BACKUP_WORKFLOW = "db-backup.yml";
export const RESTORE_WORKFLOW = "db-restore.yml";
type Workflow = typeof BACKUP_WORKFLOW | typeof RESTORE_WORKFLOW;

export type Run = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  display_title: string;
  event: string;
  html_url: string;
};

export function hasToken() {
  return !!process.env.GITHUB_BACKUP_TOKEN;
}

function github(workflow: Workflow, path: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}${path}`, {
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

export function githubError(res: Response) {
  console.error("GitHub API error:", res.status);
  const expired = res.status === 401 || res.status === 403;
  return NextResponse.json({ error: expired ? "bad_token" : "github_error" }, { status: 502 });
}

/** The workflow's runs, newest first - or an error response to return. */
export async function listRuns(workflow: Workflow, query = "per_page=5"): Promise<Run[] | NextResponse> {
  const res = await github(workflow, `/runs?${query}`);
  if (!res.ok) return githubError(res);
  const body = (await res.json()) as { workflow_runs: Run[] };
  return body.workflow_runs;
}

/** Starts the workflow on main - null on success, else an error response. */
export async function dispatch(workflow: Workflow, inputs: Record<string, string>): Promise<NextResponse | null> {
  const res = await github(workflow, "/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
  return res.ok ? null : githubError(res);
}

export function summarize(run: Run) {
  return { status: run.status, conclusion: run.conclusion, createdAt: run.created_at, url: run.html_url };
}

/** The newest run created at or after `since` (with 30s of slack for
 * clock skew between this server and GitHub), for status polling. */
export function runSince(runs: Run[], since: string | null) {
  const after = since ? Date.parse(since) - 30_000 : 0;
  const run = runs.find((r) => Date.parse(r.created_at) >= after);
  return run ? summarize(run) : null;
}
