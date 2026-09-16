import type { ItemStatus } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "לא התחיל",
  working: "בתהליך עבודה",
  stuck: "תקוע",
  done: "הושלם",
};

export const STATUS_COLORS: Record<ItemStatus, { bg: string; text: string; dot: string }> = {
  not_started: { bg: "bg-slate-200", text: "text-slate-700", dot: "#c4c4c4" },
  working: { bg: "bg-amber-400", text: "text-white", dot: "#fdab3d" },
  stuck: { bg: "bg-rose-500", text: "text-white", dot: "#e2445c" },
  done: { bg: "bg-emerald-500", text: "text-white", dot: "#00c875" },
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
