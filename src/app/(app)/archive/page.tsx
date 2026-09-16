import Link from "next/link";
import { Archive, Lock } from "lucide-react";
import { getArchivedBoards } from "@/lib/data";
import { HEBREW_MONTHS } from "@/lib/constants";

export default async function ArchivePage() {
  const boards = await getArchivedBoards();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <Archive size={20} className="text-slate-500" />
        <h1 className="text-lg font-bold text-slate-900">ארכיון לוחות</h1>
      </div>

      {boards.length === 0 ? (
        <p className="text-sm text-slate-400">אין עדיין לוחות בארכיון.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              href={`/board/${board.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel transition hover:border-brand-300 hover:shadow"
            >
              <p className="mb-1 text-xs text-slate-400">
                {(board as unknown as { workspaces?: { name: string } }).workspaces?.name}
              </p>
              <p className="mb-2 font-semibold text-slate-800">{board.name}</p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Lock size={11} />
                  לקריאה בלבד
                </span>
                {board.month && board.year && (
                  <span>
                    {HEBREW_MONTHS[board.month - 1]} {board.year}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
