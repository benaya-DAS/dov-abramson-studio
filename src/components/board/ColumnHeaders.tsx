"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  COLUMNS,
  columnWidth,
  type ColumnKey,
  type MovableColumnKey,
  type TableLayout,
} from "@/lib/tableColumns";

// The column being dragged, shared across every group's header row so a
// column can be picked up in one group's table and dropped on another's.
// dataTransfer can't serve here: its data isn't readable during dragover,
// which is where the drop indicator is decided.
let draggingColumn: MovableColumnKey | null = null;

type DropSide = "before" | "after";

/**
 * The header cells for the name column and every movable column, in the
 * user's order. Desktop only: drag a header to move its column, drag its
 * edge to resize it, double-click the edge to reset its width. Every
 * change goes through onChange - persist=false while a resize is still in
 * progress (live preview), true once it's final.
 */
export default function ColumnHeaders({
  layout,
  onChange,
}: {
  layout: TableLayout;
  onChange: (layout: TableLayout, persist: boolean) => void;
}) {
  const [dropTarget, setDropTarget] = useState<{ key: MovableColumnKey; side: DropSide } | null>(null);
  // Set while a resize handle is pressed, so the header's own drag-to-move
  // doesn't also start from the same press.
  const resizingRef = useRef(false);

  function setWidth(key: ColumnKey, width: number | undefined, persist: boolean) {
    const widths = { ...layout.widths };
    if (width === undefined) delete widths[key];
    else widths[key] = width;
    onChange({ ...layout, widths }, persist);
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>, key: ColumnKey) {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = true;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = columnWidth(layout, key);
    let width = startWidth;

    function onMove(ev: PointerEvent) {
      // RTL: the handle sits on the column's left (end) edge, so dragging
      // it further left makes the column wider.
      width = Math.max(COLUMNS[key].minWidth, Math.round(startWidth + startX - ev.clientX));
      setWidth(key, width, false);
    }
    function onUp() {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      resizingRef.current = false;
      if (width !== startWidth) setWidth(key, width, true);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  function resizeHandle(key: ColumnKey) {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        title="גרירה לשינוי רוחב · לחיצה כפולה לרוחב המקורי"
        onPointerDown={(e) => startResize(e, key)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (layout.widths[key] !== undefined) setWidth(key, undefined, true);
        }}
        className="absolute inset-y-0 left-0 z-20 hidden w-2 -translate-x-1/2 cursor-col-resize touch-none after:absolute after:inset-y-1.5 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent hover:after:bg-brand-400 md:block"
      />
    );
  }

  function sideFromCursor(e: React.DragEvent<HTMLElement>): DropSide {
    // RTL: the right half of a header is its "before" (start) side.
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX > rect.left + rect.width / 2 ? "before" : "after";
  }

  function moveColumn(dragged: MovableColumnKey, target: MovableColumnKey, side: DropSide) {
    if (dragged === target) return;
    const order = layout.order.filter((k) => k !== dragged);
    const index = order.indexOf(target) + (side === "after" ? 1 : 0);
    order.splice(index, 0, dragged);
    if (order.join() !== layout.order.join()) onChange({ ...layout, order }, true);
  }

  return (
    <>
      {/* Frozen column - see ItemRow.tsx. Resizable, but always first. */}
      <th className="sticky right-0 z-10 bg-slate-50 px-2 py-2 text-right dark:bg-night-800/60">
        {COLUMNS.name.label}
        {resizeHandle("name")}
      </th>

      {layout.order.map((key) => {
        const isTarget = dropTarget?.key === key && draggingColumn !== key;
        return (
          <th
            key={key}
            draggable
            title="גרירה להזזת העמודה"
            onDragStart={(e) => {
              if (resizingRef.current) {
                e.preventDefault();
                return;
              }
              draggingColumn = key;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              draggingColumn = null;
              setDropTarget(null);
            }}
            onDragOver={(e) => {
              if (!draggingColumn) return;
              e.preventDefault();
              e.stopPropagation();
              const side = sideFromCursor(e);
              if (dropTarget?.key !== key || dropTarget.side !== side) setDropTarget({ key, side });
            }}
            onDragLeave={() => setDropTarget((t) => (t?.key === key ? null : t))}
            onDrop={(e) => {
              if (!draggingColumn) return;
              e.preventDefault();
              e.stopPropagation();
              moveColumn(draggingColumn, key, sideFromCursor(e));
              draggingColumn = null;
              setDropTarget(null);
            }}
            className={cn(
              "relative py-2 md:cursor-grab md:active:cursor-grabbing",
              COLUMNS[key].mobileClass,
              COLUMNS[key].cellClass,
              isTarget &&
                dropTarget?.side === "before" &&
                "shadow-[inset_-2px_0_0_0_#6366f1] dark:shadow-[inset_-2px_0_0_0_#818cf8]",
              isTarget &&
                dropTarget?.side === "after" &&
                "shadow-[inset_2px_0_0_0_#6366f1] dark:shadow-[inset_2px_0_0_0_#818cf8]"
            )}
          >
            <span className="block truncate">{COLUMNS[key].label}</span>
            {resizeHandle(key)}
          </th>
        );
      })}

      {/* Desktop filler column - see GroupSection's colgroup. */}
      <th className="hidden md:table-cell" />
    </>
  );
}
