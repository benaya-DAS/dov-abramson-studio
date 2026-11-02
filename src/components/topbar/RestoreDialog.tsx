"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { History, LoaderCircle, TriangleAlert, Undo2, X } from "lucide-react";
import { CONFIRM_RESTORE_WORD } from "@/lib/backupAdmins";
import { blurActiveElement, cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import { backupErrorMessage } from "./BackupStatus";

type Backup = { id: number; createdAt: string; kind: "scheduled" | "manual" | "rollover" };
type ListState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; backups: Backup[]; active: boolean; lastRestoreAt: string | null };

const KIND_LABELS: Record<Backup["kind"], string> = {
  scheduled: "אוטומטי",
  manual: "ידני",
  rollover: "חודש חדש",
};

const day = (iso: string) => format(new Date(iso), "EEEE, d בMMMM", { locale: he });
const time = (iso: string) => format(new Date(iso), "HH:mm");
const dayAndTime = (iso: string) => `${format(new Date(iso), "d בMMMM", { locale: he })} בשעה ${time(iso)}`;

/**
 * "שחזור מגיבוי": pick one of the last 30 days' backups (or undo the last
 * restore) and confirm by typing CONFIRM_RESTORE_WORD. Starting it hands
 * off to onStarted, which tracks the run after this dialog closes.
 */
export default function RestoreDialog({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: (since: string, undo: boolean) => void;
}) {
  const [list, setList] = useState<ListState>({ phase: "loading" });
  // A backup's run id, "undo", or nothing chosen yet.
  const [choice, setChoice] = useState<number | "undo" | null>(null);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function close() {
    blurActiveElement();
    onClose();
  }
  useEscapeKey(close, true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/restore")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        setList(
          res.ok
            ? { phase: "ready", backups: body.backups, active: body.active, lastRestoreAt: body.lastRestoreAt }
            : { phase: "error", message: backupErrorMessage(body.error) }
        );
      })
      .catch(() => !cancelled && setList({ phase: "error", message: backupErrorMessage(undefined) }));
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(next: number | "undo") {
    setChoice(next);
    setTyped("");
    setSubmitError(null);
  }

  async function submit() {
    if (choice === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        body: JSON.stringify(
          choice === "undo"
            ? { action: "undo", confirm: typed.trim() }
            : { action: "restore", runId: choice, confirm: typed.trim() }
        ),
      });
      const body = await res.json();
      if (!res.ok) {
        setSubmitError(backupErrorMessage(body.error));
        setSubmitting(false);
        return;
      }
      onStarted(body.since, choice === "undo");
    } catch {
      setSubmitError(backupErrorMessage(undefined));
      setSubmitting(false);
    }
  }

  const ready = list.phase === "ready" ? list : null;
  const chosen = ready && typeof choice === "number" ? ready.backups.find((b) => b.id === choice) : null;
  const confirmed = typed.trim() === CONFIRM_RESTORE_WORD;

  // Group the (newest-first) list under one heading per day.
  const days: { label: string; backups: Backup[] }[] = [];
  for (const b of ready?.backups ?? []) {
    const label = day(b.createdAt);
    if (days.at(-1)?.label === label) days.at(-1)!.backups.push(b);
    else days.push({ label, backups: [b] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        role="dialog"
        aria-label="שחזור מגיבוי"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl dark:bg-night-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <History size={20} />
            שחזור מגיבוי
          </h2>
          <button onClick={close} aria-label="סגירה" className="rounded p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <p className="mx-6 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          שחזור מחזיר את <b>כל המערכת, לכל המשתמשים</b>, למצב שהיה בזמן הגיבוי. לפני השחזור נשמר אוטומטית עותק של
          המצב הנוכחי, כך שאפשר לבטל.
        </p>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-6">
          {list.phase === "loading" && (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <LoaderCircle size={16} className="animate-spin" />
              טוען את רשימת הגיבויים...
            </p>
          )}
          {list.phase === "error" && <p className="py-6 text-sm text-red-600 dark:text-red-400">{list.message}</p>}
          {ready?.active && (
            <p className="py-6 text-sm text-slate-600 dark:text-slate-300">
              שחזור כבר רץ ברגע זה. אפשר להתחיל חדש רק אחרי שיסתיים.
            </p>
          )}
          {ready && !ready.active && ready.backups.length === 0 && (
            <p className="py-6 text-sm text-slate-500">אין גיבויים מ־30 הימים האחרונים.</p>
          )}
          {ready &&
            !ready.active &&
            days.map((d) => (
              <div key={d.label} className="mb-2">
                <p className="sticky top-0 bg-white py-1 text-xs font-semibold text-slate-400 dark:bg-night-800 dark:text-slate-500">
                  {d.label}
                </p>
                {d.backups.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => choose(b.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-night-700",
                      choice === b.id && "bg-brand-50 ring-1 ring-brand-300 hover:bg-brand-50 dark:bg-brand-900/30 dark:ring-brand-700"
                    )}
                  >
                    <span className="font-mono text-slate-800 dark:text-slate-100">{time(b.createdAt)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{KIND_LABELS[b.kind]}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>

        {ready && !ready.active && (
          <div className="border-t border-slate-200 px-6 pb-5 pt-3 dark:border-night-700">
            {ready.lastRestoreAt && choice !== "undo" && (
              <button
                onClick={() => choose("undo")}
                className="mb-2 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                <Undo2 size={14} />
                ביטול השחזור האחרון ({dayAndTime(ready.lastRestoreAt)})
              </button>
            )}

            {choice === null ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">בחרו גיבוי מהרשימה.</p>
            ) : (
              <>
                <p className="flex items-start gap-1.5 text-sm text-red-700 dark:text-red-400">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  {choice === "undo" ? (
                    <span>
                      המערכת תחזור למצב שהיה רגע לפני השחזור מ־{dayAndTime(ready.lastRestoreAt!)}. כל מה שנעשה
                      מאז אותו שחזור יימחק.
                    </span>
                  ) : (
                    <span>
                      המערכת תחזור למצב של {chosen && dayAndTime(chosen.createdAt)}. כל מה שנעשה מאז יימחק.
                    </span>
                  )}
                </p>
                <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400">
                  לאישור, הקלידו &quot;{CONFIRM_RESTORE_WORD}&quot;:
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmed && !submitting && submit()}
                    autoFocus
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-red-400 dark:border-night-600 dark:bg-night-900"
                  />
                  <button
                    onClick={submit}
                    disabled={!confirmed || submitting}
                    className="shrink-0 rounded-md bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "מתחיל..." : choice === "undo" ? "בטל שחזור" : "שחזר"}
                  </button>
                </div>
                {submitError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{submitError}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
