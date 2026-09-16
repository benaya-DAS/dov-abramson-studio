import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { getWorkspacesWithBoards } from "@/lib/data";

export default async function HomePage() {
  const workspaces = await getWorkspacesWithBoards();

  // Truly nothing configured yet (not even a workspace) — that's the only
  // case that sends visitors to the standalone, sidebar-less onboarding
  // screen. Once at least one workspace exists, it belongs in the sidebar
  // here in the app shell, even before any board has been created.
  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  const firstBoard = workspaces.flatMap((w) => w.boards)[0];

  if (firstBoard) {
    redirect(`/board/${firstBoard.id}`);
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-panel dark:border-night-700 dark:bg-night-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl dark:bg-brand-900/40">
          <LayoutGrid className="text-brand-600 dark:text-brand-400" size={22} />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          יש {workspaces.length} מחלקות אך עדיין אין לוחות
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          המחלקות שלכם מוצגות בתפריט הצד מימין. לחצו על &quot;לוח חדש&quot; מתחת לשם אחת מהן
          כדי ליצור את הלוח הראשון, או הריצו את{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-night-700">supabase/seed.sql</code> לטעינת
          לוחות לדוגמה.
        </p>
      </div>
    </div>
  );
}
