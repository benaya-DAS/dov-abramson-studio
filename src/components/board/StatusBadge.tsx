"use client";

import { useState } from "react";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { ItemStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function StatusBadge({
  status,
  onChange,
  readOnly,
}: {
  status: ItemStatus;
  onChange?: (status: ItemStatus) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colors = STATUS_COLORS[status];

  if (readOnly || !onChange) {
    return (
      <span
        className={cn(
          "inline-flex w-full items-center justify-center rounded px-2 py-1.5 text-xs font-semibold",
          colors.bg,
          colors.text
        )}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-center rounded px-2 py-1.5 text-xs font-semibold transition hover:brightness-95",
          colors.bg,
          colors.text
        )}
      >
        {STATUS_LABELS[status]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={cn(
                  "mb-1 flex w-full items-center justify-center rounded px-2 py-1.5 text-xs font-semibold last:mb-0",
                  STATUS_COLORS[s].bg,
                  STATUS_COLORS[s].text
                )}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
