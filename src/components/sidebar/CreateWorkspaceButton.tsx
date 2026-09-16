"use client";

import { useState, useTransition } from "react";
import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateWorkspaceButton({ nextPosition }: { nextPosition: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function createWorkspace() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("workspaces")
      .insert({ name: trimmed, position: nextPosition });

    if (error) {
      // Most likely cause: the signed-in user has no public.profiles row
      // yet, so is_studio_member() (and therefore the workspaces insert
      // policy) rejects the write. That row is created automatically on
      // sign-in, so a refresh usually clears this; schema.sql also
      // backfills it for any account missing one.
      setError("יצירת המחלקה נכשלה. נסו לרענן את הדף ולנסות שוב.");
      return;
    }

    setEditing(false);
    setName("");
    startTransition(() => {
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="px-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={createWorkspace}
          onKeyDown={(e) => {
            if (e.key === "Enter") createWorkspace();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="שם המחלקה החדשה"
          className="w-full rounded-md border border-brand-300 px-2 py-1.5 text-sm outline-none"
        />
        {error && <p className="mt-1 px-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-brand-600"
    >
      <FolderPlus size={16} />
      מחלקה חדשה
    </button>
  );
}
