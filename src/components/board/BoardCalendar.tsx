"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/topbar/UserMenu";
import { STATUS_COLORS } from "@/lib/constants";
import type { Item, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default function BoardCalendar({
  items,
  profiles,
  initialMonth,
  initialYear,
}: {
  items: Item[];
  profiles: Profile[];
  initialMonth: number | null;
  initialYear: number | null;
}) {
  const [cursor, setCursor] = useState(() =>
    initialMonth && initialYear ? new Date(initialYear, initialMonth - 1, 1) : new Date()
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const item of items) {
      const key = item.due_date ?? item.start_date;
      if (!key) continue;
      (map[key] ??= []).push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
          {format(cursor, "LLLL yyyy", { locale: he })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="rounded-md p-1.5 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-800"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-night-800"
          >
            היום
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-md p-1.5 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-800"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 dark:border-night-700">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-b border-slate-200 bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500 dark:border-night-700 dark:bg-night-800/60 dark:text-slate-400"
          >
            {d}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDate[key] ?? [];
          const inMonth = isSameMonth(day, cursor);

          return (
            <div
              key={key}
              className={cn(
                "min-h-[110px] border-b border-l border-slate-100 p-1.5 dark:border-night-800",
                !inMonth && "bg-slate-50/60 dark:bg-night-900/40"
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday(day)
                    ? "bg-brand-600 text-white"
                    : inMonth
                      ? "text-slate-600 dark:text-slate-300"
                      : "text-slate-300 dark:text-slate-600"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayItems.slice(0, 4).map((item) => {
                  const colors = STATUS_COLORS[item.status];
                  const person = profiles.find((p) => p.id === item.person_id) ?? null;
                  return (
                    <div
                      key={item.id}
                      title={item.name}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                        colors.bg,
                        colors.text
                      )}
                    >
                      <Avatar profile={person} size={12} />
                      <span className="truncate">{item.name || "(ללא שם)"}</span>
                    </div>
                  );
                })}
                {dayItems.length > 4 && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">+{dayItems.length - 4} נוספות</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
