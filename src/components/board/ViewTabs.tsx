"use client";

import { Table2, GanttChartSquare, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardView = "table" | "gantt" | "calendar";

const TABS: { id: BoardView; label: string; icon: typeof Table2 }[] = [
  { id: "table", label: "טבלה ראשית", icon: Table2 },
  { id: "gantt", label: "גאנט", icon: GanttChartSquare },
  { id: "calendar", label: "לוח שנה", icon: CalendarDays },
];

export default function ViewTabs({
  view,
  onChange,
}: {
  view: BoardView;
  onChange: (v: BoardView) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 px-5 dark:border-slate-700">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition",
              active
                ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
