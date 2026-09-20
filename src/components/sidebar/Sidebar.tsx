"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Archive, LayoutGrid } from "lucide-react";
import type { WorkspaceWithBoards } from "@/lib/data";
import type { Board } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import CreateBoardButton from "./CreateBoardButton";
import CreateWorkspaceButton from "./CreateWorkspaceButton";

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 288; // matches the old fixed w-72 (18rem)
const STORAGE_KEY = "sidebar-width";

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

export default function Sidebar({ workspaces }: { workspaces: WorkspaceWithBoards[] }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? Number(stored) : NaN;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Number.isFinite(parsed)) setWidth(clampWidth(parsed));
    } catch {
      // Private browsing / storage blocked - just keep the default width.
    }
  }, []);

  useEffect(() => {
    if (!resizing) return;
    function handleMouseMove(e: MouseEvent) {
      // RTL layout: the sidebar sits flush against the right edge of the
      // viewport, so its width is the distance from the viewport's right
      // edge to the cursor - dragging the handle (on the sidebar's left
      // edge) further left makes it wider.
      setWidth(clampWidth(window.innerWidth - e.clientX));
    }
    function handleMouseUp() {
      setResizing(false);
      setWidth((w) => {
        try {
          localStorage.setItem(STORAGE_KEY, String(w));
        } catch {
          // Private browsing / storage blocked - the width still applies
          // for this session, just won't persist across reloads.
        }
        return w;
      });
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  return (
    <aside
      style={{ width }}
      className="relative flex h-screen shrink-0 flex-col border-l border-slate-200 bg-white dark:border-night-700 dark:bg-night-900"
    >
      {/* h-16 matches TopBar.tsx's own h-16 exactly, so this header's
       * border-b lands on the same Y as the top bar's border-b instead of
       * sitting a few px lower (py-4 here vs. a fixed height there) - the
       * two rules read as one continuous line across the top of the app. */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-night-700">
        <Image
          src="/web-app-manifest-512x512.png"
          alt="סטודיו דוב אברמסון"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">סטודיו דוב אברמסון</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">ניהול פרויקטים</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {workspaces.map((ws) => (
            <WorkspaceItem key={ws.id} workspace={ws} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-200 p-2 dark:border-night-700">
        <CreateWorkspaceButton nextPosition={workspaces.length} />
        <Link
          href="/archive"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-night-800"
          )}
        >
          <Archive size={16} />
          ארכיון לוחות
        </Link>
      </div>

      {/* -translate-x-1/2 straddles the handle over the border-l above, so
       * the hit area isn't confined to one pixel-wide line. */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setResizing(true);
        }}
        title="גרירה לשינוי רוחב הסיידבר"
        className={cn(
          "absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize transition-colors",
          resizing ? "bg-brand-400/60 dark:bg-brand-500/40" : "hover:bg-brand-300/50 dark:hover:bg-brand-500/30"
        )}
      />
    </aside>
  );
}

function WorkspaceItem({ workspace }: { workspace: WorkspaceWithBoards }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [boards, setBoards] = useState(workspace.boards);
  // Resync from the server-provided list whenever it changes (a board
  // created/renamed/archived elsewhere, a fresh router.refresh()) -
  // reference inequality is enough here since the parent always hands
  // down a freshly-fetched array. React's documented "adjusting state
  // when a prop changes" pattern (compared against state, not a ref -
  // refs can't be read/written during render).
  const [prevWorkspaceBoards, setPrevWorkspaceBoards] = useState(workspace.boards);
  if (prevWorkspaceBoards !== workspace.boards) {
    setPrevWorkspaceBoards(workspace.boards);
    setBoards(workspace.boards);
  }

  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"before" | "after">("before");

  function reorderBoards(draggedId: string, targetId: string, position: "before" | "after") {
    if (draggedId === targetId) return;
    setBoards((prev) => {
      const ordered = [...prev].sort((a, b) => a.position - b.position);
      const fromIndex = ordered.findIndex((b) => b.id === draggedId);
      if (fromIndex === -1) return prev;
      const [moved] = ordered.splice(fromIndex, 1);
      // Recompute the target's index after removing the dragged board -
      // if it moved from earlier in the list, everything after it shifted
      // back by one.
      const toIndex = ordered.findIndex((b) => b.id === targetId);
      if (toIndex === -1) return prev;
      const insertIndex = position === "after" ? toIndex + 1 : toIndex;
      ordered.splice(insertIndex, 0, moved);
      const supabase = createClient();
      ordered.forEach((b, i) => {
        if (b.position !== i) supabase.from("boards").update({ position: i }).eq("id", b.id).then();
      });
      return ordered.map((b, i) => ({ ...b, position: i }));
    });
  }

  const hasActiveBoard = boards.some((b) => pathname === `/board/${b.id}`);

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-night-800",
          hasActiveBoard && "text-brand-700 dark:text-brand-400"
        )}
      >
        {open ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
        <span className="flex-1 truncate">{workspace.name}</span>
      </button>

      {open && (
        <ul className="mr-4 mt-1 space-y-0.5 border-r border-slate-100 pr-2 dark:border-night-800">
          {boards.map((board) => (
            <BoardListItem
              key={board.id}
              board={board}
              active={pathname === `/board/${board.id}`}
              isDragging={draggingBoardId === board.id}
              isDropTarget={dragOverBoardId === board.id && draggingBoardId !== board.id}
              dropPosition={dragOverPosition}
              onDragStart={() => setDraggingBoardId(board.id)}
              onDragEnd={() => {
                setDraggingBoardId(null);
                setDragOverBoardId(null);
              }}
              onDragOverRow={(position) => {
                setDragOverBoardId(board.id);
                setDragOverPosition(position);
              }}
              onDropOnRow={(position) => {
                if (draggingBoardId) reorderBoards(draggingBoardId, board.id, position);
                setDraggingBoardId(null);
                setDragOverBoardId(null);
              }}
            />
          ))}
          <li>
            <CreateBoardButton workspaceId={workspace.id} />
          </li>
        </ul>
      )}
    </li>
  );
}

function BoardListItem({
  board,
  active,
  isDragging,
  isDropTarget,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropOnRow,
}: {
  board: Board;
  active: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  dropPosition: "before" | "after";
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverRow: (position: "before" | "after") => void;
  onDropOnRow: (position: "before" | "after") => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);

  function edgeFromCursor(clientY: number): "before" | "after" {
    const rect = rowRef.current?.getBoundingClientRect();
    return rect && clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  return (
    <li
      ref={rowRef}
      className={cn(
        "rounded-lg",
        isDragging && "opacity-40",
        isDropTarget &&
          dropPosition === "after" &&
          "shadow-[inset_0_-2px_0_0_#6366f1] dark:shadow-[inset_0_-2px_0_0_#818cf8]",
        isDropTarget &&
          dropPosition !== "after" &&
          "shadow-[inset_0_2px_0_0_#6366f1] dark:shadow-[inset_0_2px_0_0_#818cf8]"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverRow(edgeFromCursor(e.clientY));
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnRow(edgeFromCursor(e.clientY));
      }}
    >
      <Link
        href={`/board/${board.id}`}
        draggable
        onDragStart={(e) => {
          // Show the whole row as the drag preview, anchored to wherever
          // the cursor actually is on it (not its center) - see the
          // matching comment in ItemRow.tsx/GroupSection.tsx. Dragging
          // the row itself (no separate grip handle needed here, unlike
          // the board table) works fine alongside the plain click-to-
          // navigate: a native dragstart only fires once the pointer has
          // actually moved past a threshold, so a simple click is
          // unaffected.
          if (rowRef.current) {
            const rect = rowRef.current.getBoundingClientRect();
            e.dataTransfer.setDragImage(rowRef.current, e.clientX - rect.left, e.clientY - rect.top);
          }
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        className={cn(
          "flex cursor-grab items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 active:cursor-grabbing dark:text-slate-300 dark:hover:bg-night-800",
          active && "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
        )}
      >
        <LayoutGrid size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="truncate">{board.name}</span>
      </Link>
    </li>
  );
}
