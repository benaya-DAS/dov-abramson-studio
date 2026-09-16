/**
 * Parsing rules for the customer catalog Excel files.
 *
 * The source file has (at least):
 *   Column A: "הגדרת אירוע"  — a free-text event/project definition that is
 *             frequently prefixed with the serial number and a separator,
 *             e.g. "2590543 - Pilgrims episode 1" or "2590543_Pilgrims episode 1".
 *   Column B: "מס\"ד"        — the canonical serial number for the row.
 *
 * cleanTitle() strips a redundant leading serial-number prefix (and its
 * separator) from Column A so what remains is the pure, human-readable
 * project title — "Pilgrims episode 1" in the example above.
 */

const SEPARATORS = /^\s*[-–—_:|]\s*/;

export function cleanTitle(rawText: string, serialId?: string | null): string {
  let text = (rawText ?? "").trim();
  if (!text) return "";

  // If we know the serial for this row, strip it specifically first
  // (handles serials that contain punctuation of their own).
  if (serialId) {
    const escaped = serialId.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const withKnownSerial = new RegExp(`^\\s*${escaped}\\s*`);
    if (withKnownSerial.test(text)) {
      text = text.replace(withKnownSerial, "");
      text = text.replace(SEPARATORS, "");
      return text.trim();
    }
  }

  // Otherwise, heuristically strip any leading run of digits (a serial
  // number) followed by a separator, e.g. "2590543 - Title" -> "Title".
  const genericPrefix = /^\s*\d{3,}\s*[-–—_:|]\s*/;
  if (genericPrefix.test(text)) {
    text = text.replace(genericPrefix, "");
  }

  return text.trim();
}

export interface CatalogRow {
  serialId: string;
  title: string;
  rawText: string;
}

/**
 * Given parsed Excel rows keyed by header label, extract clean catalog
 * entries. Accepts either Hebrew header variants used across studio files.
 */
export function extractCatalogRows(
  rows: Record<string, unknown>[]
): CatalogRow[] {
  const SERIAL_KEYS = ['מס"ד', "מספר סידורי", "מס' סידורי", "serial", "id"];
  const TEXT_KEYS = ["הגדרת אירוע", "תיאור", "שם הפרויקט", "title", "description"];

  const findKey = (row: Record<string, unknown>, candidates: string[]) => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
      const match = keys.find((k) => k.trim() === candidate);
      if (match) return match;
    }
    // Fallback: fuzzy contains-match
    for (const candidate of candidates) {
      const match = keys.find((k) => k.includes(candidate.slice(0, 3)));
      if (match) return match;
    }
    return null;
  };

  const out: CatalogRow[] = [];
  for (const row of rows) {
    const serialKey = findKey(row, SERIAL_KEYS);
    const textKey = findKey(row, TEXT_KEYS);
    if (!serialKey || !textKey) continue;

    const serialId = String(row[serialKey] ?? "").trim();
    const rawText = String(row[textKey] ?? "").trim();
    if (!serialId || !rawText) continue;

    out.push({
      serialId,
      title: cleanTitle(rawText, serialId),
      rawText,
    });
  }
  return out;
}
