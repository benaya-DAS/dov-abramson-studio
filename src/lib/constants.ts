import type { ItemStatus } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "לא התחיל",
  working: "בתהליך עבודה",
  stuck: "תקוע",
  done: "הושלם",
};

// A softer "pastel background + dark, same-hue text" style, rather than
// the earlier bold saturated fills — reads as calmer/more pleasant while
// also making the WCAG AA 4.5:1 text-contrast requirement close to
// automatic: dark text on a light tint is inherently high-contrast, so
// none of these pairings are sitting anywhere near the threshold (all
// verified against actual relative luminance, not eyeballed):
// not_started ~6.9:1, working ~6.4:1, stuck ~5.2:1, done ~6.8:1.
// Dark mode mirrors the same idea inverted - a low-opacity tint of the
// hue over the dark page background, with light, same-hue text - rather
// than reusing the light pastel bg, which would look like a washed-out
// paper swatch dropped onto a dark page.
export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; dot: string }> = {
  not_started: {
    bg: "bg-slate-100 dark:bg-slate-700/50",
    text: "text-slate-600 dark:text-slate-300",
    dot: "#94a3b8",
  },
  working: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
    dot: "#f59e0b",
  },
  stuck: {
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-700 dark:text-rose-300",
    dot: "#e2445c",
  },
  done: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-300",
    dot: "#00c875",
  },
};

export const STATUS_ORDER: ItemStatus[] = ["not_started", "working", "stuck", "done"];

export const DELIVERABLE_OPTIONS = [
  "דימוי ובאנרים",
  "מודעות עיתונים",
  "עיצוב דיגיטלי",
  "עיצוב דפוס",
  "אנימציה",
  "סרטון",
  "מצגת",
  "מיתוג",
];

export const GROUP_COLORS = [
  "#579bfc",
  "#0086c0",
  "#66ccff",
  "#037f4c",
  "#00c875",
  "#9cd326",
  "#cab641",
  "#fdab3d",
  "#ff642e",
  "#e2445c",
  "#ff5ac4",
  "#a25ddc",
  "#7f5347",
  "#808080",
  "#333333",
  "#bb3354",
];

// Hebrew labels for item/group columns, used by the Activity Log drawer to
// render a readable "field: old ← new" diff line for update entries.
export const ACTIVITY_FIELD_LABELS: Record<string, string> = {
  name: "שם",
  person_id: "איש צוות",
  deliverable: "תוצר עיצובי",
  status: "סטטוס",
  status_label: "תווית סטטוס",
  serial_id: 'מס"ד',
  start_date: "תאריך התחלה",
  due_date: "תאריך יעד",
  hours: "שעות",
  position: "מיקום",
  group_id: "קבוצה",
  color: "צבע",
  is_collapsed: "מכווץ",
};

export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];
