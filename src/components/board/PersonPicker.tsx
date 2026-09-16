"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/topbar/UserMenu";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import FloatingPanel from "@/components/ui/FloatingPanel";

export default function PersonPicker({
  profiles,
  personId,
  onChange,
  readOnly,
}: {
  profiles: Profile[];
  personId: string | null;
  onChange?: (personId: string | null) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const person = profiles.find((p) => p.id === personId) ?? null;

  return (
    <div className="flex w-full justify-center">
      <button
        ref={buttonRef}
        onClick={() => !readOnly && setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-1.5 py-1 hover:bg-slate-100",
          readOnly && "cursor-default hover:bg-transparent"
        )}
        title={person?.full_name || person?.email || "לא הוקצה"}
      >
        <Avatar profile={person} size={26} />
      </button>

      {open && !readOnly && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <FloatingPanel
            anchorRef={buttonRef}
            className="z-50 max-h-64 w-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            <button
              onClick={() => {
                onChange?.(null);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs">
                ✕
              </span>
              ללא הקצאה
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange?.(p.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Avatar profile={p} size={22} />
                <span className="truncate">{p.full_name || p.email}</span>
              </button>
            ))}
          </FloatingPanel>
        </>
      )}
    </div>
  );
}
