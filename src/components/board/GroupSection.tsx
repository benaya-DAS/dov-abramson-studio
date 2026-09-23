"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronLeft, GripVertical, Plus } from "lucide-react";
import ItemRow from "./ItemRow";
import { blurActiveElement, formatDuration, formatHours, cn } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
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
  onSerialBlur,
  onNameBlur,
  onAddItem,
  newItemId,
  onRenameGroup,
  onDeleteGroup,
  onColorChange,
  canReorder,
  isDragging,
  isDropTarget,
  dragOverGroupPosition,
  onDragStart,
  onDragEnd,
  onDragOverGroup,
  onDropOnGroup,
  canReorderItems,
  draggingItemId,
  dragOverItemKey,
  dragOverItemPosition,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOver,
  onMoveItemHere,
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
  onSerialBlur: (id: string, serial: string) => void;
  onNameBlur: (id: string, name: string) => void;
  onAddItem: () => void;
  /** The item addItem() most recently created - see BoardWorkspace. */
  newItemId: string | null;
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
  /** Which edge of this group's header the dragged group would land on,
   * when isDropTarget is true - drives the top/bottom insertion line. */
  dragOverGroupPosition?: "before" | "after";
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverGroup?: (position: "before" | "after") => void;
  onDropOnGroup?: (position: "before" | "after") => void;
  /** Same gating as canReorder, plus: only meaningful while items are
   * actually displayed in position order (sortBy === "none") - dragging to
   * "reorder" while a different sort is active would just get overridden
   * the instant it re-renders. */
  canReorderItems?: boolean;
  /** Lifted to BoardTable (not local state) so a row in THIS group can
   * recognize an item drag that started in a different group's table -
   * that's what makes cross-group moves possible. */
  draggingItemId: string | null;
  /** Either an item id (hovering a row) or `group:<id>` (hovering this
   * group's header/empty body, meaning "append at the end here"). */
  dragOverItemKey: string | null;
  /** Which edge of the hovered row the dragged item would land on - only
   * meaningful when dragOverItemKey is an item id, not a `group:<id>`
   * header key (appending always lands at the very end). */
  dragOverItemPosition?: "before" | "after";
  onItemDragStart: (itemId: string) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (key: string, position: "before" | "after") => void;
  onMoveItemHere: (draggedId: string, targetItemId: string | null, position: "before" | "after") => void;
  currentUserId: string | null;
  trackedSecondsByItem: Record<string, number>;
  activeSessionsByItem: Record<string, ActiveTimeLog[]>;
  readOnly?: boolean;
}) {
  // Both footer cells (decimal hours, HH:MM:SS) derive from the same
  // tracked-seconds sum, now that the Hours column itself is tracked time
  // rather than a separately typed estimate.
  const totalTracked = group.items.reduce(
    (sum, i) => sum + (trackedSecondsByItem[i.id] ?? 0),
    0
  );
  const headerRef = useRef<HTMLDivElement>(null);
  const headerDropKey = `group:${group.id}`;
  const isHeaderItemDropTarget = canReorderItems && dragOverItemKey === headerDropKey;
  const allDone = group.items.length > 0 && group.items.every((i) => i.status === "done");
  const doneRatio =
    group.items.length > 0
      ? group.items.filter((i) => i.status === "done").length / group.items.length
      : 0;
  // Reused below in two mutually-exclusive spots (collapsed vs. expanded),
  // never both at once, so a single element is safe to place either way.
  // No self-start here: "self-start" means something different in each of
  // those two spots' flex context (horizontal containment in the collapsed
  // column vs. vertical alignment in the expanded row), so it's applied by
  // each placement individually below instead of baked into the shared
  // element itself.
  const itemCountLabel = (
    <button
      type="button"
      onClick={onToggleCollapse}
      className={cn(
        "shrink-0 text-xs",
        allDone
          ? "font-bold text-emerald-600 dark:text-emerald-400"
          : "font-medium text-slate-400 dark:text-slate-500"
      )}
    >
      {group.items.length} משימות
    </button>
  );

  function groupEdgeFromCursor(clientY: number): "before" | "after" {
    const rect = headerRef.current?.getBoundingClientRect();
    return rect && clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  // The group header doubles as a drop target for two different drags -
  // reordering the group itself, and appending a dragged item to this
  // group (its header is the only drop target an empty group has). Only
  // one kind of drag is ever active at a time, so dispatch on which.
  // Appending an item always lands at the end of the group regardless of
  // where on the header it's dropped, so that case has no "position" to
  // compute - "after" is passed purely to satisfy the callback signature.
  function handleHeaderDragOver(e: React.DragEvent) {
    if (draggingItemId && canReorderItems) {
      e.preventDefault();
      onItemDragOver(headerDropKey, "after");
    } else if (onDragOverGroup) {
      e.preventDefault();
      onDragOverGroup(groupEdgeFromCursor(e.clientY));
    }
  }

  function handleHeaderDrop(e: React.DragEvent) {
    if (draggingItemId && canReorderItems) {
      e.preventDefault();
      onMoveItemHere(draggingItemId, null, "after");
      onItemDragEnd();
    } else if (onDropOnGroup) {
      e.preventDefault();
      onDropOnGroup(groupEdgeFromCursor(e.clientY));
    }
  }

  return (
    <div
      className={cn("relative mb-4", isDragging && "opacity-40")}
      onDragOver={handleHeaderDragOver}
      onDrop={handleHeaderDrop}
    >
      {/* Reordering groups shows its insertion line in the gap above/below
       * this whole block (i.e. between groups), not on the header itself -
       * appending an item INTO this group (isHeaderItemDropTarget below)
       * is a different kind of target and stays a highlight on the header,
       * since that one really does mean "goes inside this group". */}
      {isDropTarget && (
        <div
          className={cn(
            "absolute inset-x-1 z-10 h-0.5 rounded-full bg-brand-500 dark:bg-brand-400",
            dragOverGroupPosition === "after" ? "-bottom-2.5" : "-top-2.5"
          )}
        />
      )}
      {/* A plain div, not a <button>, wrapping the row: the name field below
       * is a real <input> when the group is renameable, and interactive
       * content (an input, another button) can't legally nest inside a
       * <button> - the browser's HTML parser silently un-nests it, which
       * differs from React's DOM and trips a hydration mismatch on first
       * load. Each control here is its own sibling button instead. */}
      <div
        ref={headerRef}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-t-lg px-3 py-2 transition",
          // A bottom line while an item is about to be appended into this
          // group, rather than a box/ring overlay around the header.
          isHeaderItemDropTarget &&
            "shadow-[inset_0_-2px_0_0_#6366f1] dark:shadow-[inset_0_-2px_0_0_#818cf8]"
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
              // makes it obvious what's actually being moved. The offset
              // is the cursor's own position within the header (not its
              // center), so the preview stays "held" from the grip's side
              // under the cursor instead of visually snapping to be
              // grabbed from the middle of the header.
              if (headerRef.current) {
                const rect = headerRef.current.getBoundingClientRect();
                e.dataTransfer.setDragImage(headerRef.current, e.clientX - rect.left, e.clientY - rect.top);
              }
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            title="גרירה לשינוי סדר הקבוצות"
            className={cn(
              "shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400",
              // Only overriding the row's default items-center while
              // collapsed - a collapsed group's name+count column is two
              // lines tall, and centering against it would leave the grip
              // floating in the gap between them instead of level with the
              // group name. Expanded, the row is single-line and centering
              // is already correct, so this stays unset there.
              group.collapsed && "self-start"
            )}
          >
            <GripVertical size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
            group.collapsed && "self-start"
          )}
          title={group.collapsed ? "הרחבת קבוצה" : "כיווץ קבוצה"}
        >
          {group.collapsed ? (
            <ChevronLeft size={16} style={{ color: group.color }} />
          ) : (
            <ChevronDown size={16} style={{ color: group.color }} />
          )}
        </button>

        {/* Text stays a fixed neutral rather than group.color: some palette
         * entries (e.g. #333333, #808080) would read fine on light-mode
         * white but go nearly illegible on a dark background - the swatch
         * and chevron already carry the color accent, so the name text
         * doesn't need to gamble on every custom color being legible in
         * both themes. */}
        {/* Collapsed groups show the item count as a second line under the
         * name instead of inline next to it - the column wrapper only
         * matters while collapsed, so it's the same min-w-0 flex-1 the name
         * itself used to carry directly. */}
        <div className="flex min-w-0 flex-1 flex-col">
          {onRenameGroup ? (
            <input
              defaultValue={group.name}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed && trimmed !== group.name) onRenameGroup(trimmed);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  // Reset the DOM value directly (this input is uncontrolled)
                  // before blurring, so the onBlur above sees it unchanged
                  // and no-ops instead of committing the in-progress edit.
                  e.currentTarget.value = group.name;
                  e.currentTarget.blur();
                }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none dark:text-slate-100"
            />
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="min-w-0 flex-1 truncate text-right text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              {group.name}
            </button>
          )}
          {group.collapsed && <div className="mt-0.5 self-start">{itemCountLabel}</div>}
        </div>

        {!group.collapsed && itemCountLabel}

        {onColorChange && (
          <GroupColorPicker
            color={group.color}
            onChange={onColorChange}
            // Same reasoning as the chevron/grip above - only need to
            // override the row's items-center while collapsed, when the
            // name+count column next to it is two lines tall.
            className={group.collapsed ? "self-start" : undefined}
          />
        )}

        {onDeleteGroup && group.items.length === 0 && (
          <button
            onClick={onDeleteGroup}
            className={cn(
              "shrink-0 text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400",
              group.collapsed && "self-start"
            )}
          >
            מחיקת קבוצה
          </button>
        )}

        {/* Just a line, no numbers - the done/total count is already spelled
         * out in itemCountLabel above; this is a quick at-a-glance read on
         * completion, not a duplicate of that text. */}
        {group.items.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-slate-900/10 dark:bg-white/10">
            <div
              className="h-full bg-emerald-500 transition-[width] dark:bg-emerald-400"
              style={{ width: `${doneRatio * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Animating this open/closed needs the table to stay mounted while
       * collapsed (a plain {!group.collapsed && ...} unmounts it, leaving
       * nothing to transition from/to) - grid-template-rows 0fr<->1fr on an
       * always-rendered grid row is what lets the height animate smoothly
       * without ever measuring or hardcoding a pixel height (which "auto"
       * can't be transitioned to directly in CSS). The row's own child adds
       * overflow-y-hidden (alongside its existing overflow-x-auto) so its
       * content actually gets clipped as the row shrinks toward 0, instead
       * of just poking out past it. inert while collapsed keeps its rows
       * out of the tab order and hit-testing (and off the accessibility
       * tree) even though they're still technically in the DOM. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          group.collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
        inert={group.collapsed}
      >
        <div className="overflow-x-auto overflow-y-hidden rounded-b-lg border border-t-0 border-slate-300 dark:border-night-700">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-400 dark:border-night-700 dark:bg-night-800/60 dark:text-slate-500">
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
                  onSerialBlur={(serial) => onSerialBlur(item.id, serial)}
                  onNameBlur={(name) => onNameBlur(item.id, name)}
                  isNewlyAdded={item.id === newItemId}
                  currentUserId={currentUserId}
                  trackedSeconds={trackedSecondsByItem[item.id] ?? 0}
                  activeSessions={activeSessionsByItem[item.id] ?? NO_ACTIVE_SESSIONS}
                  onTimeLogChanged={onTimeLogChanged}
                  readOnly={readOnly}
                  canReorder={canReorderItems}
                  isDragging={draggingItemId === item.id}
                  isDropTarget={canReorderItems && dragOverItemKey === item.id && draggingItemId !== item.id}
                  dropPosition={dragOverItemPosition}
                  onDragStart={() => onItemDragStart(item.id)}
                  onDragEnd={onItemDragEnd}
                  onDragOverRow={
                    draggingItemId && canReorderItems
                      ? (position) => onItemDragOver(item.id, position)
                      : undefined
                  }
                  onDropOnRow={
                    draggingItemId && canReorderItems
                      ? (position) => {
                          onMoveItemHere(draggingItemId, item.id, position);
                          onItemDragEnd();
                        }
                      : undefined
                  }
                />
              ))}

              {!readOnly && group.isRealGroup && (
                <tr>
                  <td colSpan={canReorderItems ? 11 : 10} className="px-3 py-1.5">
                    <button
                      onClick={onAddItem}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-night-800 dark:hover:text-brand-400"
                    >
                      <Plus size={14} />
                      הוספת פריט
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-300 bg-slate-50 text-xs font-bold text-slate-600 dark:border-night-700 dark:bg-night-800/60 dark:text-slate-300">
                <td colSpan={canReorderItems ? 9 : 8} className="px-3 py-2 text-left">
                  סה&quot;כ
                </td>
                <td className="px-2 py-2 text-center">{formatHours(totalTracked / 3600)}</td>
                <td className="px-2 py-2 text-center font-mono">{formatDuration(totalTracked)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupColorPicker({
  color,
  onChange,
  className,
}: {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    blurActiveElement();
    setOpen(false);
  }

  useEscapeKey(close, open);

  return (
    <div className={cn("shrink-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="צבע הקבוצה"
        className="flex h-5 w-5 items-center justify-center rounded ring-1 ring-inset ring-black/10 hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/20"
        style={{ backgroundColor: color }}
      />

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <FloatingPanel
            anchorRef={buttonRef}
            align="end"
            className="z-50 grid grid-cols-4 gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-night-700 dark:bg-night-800"
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
                  "flex h-6 w-6 items-center justify-center rounded ring-1 ring-inset ring-black/10 transition hover:scale-110 dark:ring-white/10",
                  c === color && "ring-2 ring-offset-1 ring-slate-500 dark:ring-offset-night-800"
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
