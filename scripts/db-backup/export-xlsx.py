#!/usr/bin/env python3
"""Human-readable Excel copy of the database, saved next to each .dump
backup (see docs/backups.md): an index sheet, then one sheet per board with
the same columns as the board's own export button (ExportButton.tsx). Only
for reading - restores always use the .dump file.

    SUPABASE_DB_URL=postgresql://... export-xlsx.py <out.xlsx>
"""

import json
import os
import re
import subprocess
import sys
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.worksheet.hyperlink import Hyperlink

STATUS_LABELS = {
    "not_started": "לא התחיל",
    "working": "בתהליך עבודה",
    "stuck": "תקוע",
    "done": "הושלם",
}

# Hours mirror the board's own Hours column: finished time_logs only
# (item_tracked_seconds), not a session still running.
QUERY = """
select coalesce(json_agg(b order by b.is_archived, b.workspace_position, b.position, b.name), '[]')
from (
  select
    bo.name, bo.is_archived, bo.position,
    coalesce(w.name, '') as workspace,
    coalesce(w.position, 0) as workspace_position,
    (
      select coalesce(json_agg(r order by r.group_archived, r.group_position, r.position, r.created_at), '[]')
      from (
        select
          g.name as group_name, g.is_archived as group_archived, g.position as group_position,
          i.position, i.created_at, i.name, i.deliverable, i.status, i.status_label, i.serial_id,
          i.start_date, i.due_date,
          (
            select string_agg(coalesce(nullif(p.full_name, ''), p.email), ', '
                              order by array_position(i.person_ids, p.id))
            from public.profiles p
            where p.id = any(i.person_ids)
          ) as persons,
          coalesce((select t.tracked_seconds from public.item_tracked_seconds t where t.item_id = i.id), 0)
            as seconds
        from public.items i
        join public.groups g on g.id = i.group_id
        where i.board_id = bo.id
      ) r
    ) as items
  from public.boards bo
  left join public.workspaces w on w.id = bo.workspace_id
) b
"""

HEADERS = [
    ("קבוצה", 16),
    ("פריט", 32),
    ("איש צוות", 18),
    ("תוצר עיצובי", 22),
    ("סטטוס", 14),
    ('מס"ד', 12),
    ("תאריך התחלה", 13),
    ("תאריך יעד", 13),
    ("שעות", 9),
    ("משך (HH:MM:SS)", 14),
]

HEADER_FONT = Font(bold=True)
HEADER_FILL = PatternFill("solid", fgColor="E8EEF9")


def fetch_boards():
    out = subprocess.run(
        ["psql", os.environ["SUPABASE_DB_URL"], "--no-psqlrc", "-tA", "-v", "ON_ERROR_STOP=1", "-c", QUERY],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)


def duration(seconds):
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def parse_date(value):
    return date.fromisoformat(value) if value else None


def sheet_title(name, used):
    # Excel: at most 31 chars, none of []:*?/\ , unique ignoring case.
    base = re.sub(r"[\[\]:*?/\\]", "-", name).strip().strip("'") or "בורד"
    base = base[:31]
    title, n = base, 2
    while title.lower() in used:
        suffix = f" ({n})"
        title = base[: 31 - len(suffix)] + suffix
        n += 1
    used.add(title.lower())
    return title


def style_header(ws, widths):
    ws.sheet_view.rightToLeft = True
    ws.freeze_panes = "A2"
    for col, width in enumerate(widths, start=1):
        cell = ws.cell(row=1, column=col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        ws.column_dimensions[cell.column_letter].width = width


def main(out_path):
    boards = fetch_boards()
    wb = Workbook()

    index = wb.active
    index.title = "תוכן עניינים"
    index.append(["בורד", "סביבת עבודה", "סטטוס", "משימות", "גיליון"])
    style_header(index, [36, 20, 10, 10, 34])

    used = {index.title.lower()}
    for board in boards:
        title = sheet_title(board["name"], used)
        ws = wb.create_sheet(title)
        ws.append([h for h, _ in HEADERS])
        style_header(ws, [w for _, w in HEADERS])

        total = 0
        for item in board["items"]:
            seconds = int(item["seconds"])
            total += seconds
            group = item["group_name"] + (" (ארכיון)" if item["group_archived"] else "")
            ws.append([
                group,
                item["name"],
                item["persons"] or "",
                item["deliverable"] or "",
                (item["status_label"] or "").strip() or STATUS_LABELS.get(item["status"], item["status"]),
                item["serial_id"] or "",
                parse_date(item["start_date"]),
                parse_date(item["due_date"]),
                round(seconds / 3600, 2),
                duration(seconds),
            ])
        ws.append(["", "", "", "", "", "", "", 'סה"כ', round(total / 3600, 2), duration(total)])
        for cell in ws[ws.max_row]:
            cell.font = HEADER_FONT
        for row in ws.iter_rows(min_row=2, min_col=7, max_col=8):
            for cell in row:
                cell.number_format = "DD/MM/YYYY"

        index.append([
            board["name"],
            board["workspace"],
            "בארכיון" if board["is_archived"] else "פעיל",
            len(board["items"]),
            title,
        ])
        link = index.cell(row=index.max_row, column=5)
        # An in-workbook jump (location), not an external URL (target).
        link.hyperlink = Hyperlink(ref=link.coordinate, location=f"'{title}'!A1")
        link.style = "Hyperlink"

    wb.save(out_path)
    print(f"{out_path}: {len(boards)} boards")


if __name__ == "__main__":
    if len(sys.argv) != 2 or "SUPABASE_DB_URL" not in os.environ:
        sys.exit("usage: SUPABASE_DB_URL=... export-xlsx.py <out.xlsx>")
    main(sys.argv[1])
