"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/topbar/UserMenu";
import { ACTIVITY_FIELD_LABELS, STATUS_LABELS } from "@/lib/constants";
import { blurActiveElement, cn, formatDateHe, formatSessionDate, formatSessionTime } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type { ActivityEntityType, ActivityLog, ItemStatus, Profile } from "@/lib/supabase/types";

const ENTITY_LABELS: Record<ActivityEntityType, string> = {
  item: "פריט",
  group: "קבוצה",
};

const ACTION_VERBS: Record<ActivityLog["action_type"], string> = {
  insert: "יצר/ה",
  update: "עדכן/ה",
  delete: "מחק/ה",
};

// Columns that exist on every row but never belong in a human-readable
// diff (identity/bookkeeping columns, not something a person "changed").
const IGNORED_DIFF_KEYS = new Set(["id", "board_id", "created_at", "updated_at", "created_by"]);

function diffFields(prev: Record<string, unknown> | null, next: Record<string, unknown> | null) {
  if (!prev || !next) return [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if (IGNORED_DIFF_KEYS.has(key)) return;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) changed.push(key);
  });
  return changed;
}

function formatFieldValue(
  key: string,
  value: unknown,
  profiles: Profile[],
  groupNameByGroupId: Record<string, string>
) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "status") return STATUS_LABELS[value as ItemStatus] ?? String(value);
  if (key === "person_ids") {
    const ids = Array.isArray(value) ? (value as string[]) : [];
    if (ids.length === 0) return "—";
    return ids
      .map((id) => {
        const person = profiles.find((p) => p.id === id);
        return person?.full_name || person?.email || "—";
      })
      .join(", ");
  }
  if (key === "group_id") return groupNameByGroupId[value as string] ?? "—";
  if (key === "start_date" || key === "due_date") return formatDateHe(value as string);
  if (key === "is_collapsed") return value ? "כן" : "לא";
  return String(value);
}

export default function ActivityLogDrawer({
  boardId,
  profiles,
  groupNameByGroupId,
  readOnly,
  onClose,
}: {
  boardId: string;
  profiles: Profile[];
  groupNameByGroupId: Record<string, string>;
  /** True on an archived board - undo_activity_log() itself also rejects
   * reverting anything on an archived board, but hiding the button avoids
   * offering an action that would just come back as an error. */
  readOnly?: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  function close() {
    blurActiveElement();
    onClose();
  }

  useEscapeKey(close);

  const fetchLogs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data ?? []);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    // Fetch-on-mount, then stay live via realtime while the drawer is open
    // - a teammate's edit (or someone else's undo) should show up here
    // without needing to close and reopen the drawer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-log-${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs", filter: `board_id=eq.${boardId}` },
        () => fetchLogs()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, fetchLogs]);

  async function handleUndo(log: ActivityLog) {
    setUndoingId(log.id);
    setErrorById((prev) => ({ ...prev, [log.id]: "" }));
    const supabase = createClient();
    const { error } = await supabase.rpc("undo_activity_log", { p_log_id: log.id });
    if (error) {
      console.error("Failed to undo activity log entry:", error);
      setErrorById((prev) => ({ ...prev, [log.id]: "לא ניתן היה לבטל את הפעולה." }));
      setUndoingId(null);
      return;
    }
    setUndoingId(null);
    fetchLogs();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-night-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-night-700">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <History size={18} className="text-brand-600 dark:text-brand-400" />
            היסטוריית פעילות
          </h2>
          <button
            onClick={close}
            className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">טוען...</p>
          ) : logs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              עדיין אין פעילות רשומה בלוח זה.
            </p>
          ) : (
            <ul>
              {logs.map((log) => {
                const person = profiles.find((p) => p.id === log.changed_by);
                const entityName =
                  (log.new_state?.name as string | undefined) ||
                  (log.previous_state?.name as string | undefined) ||
                  "";
                const changedKeys = diffFields(log.previous_state, log.new_state);

                return (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 border-b border-slate-100 px-5 py-3 last:border-0 dark:border-night-700/60"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        log.action_type === "insert" &&
                          "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
                        log.action_type === "update" &&
                          "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
                        log.action_type === "delete" &&
                          "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
                      )}
                    >
                      {log.action_type === "insert" && <Plus size={14} />}
                      {log.action_type === "update" && <Pencil size={13} />}
                      {log.action_type === "delete" && <Trash2 size={13} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Avatar profile={person ?? null} size={18} />
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {person?.full_name || person?.email || "משתמש לא ידוע"}
                        </span>
                        <span>
                          {ACTION_VERBS[log.action_type]} {ENTITY_LABELS[log.entity_type]}
                        </span>
                        {entityName && (
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            &quot;{entityName}&quot;
                          </span>
                        )}
                        <span className="text-slate-400 dark:text-slate-500">
                          · {formatSessionDate(log.created_at)} {formatSessionTime(log.created_at)}
                        </span>
                      </div>

                      {log.action_type === "update" && changedKeys.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {changedKeys.map((key) => (
                            <li key={key}>
                              {ACTIVITY_FIELD_LABELS[key] ?? key}:{" "}
                              <span className="line-through opacity-70">
                                {formatFieldValue(key, log.previous_state?.[key], profiles, groupNameByGroupId)}
                              </span>{" "}
                              ←{" "}
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {formatFieldValue(key, log.new_state?.[key], profiles, groupNameByGroupId)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {errorById[log.id] && (
                        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errorById[log.id]}</p>
                      )}
                    </div>

                    {log.undone_at ? (
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">בוטל</span>
                    ) : readOnly ? null : (
                      <button
                        onClick={() => handleUndo(log)}
                        disabled={undoingId === log.id}
                        title="ביטול פעולה זו"
                        className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 dark:border-night-700 dark:text-slate-400 dark:hover:border-brand-700 dark:hover:text-brand-400"
                      >
                        <Undo2 size={12} />
                        {undoingId === log.id ? "מבטל..." : "ביטול"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
