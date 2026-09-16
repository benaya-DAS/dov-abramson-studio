import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function formatHours(hours: number) {
  return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(hours);
}

export function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatDateHe(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

// Compact "Xh Ym Zs" duration, omitting a zero hours part — used for the
// time-log total button (e.g. "50m 20s").
export function formatDurationCompact(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return (h > 0 ? [`${h}h`] : []).concat([`${m}m`, `${s}s`]).join(" ");
}

// Zero-padded "00h 00m 00s" duration — used for the session edit view's
// live-recalculated total while typing a start/end time.
export function formatDurationPadded(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// Session-row date label, e.g. "9 בספט׳".
export function formatSessionDate(dateStr: string) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(d);
}

// Session-row time label, 24-hour, e.g. "14:41".
export function formatSessionTime(dateStr: string) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
