"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateHe, formatDuration, formatHours } from "@/lib/utils";
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
      const assignees = item.person_ids
        .map((id) => profiles.find((p) => p.id === id))
        .filter((p): p is Profile => !!p)
        .map((p) => p.full_name || p.email)
        .join(", ");
      const seconds = trackedSecondsByItem[item.id] ?? 0;
      return {
        קבוצה: groupNameByGroupId[item.group_id] ?? "",
        פריט: item.name,
        "איש צוות": assignees,
        'תוצר עיצובי': item.deliverable ?? "",
        סטטוס: item.status_label?.trim() || STATUS_LABELS[item.status],
        'מס"ד': item.serial_id ?? "",
        "תאריך התחלה": formatDateHe(item.start_date),
        "תאריך יעד": formatDateHe(item.due_date),
        // Decimal hours from time tracking (e.g. 1h30m -> "1.5") - the same
        // value the Hours column shows on screen, not a manual estimate.
        שעות: formatHours(seconds / 3600),
        "משך (HH:MM:SS)": formatDuration(seconds),
      };
    });

    const totalSeconds = items.reduce((sum, item) => sum + (trackedSecondsByItem[item.id] ?? 0), 0);
    rows.push({
      קבוצה: "",
      פריט: "",
      "איש צוות": "",
      'תוצר עיצובי': "",
      סטטוס: "",
      'מס"ד': "",
      "תאריך התחלה": "",
      "תאריך יעד": 'סה"כ',
      שעות: formatHours(totalSeconds / 3600),
      "משך (HH:MM:SS)": formatDuration(totalSeconds),
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
        "משך (HH:MM:SS)",
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
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "דוח חודשי");
    XLSX.writeFile(workbook, `${boardName || "דוח-לוח"}.xlsx`);
  }

  return (
    <button
      onClick={exportReport}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
      title="ייצוא דוח חודשי ל-Excel"
    >
      <Download size={14} />
      ייצוא לאקסל
    </button>
  );
}
