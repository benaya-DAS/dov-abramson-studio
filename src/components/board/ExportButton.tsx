"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateHe, formatHours } from "@/lib/utils";
import type { Item, Profile } from "@/lib/supabase/types";

export default function ExportButton({
  items,
  profiles,
  groupNameByGroupId,
  boardName,
  trackedSecondsByItem,
}: {
  items: Item[];
  profiles: Profile[];
  groupNameByGroupId: Record<string, string>;
  boardName: string;
  trackedSecondsByItem: Record<string, number>;
}) {
  function exportReport() {
    const rows = items.map((item) => {
      const person = profiles.find((p) => p.id === item.person_id);
      return {
        קבוצה: groupNameByGroupId[item.group_id] ?? "",
        פריט: item.name,
        "איש צוות": person?.full_name || person?.email || "",
        'תוצר עיצובי': item.deliverable ?? "",
        סטטוס: item.status_label?.trim() || STATUS_LABELS[item.status],
        'מס"ד': item.serial_id ?? "",
        "תאריך התחלה": formatDateHe(item.start_date),
        "תאריך יעד": formatDateHe(item.due_date),
        // Decimal hours from time tracking (e.g. 1h30m -> "1.5") - the same
        // value the Hours column shows on screen, not a manual estimate.
        שעות: formatHours((trackedSecondsByItem[item.id] ?? 0) / 3600),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        "קבוצה",
        "פריט",
        "איש צוות",
        "תוצר עיצובי",
        "סטטוס",
        'מס"ד',
        "תאריך התחלה",
        "תאריך יעד",
        "שעות",
      ],
    });
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 8 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "דוח חודשי");
    XLSX.writeFile(workbook, `${boardName || "דוח-לוח"}.xlsx`);
  }

  return (
    <button
      onClick={exportReport}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      title="ייצוא דוח חודשי ל-Excel"
    >
      <Download size={14} />
      ייצוא לאקסל
    </button>
  );
}
