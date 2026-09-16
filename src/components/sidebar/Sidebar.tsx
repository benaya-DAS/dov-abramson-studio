"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronLeft, Archive, LayoutGrid } from "lucide-react";
import type { WorkspaceWithBoards } from "@/lib/data";
import { cn } from "@/lib/utils";
import CreateBoardButton from "./CreateBoardButton";
import CreateWorkspaceButton from "./CreateWorkspaceButton";

export default function Sidebar({ workspaces }: { workspaces: WorkspaceWithBoards[] }) {
  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
        <Image
          src="/web-app-manifest-512x512.png"
          alt="סטודיו דב אברמסון"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">סטודיו דב אברמסון</p>
          <p className="text-xs text-slate-400">ניהול פרויקטים</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {workspaces.map((ws) => (
            <WorkspaceItem key={ws.id} workspace={ws} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-2">
        <CreateWorkspaceButton nextPosition={workspaces.length} />
        <Link
          href="/archive"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          )}
        >
          <Archive size={16} />
          ארכיון לוחות
        </Link>
      </div>
    </aside>
  );
}

function WorkspaceItem({ workspace }: { workspace: WorkspaceWithBoards }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const hasActiveBoard = workspace.boards.some((b) => pathname === `/board/${b.id}`);

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm font-semibold text-slate-700 hover:bg-slate-100",
          hasActiveBoard && "text-brand-700"
        )}
      >
        {open ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
        <span className="flex-1 truncate">{workspace.name}</span>
      </button>

      {open && (
        <ul className="mr-4 mt-1 space-y-0.5 border-r border-slate-100 pr-2">
          {workspace.boards.map((board) => {
            const active = pathname === `/board/${board.id}`;
            return (
              <li key={board.id}>
                <Link
                  href={`/board/${board.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100",
                    active && "bg-brand-50 font-semibold text-brand-700"
                  )}
                >
                  <LayoutGrid size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{board.name}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <CreateBoardButton workspaceId={workspace.id} />
          </li>
        </ul>
      )}
    </li>
  );
}
