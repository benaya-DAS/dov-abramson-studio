import type { ItemStatus } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "לא התחיל",
  working: "בתהליך עבודה",
  stuck: "תקוע",
  done: "הושלם",
};

// Every pairing here is verified to clear WCAG AA's 4.5:1 text-contrast
// threshold with real headroom (checked against each bg's actual relative
// luminance, not just eyeballed) — the original "working" pairing
// (bg-amber-400 + white text) was ~1.9:1, a genuine readability bug, not
// just a stylistic nit: amber-400 is a light, high-luminance yellow, so
// white text on it reads almost as washed-out as true white-on-white. Its
// bg class had also drifted from its own `dot` value (#fdab3d, a deeper,
// more saturated orange) — fixed to use that color directly, which is both
// the visually-intended one and dark enough for text-slate-900 to sit on
// with ~9.8:1 contrast. "done" (emerald-700 + white) sits at ~5.35:1.
// "stuck" started at rose-600 (~4.54:1) - technically passing but with
// almost no margin, so it's one step further to rose-700 (~6.3:1) for a
// safer buffer against any hover/brightness-filter dimming pushing it back
// under threshold.
export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; dot: string }> = {
  not_started: { bg: "bg-slate-200", text: "text-slate-700", dot: "#c4c4c4" },
  working: { bg: "bg-[#fdab3d]", text: "text-slate-900", dot: "#fdab3d" },
  stuck: { bg: "bg-rose-700", text: "text-white", dot: "#e2445c" },
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
