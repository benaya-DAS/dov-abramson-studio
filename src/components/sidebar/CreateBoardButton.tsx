"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CreateBoardButton({ workspaceId }: { workspaceId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function createBoard() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("boards")
      .insert({ workspace_id: workspaceId, name: trimmed })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("groups").insert({ board_id: data.id, name: "כללי", position: 0 });
      setEditing(false);
      setName("");
      startTransition(() => {
        router.refresh();
        router.push(`/board/${data.id}`);
      });
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={createBoard}
        onKeyDown={(e) => {
          if (e.key === "Enter") createBoard();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="שם הלוח החדש"
        className="w-full rounded-md border border-brand-300 px-2 py-1 text-sm outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-brand-600"
    >
      <Plus size={14} />
      לוח חדש
    </button>
  );
}
