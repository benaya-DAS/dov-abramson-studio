"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDurationPadded } from "@/lib/utils";
import type { TimeLog } from "@/lib/supabase/types";

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function toDateInput(d: Date) {
  return format(d, "yyyy-MM-dd");
}
function toTimeInput(d: Date) {
  return format(d, "HH:mm");
}

export default function SessionEditView({
  session,
  itemId,
  userId,
  onBack,
  onSaved,
}: {
  session: TimeLog | null;
  itemId: string;
  userId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const initialStart = session ? new Date(session.start_time) : now;
  const initialEnd = session?.end_time ? new Date(session.end_time) : now;

  const [date, setDate] = useState(toDateInput(initialStart));
  const [cursor, setCursor] = useState(initialStart);
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(toTimeInput(initialEnd));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationSeconds = useMemo(() => {
    if (!date || !startTime || !endTime) return 0;
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  }, [date, startTime, endTime]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const invalid = durationSeconds <= 0;

  async function handleSave() {
    if (invalid) {
      setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
      return;
    }
    setSaving(true);
    setError(null);

    const startIso = new Date(`${date}T${startTime}:00`).toISOString();
    const endIso = new Date(`${date}T${endTime}:00`).toISOString();
    const supabase = createClient();

    const { error } = session
      ? await supabase
          .from("time_logs")
          .update({ start_time: startIso, end_time: endIso })
          .eq("id", session.id)
      : await supabase
          .from("time_logs")
          .insert({ item_id: itemId, user_id: userId, start_time: startIso, end_time: endIso });

    if (error) {
      console.error("Failed to save time session:", error);
      setError("שמירת הרישום נכשלה. נסו שוב.");
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-night-700">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">עדכון רישום</h3>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowRight size={14} />
          חזרה
        </button>
      </div>

      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
          >
            <ChevronRight size={14} />
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {format(cursor, "LLLL yyyy", { locale: he })}
          </span>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = toDateInput(day);
            const selected = key === date;
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, now);
            return (
              <button
                key={key}
                onClick={() => setDate(key)}
                className={`rounded-md py-1.5 text-xs ${
                  selected
                    ? "bg-brand-600 font-semibold text-white"
                    : today
                      ? "font-semibold text-brand-700 dark:text-brand-400"
                      : inMonth
                        ? "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
                        : "text-slate-300 hover:bg-slate-50 dark:text-slate-600 dark:hover:bg-night-800"
                }`}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">שעת התחלה</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-night-600 dark:bg-night-900 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">שעת סיום</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-night-600 dark:bg-night-900 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-500 dark:text-red-400">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
            {formatDurationPadded(durationSeconds)}
          </span>
          <button
            onClick={handleSave}
            disabled={saving || invalid}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "שומר..." : "עדכון רישום"}
          </button>
        </div>
      </div>
    </div>
  );
}
