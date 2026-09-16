"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CreateFirstWorkspaceForm() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("workspaces").insert({ name: trimmed, position: 0 });

    if (error) {
      // Most likely cause: the signed-in user has no public.profiles row
      // yet (created automatically on sign-in, backfilled by schema.sql
      // for any account missing one) — is_studio_member() then rejects
      // the write. Not the current studio-domain check: that would have
      // blocked sign-in entirely, before this form was ever reachable.
      console.error("Failed to create workspace:", error);
      setError("יצירת המחלקה נכשלה. נסו לרענן את הדף ולהתחבר מחדש, ואז לנסות שוב.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2 text-right">
      <label htmlFor="workspace-name" className="text-xs font-medium text-slate-500">
        שם המחלקה הראשונה
      </label>
      <input
        id="workspace-name"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='למשל: "מחלקת דיזיין - הסלון"'
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        <FolderPlus size={16} />
        {loading ? "יוצר מחלקה..." : "יצירת מחלקה"}
      </button>
    </form>
  );
}
