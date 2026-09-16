"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/topbar/UserMenu";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, formatDurationCompact, formatSessionDate, formatSessionTime } from "@/lib/utils";
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

  async function handleDelete(id: string) {
    if (!confirm("למחוק את הרישום הזה?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("time_logs").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete time session:", error);
      return;
    }
    fetchSessions();
    onChanged();
  }

  async function handleClear() {
    if (!currentUserId) return;
    if (!confirm("למחוק את כל הרישומים שלכם עבור הפריט הזה? לא ניתן לבטל פעולה זו.")) return;
    const supabase = createClient();
    // Scoped to the current user regardless — RLS only ever permits
    // deleting your own sessions, so this can't touch anyone else's.
    const { error } = await supabase
      .from("time_logs")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", currentUserId);
    if (error) {
      console.error("Failed to clear time sessions:", error);
      return;
    }
    fetchSessions();
    onChanged();
  }

  function handleExport() {
    const rows = sessions.map((s) => {
      const person = profiles.find((p) => p.id === s.user_id);
      return {
        "איש צוות": person?.full_name || person?.email || "",
        תאריך: formatSessionDate(s.start_time),
        התחלה: formatSessionTime(s.start_time),
        סיום: s.end_time ? formatSessionTime(s.end_time) : "פעיל כעת",
        "משך (שעות)": s.duration_seconds != null ? (s.duration_seconds / 3600).toFixed(2) : "",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["איש צוות", "תאריך", "התחלה", "סיום", "משך (שעות)"],
    });
    worksheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "יומן זמן");
    XLSX.writeFile(workbook, "יומן-מעקב-זמן.xlsx");
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <FloatingPanel
        anchorRef={anchorRef}
        className="z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-right shadow-xl"
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
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">יומן מעקב זמן</h3>
              <div className="flex items-center gap-3">
                {sessions.length > 0 && !readOnly && currentUserId && (
                  <button
                    onClick={handleClear}
                    className="text-xs font-medium text-slate-400 hover:text-red-500"
                  >
                    ניקוי
                  </button>
                )}
                <button
                  onClick={handleExport}
                  disabled={sessions.length === 0}
                  className="text-xs font-medium text-slate-400 hover:text-brand-600 disabled:opacity-40"
                >
                  ייצוא לאקסל
                </button>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!readOnly && currentUserId && (
              <div className="border-b border-slate-100 p-2">
                <button
                  onClick={() => setEditingSession("new")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Plus size={14} />
                  הוספת רישום ידני
                </button>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">טוען...</p>
              ) : sessions.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">
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
                        className="flex items-center gap-2 border-b border-slate-50 px-4 py-2 last:border-0 hover:bg-slate-50"
                      >
                        <Avatar profile={person ?? null} size={22} />
                        <button
                          onClick={() => editable && setEditingSession(s)}
                          disabled={!editable}
                          className="flex flex-1 items-center justify-between gap-2 text-right disabled:cursor-default"
                        >
                          <span className="text-xs text-slate-500">{formatSessionDate(s.start_time)}</span>
                          <span className="text-xs text-slate-700">
                            {formatSessionTime(s.start_time)} -{" "}
                            {isActive ? (
                              <span className="font-semibold text-rose-600">פעיל כעת</span>
                            ) : (
                              formatSessionTime(s.end_time!)
                            )}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {s.duration_seconds != null ? formatDuration(s.duration_seconds) : "—"}
                          </span>
                        </button>
                        {editable && (
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-slate-300 hover:text-red-500"
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

            <div className="flex items-center justify-center border-t border-slate-100 bg-slate-50 py-3">
              <span className="font-mono text-sm font-bold text-slate-700">
                סה&quot;כ {formatDurationCompact(totalSeconds)}
              </span>
            </div>
          </>
        )}
      </FloatingPanel>
    </>
  );
}
