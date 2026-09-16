"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { extractCatalogRows, type CatalogRow } from "@/lib/catalog/parse";

export default function CatalogImporter({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("parsing");
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = extractCatalogRows(json);
      if (parsed.length === 0) {
        setError('לא נמצאו עמודות "הגדרת אירוע" ו-"מס\\"ד" בקובץ. ודאו שהקובץ תואם למבנה הצפוי.');
        setStatus("error");
        return;
      }
      setRows(parsed);
      setStatus("ready");
    } catch {
      setError("שגיאה בקריאת הקובץ. ודאו שמדובר בקובץ Excel תקין (.xlsx).");
      setStatus("error");
    }
  }

  async function saveCatalog() {
    setStatus("saving");
    const supabase = createClient();
    const { data: userRes } = await supabase.auth.getUser();

    const { error } = await supabase.from("project_catalog").upsert(
      rows.map((r) => ({
        serial_id: r.serialId,
        title: r.title,
        raw_text: r.rawText,
        imported_by: userRes.user?.id ?? null,
      })),
      { onConflict: "serial_id" }
    );

    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    setStatus("done");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-night-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-night-700">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <FileSpreadsheet size={18} className="text-brand-600 dark:text-brand-400" />
            ייבוא קטלוג פרויקטים מקובץ Excel
          </h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            העלו את קובץ ה-Excel של הלקוח. המערכת תזהה את עמודה A (&quot;הגדרת אירוע&quot;) ועמודה B
            (&quot;מס&quot;ד&quot;), תנקה את הקידומת המספרית החוזרת משם הפרויקט, ותשמור את הקטלוג
            לצורך מילוי אוטומטי בלוחות.
          </p>

          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 hover:border-brand-400 hover:text-brand-600 dark:border-night-600 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
          >
            <Upload size={24} />
            <span className="text-sm font-medium">
              {fileName || "לחצו לבחירת קובץ Excel (.xlsx / .xls / .csv)"}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {status === "parsing" && <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">קורא קובץ...</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}

          {rows.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                נמצאו {rows.length} שורות ({status === "done" ? "נשמרו בהצלחה" : "תצוגה מקדימה"}):
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-night-700">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-night-900 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-1.5 text-right">מס&quot;ד</th>
                      <th className="px-2 py-1.5 text-right">כותרת נקייה</th>
                      <th className="px-2 py-1.5 text-right">טקסט מקורי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 text-slate-700 dark:border-night-800 dark:text-slate-300">
                        <td className="px-2 py-1 font-mono">{r.serialId}</td>
                        <td className="px-2 py-1 font-medium">{r.title}</td>
                        <td className="px-2 py-1 text-slate-400 dark:text-slate-500">{r.rawText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-night-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-700"
          >
            {status === "done" ? "סגירה" : "ביטול"}
          </button>
          {status !== "done" && (
            <button
              onClick={saveCatalog}
              disabled={rows.length === 0 || status === "saving"}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {status === "saving" ? "שומר..." : `שמירת ${rows.length} רשומות בקטלוג`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
