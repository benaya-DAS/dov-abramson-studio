// Board table columns: their order and widths are a per-user preference
// (profiles.table_layout), shared across every board and every group's
// table. The item-name column is always first (it's the frozen sticky
// column), so it can be resized but not moved - it isn't part of `order`.

export type MovableColumnKey =
  | "person"
  | "deliverable"
  | "status"
  | "serial"
  | "start_date"
  | "due_date"
  | "hours"
  | "time";

export type ColumnKey = "name" | MovableColumnKey;

export type TableLayout = {
  order: MovableColumnKey[];
  widths: Partial<Record<ColumnKey, number>>;
};

export const COLUMNS: Record<
  ColumnKey,
  {
    label: string;
    /** Desktop width in px when the user hasn't resized it. */
    defaultWidth: number;
    minWidth: number;
    /** Mobile width (Tailwind class) - on mobile the table keeps its
     * auto layout and these fixed defaults, see GroupSection. */
    mobileClass: string;
    /** Horizontal padding/alignment shared by the header and body cells. */
    cellClass: string;
  }
> = {
  name: { label: "פריט", defaultWidth: 260, minWidth: 120, mobileClass: "", cellClass: "px-2" },
  person: { label: "איש צוות", defaultWidth: 72, minWidth: 56, mobileClass: "w-16", cellClass: "px-1" },
  deliverable: { label: "תוצר עיצובי", defaultWidth: 208, minWidth: 90, mobileClass: "w-52", cellClass: "px-2 text-right" },
  status: { label: "סטטוס", defaultWidth: 128, minWidth: 90, mobileClass: "w-32", cellClass: "px-1" },
  serial: { label: 'מס"ד', defaultWidth: 112, minWidth: 70, mobileClass: "w-28", cellClass: "px-2" },
  start_date: { label: "תאריך התחלה", defaultWidth: 128, minWidth: 110, mobileClass: "w-32", cellClass: "px-2" },
  due_date: { label: "תאריך יעד", defaultWidth: 128, minWidth: 110, mobileClass: "w-32", cellClass: "px-2" },
  hours: { label: "שעות", defaultWidth: 80, minWidth: 56, mobileClass: "w-20", cellClass: "px-2 text-center" },
  time: { label: "מעקב זמן", defaultWidth: 128, minWidth: 100, mobileClass: "w-32", cellClass: "px-2" },
};

export const DEFAULT_ORDER: MovableColumnKey[] = [
  "person",
  "deliverable",
  "status",
  "serial",
  "start_date",
  "due_date",
  "hours",
  "time",
];

export const DEFAULT_LAYOUT: TableLayout = { order: DEFAULT_ORDER, widths: {} };

export function columnWidth(layout: TableLayout, key: ColumnKey): number {
  return layout.widths[key] ?? COLUMNS[key].defaultWidth;
}

/** Turns whatever is stored in profiles.table_layout (possibly null, from
 * an older version of the app, or hand-edited) into a valid layout:
 * unknown columns are dropped, duplicates removed, columns added since it
 * was saved appended at the end, and widths clamped to each minimum. */
export function normalizeLayout(raw: unknown): TableLayout {
  if (!raw || typeof raw !== "object") return DEFAULT_LAYOUT;
  const { order, widths } = raw as { order?: unknown; widths?: unknown };

  const seen = new Set<MovableColumnKey>();
  if (Array.isArray(order)) {
    for (const key of order) {
      if ((DEFAULT_ORDER as unknown[]).includes(key)) seen.add(key as MovableColumnKey);
    }
  }
  for (const key of DEFAULT_ORDER) seen.add(key);

  const cleanWidths: TableLayout["widths"] = {};
  if (widths && typeof widths === "object") {
    for (const [key, value] of Object.entries(widths)) {
      if (key in COLUMNS && typeof value === "number" && Number.isFinite(value)) {
        cleanWidths[key as ColumnKey] = Math.max(COLUMNS[key as ColumnKey].minWidth, Math.round(value));
      }
    }
  }

  return { order: [...seen], widths: cleanWidths };
}
