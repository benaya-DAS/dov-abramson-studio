import type { ItemStatus } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "לא התחיל",
  working: "בתהליך עבודה",
  stuck: "תקוע",
  done: "הושלם",
};

// Every pairing here is verified to clear WCAG AA's 4.5:1 text-contrast
// threshold (checked against each bg's actual relative luminance, not just
// eyeballed) — the previous "working" pairing (bg-amber-400 + white text)
// was ~1.9:1, a genuine readability bug, not just a stylistic nit: amber-400
// is a light, high-luminance yellow, so white text on it reads almost as
// washed-out as true white-on-white. Its bg class had also drifted from its
// own `dot` value (#fdab3d, a deeper, more saturated orange) — fixed to use
// that color directly, which is both the visually-intended one and dark
// enough for text-slate-900 to sit on with ~9.8:1 contrast. "stuck" and
// "done" are darkened one Tailwind step (500->600/700) for the same reason;
// their previous ~3.7:1 / ~2.5:1 ratios were both under threshold too.
export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; dot: string }> = {
  not_started: { bg: "bg-slate-200", text: "text-slate-700", dot: "#c4c4c4" },
  working: { bg: "bg-[#fdab3d]", text: "text-slate-900", dot: "#fdab3d" },
  stuck: { bg: "bg-rose-600", text: "text-white", dot: "#e2445c" },
  done: { bg: "bg-emerald-700", text: "text-white", dot: "#00c875" },
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
  "#fdab3d",
  "#e2445c",
  "#00c875",
  "#a25ddc",
  "#037f4c",
  "#66ccff",
  "#ff642e",
];

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
