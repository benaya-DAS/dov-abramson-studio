"use client";

import { CircleAlert, CircleCheck, LoaderCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BackupState =
  | { phase: "idle" }
  | { phase: "running"; note?: string }
  | { phase: "done" }
  | { phase: "failed"; message: string; url?: string };

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "הכפתור עוד לא מחובר ל־GitHub (חסר מפתח גישה ב־Vercel).",
  bad_token: "מפתח הגישה ל־GitHub פג או לא תקין - צריך לחדש אותו.",
  forbidden: "אין לך הרשאה ליצור גיבוי.",
};

export function backupErrorMessage(code: string | undefined) {
  return (code && ERROR_MESSAGES[code]) || "לא הצלחנו להתחיל גיבוי. נסו שוב בעוד רגע.";
}

/** Floating status for a manual backup started from the user menu - it has
 * to outlive the menu itself, which closes as soon as the item is clicked. */
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
            <p className="font-medium">מגבה את המערכת...</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {state.note ?? "לוקח בערך דקה. אפשר להמשיך לעבוד בינתיים."}
            </p>
          </>
        )}
        {state.phase === "done" && <p className="font-medium">הגיבוי הושלם ונשמר בדרייב.</p>}
        {state.phase === "failed" && (
          <>
            <p className="font-medium">{state.message}</p>
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
