"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, GripVertical, Plus } from "lucide-react";
import ItemRow from "./ItemRow";
import { formatDuration, formatHours, cn } from "@/lib/utils";
import { GROUP_COLORS } from "@/lib/constants";
import type { ActiveTimeLog, Item, Profile } from "@/lib/supabase/types";
import FloatingPanel from "@/components/ui/FloatingPanel";

// Stable reference so items with no active session don't hand TimeTracker
// a freshly-allocated empty array on every render.
const NO_ACTIVE_SESSIONS: ActiveTimeLog[] = [];

export interface DisplayGroup {
  id: string;
  name: string;
  color: string;
  collapsed: boolean;
  items: Item[];
  isRealGroup: boolean;
}

export default function GroupSection({
  group,
  profiles,
  selected,
  onToggleSelect,
  onToggleCollapse,
  onUpdateItem,
  onDeleteItem,
  onSerialBlur,
  onNameBlur,
  onAddItem,
  onRenameGroup,
  onDeleteGroup,
  onColorChange,
  canReorder,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOverGroup,
  onDropOnGroup,
  canReorderItems,
  onReorderItem,
  currentUserId,
  trackedSecondsByItem,
  activeSessionsByItem,
  onTimeLogChanged,
  readOnly,
}: {
  group: DisplayGroup;
  profiles: Profile[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleCollapse: () => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
  onSerialBlur: (id: string, serial: string) => void;
  onNameBlur: (id: string, name: string) => void;
  onAddItem: () => void;
  onTimeLogChanged: () => void;
  onRenameGroup?: (name: string) => void;
  onDeleteGroup?: () => void;
  onColorChange?: (color: string) => void;
  /** True only for a real, unarchived group while the board is grouped by
   * "group" - dragging a synthetic person/status bucket, or a row on a
   * read-only board, has nothing real to reorder. */
  canReorder?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverGroup?: (e: React.DragEvent) => void;
  onDropOnGroup?: () => void;
  /** Same gating as canReorder, plus: only meaningful while items are
   * actually displayed in position order (sortBy === "none") - dragging to
   * "reorder" while a different sort is active would just get overridden
   * the instant it re-renders. */
  canReorderItems?: boolean;
  onReorderItem: (draggedId: string, targetId: string) => void;
  currentUserId: string | null;
  trackedSecondsByItem: Record<string, number>;
  activeSessionsByItem: Record<string, ActiveTimeLog[]>;
  readOnly?: boolean;
}) {
  const totalHours = group.items.reduce((sum, i) => sum + Number(i.hours || 0), 0);
  const totalTracked = group.items.reduce(
    (sum, i) => sum + (trackedSecondsByItem[i.id] ?? 0),
    0
  );
  const headerRef = useRef<HTMLDivElement>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  return (
    <div
      className={cn("mb-4", isDragging && "opacity-40")}
      onDragOver={onDragOverGroup}
      onDrop={(e) => {
        if (onDropOnGroup) {
          e.preventDefault();
          onDropOnGroup();
        }
      }}
    >
      {/* A plain div, not a <button>, wrapping the row: the name field below
       * is a real <input> when the group is renameable, and interactive
       * content (an input, another button) can't legally nest inside a
       * <button> - the browser's HTML parser silently un-nests it, which
       * differs from React's DOM and trips a hydration mismatch on first
       * load. Each control here is its own sibling button instead. */}
      <div
        ref={headerRef}
        className={cn(
          "flex w-full items-center gap-2 rounded-t-lg px-3 py-2 transition",
          isDropTarget && "ring-2 ring-inset ring-brand-400"
        )}
        style={{ backgroundColor: `${group.color}1a` }}
      >
        {canReorder && (
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              // Without this, the browser's default drag preview is just
              // the tiny grip icon itself (the only element marked
              // draggable) - dragging the whole visible header instead
              // makes it obvious what's actually being moved.
              if (headerRef.current) {
                const rect = headerRef.current.getBoundingClientRect();
                e.dataTransfer.setDragImage(headerRef.current, rect.width / 2, rect.height / 2);
              }
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            title="גרירה לשינוי סדר הקבוצות"
            className="shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 text-slate-400 hover:text-slate-600"
          title={group.collapsed ? "הרחבת קבוצה" : "כיווץ קבוצה"}
        >
          {group.collapsed ? (
            <ChevronLeft size={16} style={{ color: group.color }} />
          ) : (
            <ChevronDown size={16} style={{ color: group.color }} />
          )}
        </button>

        {onRenameGroup ? (
          <input
            defaultValue={group.name}
            onBlur={(e) => e.target.value.trim() && onRenameGroup(e.target.value.trim())}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
            style={{ color: group.color }}
          />
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="min-w-0 flex-1 truncate text-right text-sm font-bold"
            style={{ color: group.color }}
          >
            {group.name}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 text-xs font-medium text-slate-400"
        >
          {group.items.length} משימות
        </button>

        {onColorChange && <GroupColorPicker color={group.color} onChange={onColorChange} />}

        {onDeleteGroup && group.items.length === 0 && (
          <button
            onClick={onDeleteGroup}
            className="shrink-0 text-xs text-slate-400 hover:text-red-500"
          >
            מחיקת קבוצה
          </button>
        )}
      </div>

      {!group.collapsed && (
        <div className="overflow-x-auto rounded-b-lg border border-t-0 border-slate-200">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-400">
                {canReorderItems && <th className="w-6 px-1 py-2"></th>}
                <th className="w-10 px-3 py-2"></th>
                <th className="min-w-[220px] px-2 py-2 text-right">פריט</th>
                <th className="w-16 px-1 py-2">איש צוות</th>
                <th className="w-40 px-2 py-2 text-right">תוצר עיצובי</th>
                <th className="w-32 px-1 py-2">סטטוס</th>
                <th className="w-28 px-2 py-2">מס&quot;ד</th>
                <th className="w-32 px-2 py-2">תאריך התחלה</th>
                <th className="w-32 px-2 py-2">תאריך יעד</th>
                <th className="w-20 px-2 py-2">שעות</th>
                <th className="w-32 px-2 py-2">מעקב זמן</th>
                <th className="w-9 px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  profiles={profiles}
                  selected={selected.has(item.id)}
                  onToggleSelect={() => onToggleSelect(item.id)}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                  onDelete={() => onDeleteItem(item.id)}
                  onSerialBlur={(serial) => onSerialBlur(item.id, serial)}
                  onNameBlur={(name) => onNameBlur(item.id, name)}
                  currentUserId={currentUserId}
                  trackedSeconds={trackedSecondsByItem[item.id] ?? 0}
                  activeSessions={activeSessionsByItem[item.id] ?? NO_ACTIVE_SESSIONS}
                  onTimeLogChanged={onTimeLogChanged}
                  readOnly={readOnly}
                  canReorder={canReorderItems}
                  isDragging={draggingItemId === item.id}
                  isDropTarget={dragOverItemId === item.id && draggingItemId !== item.id}
                  onDragStart={() => setDraggingItemId(item.id)}
                  onDragEnd={() => {
                    setDraggingItemId(null);
                    setDragOverItemId(null);
                  }}
                  onDragOverRow={
                    draggingItemId
                      ? (e) => {
                          e.preventDefault();
                          setDragOverItemId(item.id);
                        }
                      : undefined
                  }
                  onDropOnRow={
                    draggingItemId
                      ? () => {
                          onReorderItem(draggingItemId, item.id);
                          setDraggingItemId(null);
                          setDragOverItemId(null);
                        }
                      : undefined
                  }
                />
              ))}

              {!readOnly && group.isRealGroup && (
                <tr>
                  <td colSpan={canReorderItems ? 12 : 11} className="px-3 py-1.5">
                    <button
                      onClick={onAddItem}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-brand-600"
                    >
                      <Plus size={14} />
                      הוספת פריט
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                <td colSpan={canReorderItems ? 9 : 8} className="px-3 py-2 text-left">
                  סה&quot;כ
                </td>
                <td className="px-2 py-2 text-center">{formatHours(totalHours)}</td>
                <td className="px-2 py-2 text-center font-mono">{formatDuration(totalTracked)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="צבע הקבוצה"
        className="flex h-5 w-5 items-center justify-center rounded ring-1 ring-inset ring-black/10 hover:ring-black/20"
        style={{ backgroundColor: color }}
      />

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <FloatingPanel
            anchorRef={buttonRef}
            align="end"
            className="z-50 grid grid-cols-4 gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          >
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                title={c}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded ring-1 ring-inset ring-black/10 transition hover:scale-110",
                  c === color && "ring-2 ring-offset-1 ring-slate-500"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </FloatingPanel>
        </>
      )}
    </div>
  );
}
