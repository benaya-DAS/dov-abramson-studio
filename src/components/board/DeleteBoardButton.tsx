"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { blurActiveElement } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";

export default function DeleteBoardButton({
  boardId,
  boardName,
}: {
  boardId: string;
  boardName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function close() {
    blurActiveElement();
    setConfirming(false);
  }

  useEscapeKey(close, confirming);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    // groups.board_id / items.board_id / time_logs.item_id are all
    // "on delete cascade" in schema.sql, so this one delete also removes
    // every group, item, and time-tracking record that belonged to the
    // board - nothing to clean up manually.
    const { error } = await supabase.from("boards").delete().eq("id", boardId);

    if (error) {
      console.error("Failed to delete board:", error);
      setError("מחיקת הלוח נכשלה. נסו שוב.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        title="מחיקת לוח"
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-night-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-400"
      >
        <Trash2 size={14} />
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-night-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">מחיקת לוח</h2>
              <button
                onClick={close}
                className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              הפעולה תמחק לצמיתות את הלוח &quot;{boardName}&quot;, כולל כל הקבוצות, המשימות ורישומי
              הזמן שלו. לא ניתן לבטל פעולה זו.
            </p>
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={close}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
              >
                ביטול
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? "מוחק..." : "מחיקת הלוח לצמיתות"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
