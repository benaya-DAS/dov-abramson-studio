"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Archive, ChevronDown, ChevronLeft, LayoutGrid } from "lucide-react";
import type { WorkspaceWithBoards } from "@/lib/data";
import { blurActiveElement, cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";

// Mobile-only stand-in for the desktop Sidebar (hidden below md - see
// Sidebar.tsx) - a full always-visible column doesn't fit a phone screen,
// so instead this is a single breadcrumb-style bar ("מחלקה > לוח") at the
// top of the app that expands into a tap-to-navigate list on demand,
// rather than trying to shrink the desktop tree down to fit.
export default function MobileWorkspaceNav({ workspaces }: { workspaces: WorkspaceWithBoards[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeBoardId = pathname.startsWith("/board/") ? pathname.slice("/board/".length) : null;
  const activeWorkspace = activeBoardId
    ? workspaces.find((ws) => ws.boards.some((b) => b.id === activeBoardId))
    : null;
  const activeBoard = activeWorkspace?.boards.find((b) => b.id === activeBoardId) ?? null;

  function close() {
    blurActiveElement();
    setOpen(false);
  }

  useEscapeKey(close, open);

  return (
    <div className="relative flex shrink-0 md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 flex-1 items-center gap-1.5 border-b border-slate-200 bg-white px-4 py-2.5 text-right dark:border-night-700 dark:bg-night-900"
      >
        <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          {activeWorkspace?.name ?? "סטודיו דוב אברמסון"}
        </span>
        {activeBoard && (
          <>
            <ChevronLeft size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate text-sm text-slate-500 dark:text-slate-400">{activeBoard.name}</span>
          </>
        )}
        <ChevronDown
          size={14}
          className={cn(
            "mr-auto shrink-0 text-slate-400 transition-transform dark:text-slate-500",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute inset-x-0 top-full z-50 max-h-[70vh] overflow-y-auto border-b border-slate-200 bg-white shadow-lg dark:border-night-700 dark:bg-night-900">
            <ul className="p-2">
              {workspaces.map((ws) => (
                <li key={ws.id} className="mb-1">
                  <p className="truncate px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                    {ws.name}
                  </p>
                  {ws.boards.length === 0 ? (
                    <p className="px-3 py-1 text-xs text-slate-400 dark:text-slate-500">אין לוחות</p>
                  ) : (
                    <ul>
                      {ws.boards.map((board) => (
                        <li key={board.id}>
                          <Link
                            href={`/board/${board.id}`}
                            onClick={close}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-800",
                              board.id === activeBoardId &&
                                "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                            )}
                          >
                            <LayoutGrid size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
                            <span className="truncate">{board.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-200 p-2 dark:border-night-700">
              <Link
                href="/archive"
                onClick={close}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-800"
              >
                <Archive size={16} />
                ארכיון לוחות
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
