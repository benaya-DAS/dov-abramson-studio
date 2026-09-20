"use client";

import { useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { ItemStatus } from "@/lib/supabase/types";
import { blurActiveElement, cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import FloatingPanel from "@/components/ui/FloatingPanel";

export default function StatusBadge({
  status,
  customLabel,
  onChange,
  onCustomLabelChange,
  readOnly,
}: {
  status: ItemStatus;
  /** Optional free-text override shown instead of STATUS_LABELS[status]
   * (e.g. "ממתין לאישור לקוח"), while the status itself still drives the
   * badge's color and everything that groups/sorts/filters by it. */
  customLabel?: string | null;
  onChange?: (status: ItemStatus) => void;
  onCustomLabelChange?: (label: string | null) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState(customLabel ?? "");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  // Escape needs to CANCEL an in-progress custom-label edit rather than
  // commit it - but closing the popover blurs the input, which would
  // otherwise trigger the normal onBlur={commitLabel} save. This flag lets
  // the Escape path suppress exactly that one resulting commit, without
  // touching the outside-click/other-close paths where blurring an
  // in-progress edit SHOULD still save it (the same blur-to-save
  // convention used everywhere else in the app).
  const cancelingLabelRef = useRef(false);
  const colors = STATUS_COLORS[status];
  const displayLabel = customLabel?.trim() || STATUS_LABELS[status];

  // Re-sync the draft to the real value on the closed->open transition,
  // adjusted during render (React's documented pattern for "adjusting
  // state when a prop changes") rather than in an effect — no extra tick,
  // and no risk of it firing on every render while open.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setLabelDraft(customLabel ?? "");
  }

  function commitLabel() {
    if (cancelingLabelRef.current) {
      cancelingLabelRef.current = false;
      return;
    }
    const trimmed = labelDraft.trim();
    if (trimmed !== (customLabel ?? "").trim()) {
      onCustomLabelChange?.(trimmed || null);
    }
  }

  function close() {
    blurActiveElement();
    setOpen(false);
  }

  // Backstops Escape for every focus state inside the popover (a status
  // button, the toggle button itself, or nothing), and additionally
  // cancels an in-progress custom-label edit - reverting the draft and
  // arming cancelingLabelRef so the blur this triggers doesn't save it -
  // when the label input specifically is what's focused.
  useEscapeKey(() => {
    if (document.activeElement === labelInputRef.current) {
      cancelingLabelRef.current = true;
      setLabelDraft(customLabel ?? "");
    }
    close();
  }, open);

  if (readOnly || !onChange) {
    return (
      <span
        className={cn(
          "inline-flex w-full items-center justify-center truncate rounded px-2 py-1.5 text-xs font-semibold",
          colors.bg,
          colors.text
        )}
        title={displayLabel}
      >
        {displayLabel}
      </span>
    );
  }

  return (
    <div className="w-full">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-center truncate rounded px-2 py-1.5 text-xs font-semibold outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
          colors.bg,
          colors.text
        )}
        title={displayLabel}
      >
        {displayLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <FloatingPanel
            anchorRef={buttonRef}
            className="z-50 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-night-700 dark:bg-night-800"
          >
            <div className="mb-1 space-y-1">
              {STATUS_ORDER.map((s) => {
                const selected = s === status;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-offset-1",
                      STATUS_COLORS[s].bg,
                      STATUS_COLORS[s].text,
                      selected && "ring-2 ring-slate-400 ring-offset-1 dark:ring-slate-500 dark:ring-offset-night-800"
                    )}
                  >
                    {selected && <Check size={12} strokeWidth={3} />}
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-slate-100 pt-1.5 dark:border-night-700">
              <label className="mb-1 block px-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                טקסט מותאם אישית
              </label>
              <div className="flex items-center gap-1">
                <input
                  ref={labelInputRef}
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={(e) => {
                    // Just blur on Enter, rather than also calling
                    // commitLabel() here directly - the onBlur={commitLabel}
                    // above fires exactly once from that blur, so this can't
                    // double-commit the same value (calling commitLabel()
                    // twice synchronously, once here and once from the
                    // resulting blur, would send the same update twice
                    // before either write's response updates the
                    // customLabel prop this closure reads). Escape is
                    // handled globally by the useEscapeKey() above, which
                    // also needs to cancel rather than commit - see
                    // cancelingLabelRef.
                    if (e.key === "Enter") close();
                  }}
                  placeholder={STATUS_LABELS[status]}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400 dark:border-night-600 dark:bg-night-900 dark:text-slate-200"
                />
                {customLabel && (
                  <button
                    onClick={() => {
                      setLabelDraft("");
                      onCustomLabelChange?.(null);
                    }}
                    title="איפוס לטקסט ברירת המחדל"
                    className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:text-slate-500 dark:hover:bg-night-700 dark:hover:text-red-400"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </FloatingPanel>
        </>
      )}
    </div>
  );
}
