"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/topbar/UserMenu";
import type { Profile } from "@/lib/supabase/types";
import { blurActiveElement, cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import FloatingPanel from "@/components/ui/FloatingPanel";

// Beyond this many assignees, the trigger button collapses the rest into
// a single "+N" badge instead of growing the row indefinitely.
const MAX_AVATARS_SHOWN = 3;

export default function PersonPicker({
  profiles,
  personIds,
  onChange,
  readOnly,
}: {
  profiles: Profile[];
  personIds: string[];
  onChange?: (personIds: string[]) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const assigned = personIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is Profile => !!p);

  function close() {
    blurActiveElement();
    setOpen(false);
  }

  useEscapeKey(close, open);

  function toggle(id: string) {
    if (!onChange) return;
    onChange(personIds.includes(id) ? personIds.filter((pid) => pid !== id) : [...personIds, id]);
  }

  const title = assigned.length > 0 ? assigned.map((p) => p.full_name || p.email).join(", ") : "לא הוקצה";

  return (
    <div className="flex w-full justify-center">
      <button
        ref={buttonRef}
        onClick={() => !readOnly && setOpen((o) => !o)}
        className={cn(
          "flex items-center rounded-full px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-night-700",
          readOnly && "cursor-default hover:bg-transparent dark:hover:bg-transparent"
        )}
        title={title}
      >
        {assigned.length === 0 ? (
          <Avatar profile={null} size={26} />
        ) : (
          <span className="flex items-center -space-x-2 space-x-reverse">
            {assigned.slice(0, MAX_AVATARS_SHOWN).map((p) => (
              <span key={p.id} className="rounded-full ring-2 ring-white dark:ring-night-900">
                <Avatar profile={p} size={26} />
              </span>
            ))}
            {assigned.length > MAX_AVATARS_SHOWN && (
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-night-700 dark:text-slate-300 dark:ring-night-900">
                +{assigned.length - MAX_AVATARS_SHOWN}
              </span>
            )}
          </span>
        )}
      </button>

      {open && !readOnly && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <FloatingPanel
            anchorRef={buttonRef}
            className="z-50 max-h-64 w-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-night-700 dark:bg-night-800"
          >
            {personIds.length > 0 && (
              <button
                onClick={() => {
                  onChange?.([]);
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-night-700"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs dark:bg-night-700">
                  ✕
                </span>
                ללא הקצאה
              </button>
            )}
            {profiles.map((p) => {
              const selected = personIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-night-700",
                    selected && "bg-brand-50 dark:bg-brand-900/30"
                  )}
                >
                  <Avatar profile={p} size={22} />
                  <span className="min-w-0 flex-1 truncate text-right">{p.full_name || p.email}</span>
                  {selected && <Check size={14} className="shrink-0 text-brand-600 dark:text-brand-400" />}
                </button>
              );
            })}
          </FloatingPanel>
        </>
      )}
    </div>
  );
}
