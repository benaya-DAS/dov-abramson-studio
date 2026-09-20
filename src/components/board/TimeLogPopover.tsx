"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/topbar/UserMenu";
import { createClient } from "@/lib/supabase/client";
import { blurActiveElement, formatDuration, formatDurationCompact, formatSessionDate, formatSessionTime } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import SessionEditView from "./SessionEditView";
import FloatingPanel from "@/components/ui/FloatingPanel";
import type { Profile, TimeLog } from "@/lib/supabase/types";

export default function TimeLogPopover({
  anchorRef,
  itemId,
  currentUserId,
  profiles,
  totalSeconds,
  readOnly,
  onClose,
  onChanged,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  itemId: string;
  currentUserId: string | null;
  profiles: Profile[];
  totalSeconds: number;
  readOnly?: boolean;
  onClose: () => void;
  /** Notifies BoardWorkspace to re-fetch totals immediately after a manual
   * add/edit/delete/clear, instead of waiting on the realtime round-trip. */
  onChanged: () => void;
}) {
  const [sessions, setSessions] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSession, setEditingSession] = useState<TimeLog | "new" | null>(null);
  // The most recently deleted session, kept around just long enough to
  // offer an undo instead of a native confirm() dialog before deleting.
  const [pendingUndo, setPendingUndo] = useState<TimeLog | null>(null);

  useEffect(() => {
    if (!pendingUndo) return;
    const timer = setTimeout(() => setPendingUndo(null), 6000);
    return () => clearTimeout(timer);
  }, [pendingUndo]);

  function close() {
    blurActiveElement();
    onClose();
  }

  useEscapeKey(close);

  const fetchSessions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("time_logs")
      .select("*")
      .eq("item_id", itemId)
      .order("start_time", { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    // Fetch-on-mount to load this item's session list when the popover opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessions();
  }, [fetchSessions]);

  async function handleDelete(session: TimeLog) {
    // Deletes immediately - no native confirm() dialog - and offers undo
    // instead (a fresh delete replaces whatever undo was already pending,
    // matching a standard single-slot toast).
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    const supabase = createClient();
    const { error } = await supabase.from("time_logs").delete().eq("id", session.id);
    if (error) {
      console.error("Failed to delete time session:", error);
      fetchSessions();
      return;
    }
    setPendingUndo(session);
    onChanged();
  }

  async function handleUndoDelete() {
    if (!pendingUndo) return;
    const session = pendingUndo;
    setPendingUndo(null);
    const supabase = createClient();
    // A fresh row (new id) with the same item/user/start/end - end_time
    // null vs. set decides whether it comes back as active or completed,
    // and duration_seconds is recomputed by the usual trigger either way.
    const { error } = await supabase.from("time_logs").insert({
      item_id: session.item_id,
      user_id: session.user_id,
      start_time: session.start_time,
      end_time: session.end_time,
    });
    if (error) {
      console.error("Failed to undo time session delete:", error);
      return;
    }
    fetchSessions();
    onChanged();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={close} />
      <FloatingPanel
        anchorRef={anchorRef}
        className="z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-right shadow-xl dark:border-night-700 dark:bg-night-800"
      >
        {editingSession !== null ? (
          <SessionEditView
            session={editingSession === "new" ? null : editingSession}
            itemId={itemId}
            userId={currentUserId!}
            onBack={() => setEditingSession(null)}
            onSaved={() => {
              setEditingSession(null);
              fetchSessions();
              onChanged();
            }}
          />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-night-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">יומן מעקב זמן</h3>
              <button onClick={close} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <X size={14} />
              </button>
            </div>

            {pendingUndo && (
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-night-700 dark:bg-night-900/40">
                <span className="text-xs text-slate-500 dark:text-slate-400">הרישום נמחק</span>
                <button
                  onClick={handleUndoDelete}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  ביטול
                </button>
              </div>
            )}

            {!readOnly && currentUserId && (
              <div className="border-b border-slate-100 p-2 dark:border-night-700">
                <button
                  onClick={() => setEditingSession("new")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700"
                >
                  <Plus size={14} />
                  הוספת רישום ידני
                </button>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">טוען...</p>
              ) : sessions.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                  עדיין לא נרשם זמן על פריט זה.
                </p>
              ) : (
                <ul>
                  {sessions.map((s) => {
                    const person = profiles.find((p) => p.id === s.user_id);
                    const isOwn = s.user_id === currentUserId;
                    // Any row with a null end_time is a currently-running
                    // session — not just the viewer's own. Checking this
                    // regardless of ownership matters: a teammate's active
                    // session also has a null end_time, and rendering it as
                    // "completed" below would call formatSessionTime(null)
                    // and throw (Intl chokes on an Invalid Date).
                    const isActive = s.end_time === null;
                    const editable = isOwn && !isActive && !readOnly;

                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 border-b border-slate-50 px-4 py-2 last:border-0 hover:bg-slate-50 dark:border-night-700/60 dark:hover:bg-night-700/40"
                      >
                        <Avatar profile={person ?? null} size={22} />
                        <button
                          onClick={() => editable && setEditingSession(s)}
                          disabled={!editable}
                          className="flex flex-1 items-center justify-between gap-2 text-right disabled:cursor-default"
                        >
                          <span className="text-xs text-slate-500 dark:text-slate-400">{formatSessionDate(s.start_time)}</span>
                          <span className="text-xs text-slate-700 dark:text-slate-300">
                            {formatSessionTime(s.start_time)} -{" "}
                            {isActive ? (
                              <span className="font-semibold text-rose-600 dark:text-rose-400">פעיל כעת</span>
                            ) : (
                              formatSessionTime(s.end_time!)
                            )}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {s.duration_seconds != null ? formatDuration(s.duration_seconds) : "—"}
                          </span>
                        </button>
                        {editable && (
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                            title="מחיקת רישום"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-center border-t border-slate-100 bg-slate-50 py-3 dark:border-night-700 dark:bg-night-900/40">
              <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">
                סה&quot;כ {formatDurationCompact(totalSeconds)}
              </span>
            </div>
          </>
        )}
      </FloatingPanel>
    </>
  );
}
