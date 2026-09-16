"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NewMonthButton({ boardId, boardName }: { boardId: string; boardName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function rollover() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("rollover_board_month", { p_board_id: boardId });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setConfirming(false);
    router.refresh();
    if (data?.id) router.push(`/board/${data.id}`);
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        <CalendarPlus size={14} />
        חודש חדש
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">פתיחת חודש חדש</h2>
              <button onClick={() => setConfirming(false)} className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              הפעולה תארכב את הלוח &quot;{boardName}&quot; במצב לקריאה בלבד, ותיצור לוח חדש לחודש
              הבא עם אותן קבוצות ועמודות — ללא המשימות והשעות שנרשמו החודש. לא ניתן לבטל פעולה זו.
            </p>
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ביטול
              </button>
              <button
                onClick={rollover}
                disabled={loading}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "מעבד..." : "אישור - פתיחת חודש חדש"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
