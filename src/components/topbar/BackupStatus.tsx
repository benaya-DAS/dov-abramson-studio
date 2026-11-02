"use client";

import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BackupState =
  | { phase: "idle" }
  | { phase: "running"; title: string; note: string }
  | { phase: "done"; text: string; reload?: boolean }
  | { phase: "failed"; message: string; url?: string; help?: boolean };

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "הכפתור עוד לא מחובר ל־GitHub (חסר מפתח גישה ב־Vercel).",
  bad_token: "מפתח הגישה ל־GitHub פג או לא תקין - צריך לחדש אותו.",
  forbidden: "אין לך הרשאה לפעולה הזו.",
  already_running: "שחזור כבר רץ - אפשר להתחיל חדש רק אחרי שיסתיים.",
  backup_not_found: "הגיבוי הזה כבר לא קיים (ישן מ־30 יום).",
  status_unknown: "לא הצלחנו לבדוק אם הפעולה הסתיימה - ייתכן שהיא הצליחה. רעננו את הדף בעוד דקה ובדקו.",
};

export function backupErrorMessage(code: string | undefined) {
  return (code && ERROR_MESSAGES[code]) || "הפעולה לא הצליחה. נסו שוב בעוד רגע.";
}

/** A missing/expired GitHub token is fixed by hand - link to the steps. */
export const TOKEN_HELP_PATH = "/help/backup-token";
export function needsTokenHelp(code: string | undefined) {
  return code === "missing_token" || code === "bad_token";
}

/** The failed status for an API error code. */
export function failedState(code: string | undefined): BackupState {
  return { phase: "failed", message: backupErrorMessage(code), help: needsTokenHelp(code) };
}

/** Floating status for a backup/restore started from the user menu - it
 * has to outlive the menu itself, which closes as soon as you pick one. */
export default function BackupStatus({ state, onDismiss }: { state: BackupState; onDismiss: () => void }) {
  if (state.phase === "idle") return null;
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-4 z-50 flex max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg",
        state.phase === "failed"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          : "border-slate-200 bg-white text-slate-700 dark:border-night-700 dark:bg-night-800 dark:text-slate-200"
      )}
    >
      {state.phase === "running" && <LoaderCircle size={18} className="mt-px shrink-0 animate-spin text-brand-500" />}
      {state.phase === "done" && <CircleCheck size={18} className="mt-px shrink-0 text-emerald-500" />}
      {state.phase === "failed" && <CircleAlert size={18} className="mt-px shrink-0" />}
      <div className="min-w-0 flex-1">
        {state.phase === "running" && (
          <>
            <p className="font-medium">{state.title}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{state.note}</p>
          </>
        )}
        {state.phase === "done" && (
          <>
            <p className="font-medium">{state.text}</p>
            {state.reload && (
              <button
                onClick={() => window.location.reload()}
                className="mt-1.5 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
              >
                רענון הדף
              </button>
            )}
          </>
        )}
        {state.phase === "failed" && (
          <>
            <p className="font-medium">{state.message}</p>
            {state.help && (
              <a href={TOKEN_HELP_PATH} target="_blank" rel="noreferrer" className="mt-0.5 block text-xs underline">
                איך מתקנים את זה?
              </a>
            )}
            {state.url && (
              <a href={state.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-xs underline">
                פרטים ב־GitHub
              </a>
            )}
          </>
        )}
      </div>
      <button onClick={onDismiss} aria-label="סגירה" className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
