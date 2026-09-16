"use client";

import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDateHe } from "@/lib/utils";
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
        סטטוס: STATUS_LABELS[item.status],
        'מס"ד': item.serial_id ?? "",
        "תאריך התחלה": formatDateHe(item.start_date),
        "תאריך יעד": formatDateHe(item.due_date),
        שעות: item.hours,
        "זמן במעקב (שעות)": ((trackedSecondsByItem[item.id] ?? 0) / 3600).toFixed(2),
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
        "זמן במעקב (שעות)",
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
      { wch: 16 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "דוח חודשי");
    XLSX.writeFile(workbook, `${boardName || "דוח-לוח"}.xlsx`);
  }

  return (
    <button
      onClick={exportReport}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      title="ייצוא דוח חודשי ל-Excel"
    >
      <Download size={14} />
      ייצוא לאקסל
    </button>
  );
}
