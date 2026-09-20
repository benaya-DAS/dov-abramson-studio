"use client";

import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isWeekend } from "date-fns";
import { he } from "date-fns/locale";
import { Avatar } from "@/components/topbar/UserMenu";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { Item, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const DAY_WIDTH = 34;

export default function BoardGantt({
  items,
  profiles,
  groupNameByGroupId,
}: {
  items: Item[];
  profiles: Profile[];
  groupNameByGroupId: Record<string, string>;
}) {
  const dated = items.filter((i) => i.start_date || i.due_date);

  if (dated.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        אין משימות עם תאריכים כדי להציג בציר הזמן. הוסיפו תאריך התחלה / יעד למשימות בטבלה.
      </div>
    );
  }

  const allDates = dated.flatMap((i) =>
    [i.start_date, i.due_date].filter(Boolean).map((d) => new Date(d + "T00:00:00"))
  );
  const rawStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const rawEnd = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const rangeStart = addDays(rawStart, -2);
  const rangeEnd = addDays(rawEnd, 3);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byGroup = dated.reduce<Record<string, Item[]>>((acc, item) => {
    const key = item.group_id;
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="overflow-auto p-5">
      <div style={{ minWidth: days.length * DAY_WIDTH + 260 }}>
        {/* Header row: day scale */}
        <div className="sticky top-0 z-10 flex bg-white dark:bg-night-900">
          <div className="w-64 shrink-0 border-b border-slate-200 dark:border-night-700" />
          <div className="flex">
            {days.map((d) => (
              <div
                key={d.toISOString()}
                style={{ width: DAY_WIDTH }}
                className={cn(
                  "shrink-0 border-b border-l border-slate-100 py-1 text-center text-[10px] font-medium dark:border-night-800",
                  isWeekend(d) ? "bg-slate-50 text-slate-400 dark:bg-night-800/60 dark:text-slate-500" : "text-slate-500 dark:text-slate-400",
                  format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd") &&
                    "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                )}
              >
                <div>{format(d, "d")}</div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">{format(d, "EEEEEE", { locale: he })}</div>
              </div>
            ))}
          </div>
        </div>

        {Object.entries(byGroup).map(([groupId, groupItems]) => (
          <div key={groupId} className="mb-2">
            <div className="w-64 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              {groupNameByGroupId[groupId] ?? "ללא קבוצה"}
            </div>
            {groupItems.map((item) => {
              const start = item.start_date ? new Date(item.start_date + "T00:00:00") : new Date(item.due_date + "T00:00:00");
              const end = item.due_date ? new Date(item.due_date + "T00:00:00") : start;
              const offset = differenceInCalendarDays(start, rangeStart);
              const span = Math.max(1, differenceInCalendarDays(end, start) + 1);
              const assignees = item.person_ids
                .map((id) => profiles.find((p) => p.id === id))
                .filter((p): p is Profile => !!p);
              const colors = STATUS_COLORS[item.status];

              return (
                <div key={item.id} className="flex items-center" style={{ height: 34 }}>
                  <div className="flex w-64 shrink-0 items-center gap-2 pl-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="relative shrink-0">
                      <Avatar profile={assignees[0] ?? null} size={20} />
                      {assignees.length > 1 && (
                        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-500 text-[8px] font-bold text-white dark:bg-slate-400 dark:text-night-900">
                          +{assignees.length - 1}
                        </span>
                      )}
                    </span>
                    <span className="truncate">{item.name || "(ללא שם)"}</span>
                  </div>
                  <div className="relative flex" style={{ width: days.length * DAY_WIDTH, height: 26 }}>
                    <div
                      title={`${item.status_label?.trim() || STATUS_LABELS[item.status]} · ${item.name}`}
                      style={{
                        insetInlineStart: offset * DAY_WIDTH + 2,
                        width: span * DAY_WIDTH - 4,
                      }}
                      className={cn(
                        "absolute top-0 flex h-6 items-center justify-center rounded-md px-2 text-[10px] font-semibold shadow-sm",
                        colors.bg,
                        colors.text
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
