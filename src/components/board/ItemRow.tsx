"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import StatusBadge from "./StatusBadge";
import PersonPicker from "./PersonPicker";
import TimeTracker from "./TimeTracker";
import type { ActiveTimeLog, Item, ItemStatus, Profile } from "@/lib/supabase/types";
import { cn, formatHours } from "@/lib/utils";

export default function ItemRow({
  item,
  profiles,
  selected,
  onToggleSelect,
  onUpdate,
  onSerialBlur,
  onNameBlur,
  isNewlyAdded,
  currentUserId,
  trackedSeconds,
  activeSessions,
  onTimeLogChanged,
  readOnly,
  canReorder,
  isDragging,
  isDropTarget,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onDropOnRow,
}: {
  item: Item;
  profiles: Profile[];
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (patch: Partial<Item>) => void;
  onSerialBlur: (serial: string) => void;
  onNameBlur: (name: string) => void;
  /** True only for the row addItem() most recently created - focuses its
   * name field on mount, ready for typing. */
  isNewlyAdded?: boolean;
  currentUserId: string | null;
  trackedSeconds: number;
  activeSessions: ActiveTimeLog[];
  onTimeLogChanged: () => void;
  readOnly?: boolean;
  /** True only when this board is grouped by "group" (real, position-backed
   * groups) with no sort active - dragging to reorder while a different
   * sort or grouping is driving the display order has nothing stable to
   * write a position against. */
  canReorder?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  /** Which edge of this row the dragged item would land on, when
   * isDropTarget is true - drives the top/bottom insertion-line indicator. */
  dropPosition?: "before" | "after";
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverRow?: (position: "before" | "after") => void;
  onDropOnRow?: (position: "before" | "after") => void;
}) {
  const [name, setName] = useState(item.name);
  const [serial, setSerial] = useState(item.serial_id ?? "");
  const [deliverable, setDeliverable] = useState(item.deliverable ?? "");
  const rowRef = useRef<HTMLTableRowElement>(null);
  // Escape reverts a field's draft state and blurs it, but blurring
  // synchronously fires onBlur before React has processed the revert (state
  // updates from the same event are batched) - so the commit-on-blur
  // handler below would otherwise read the OLD, not-yet-reverted draft and
  // save it anyway. This ref (checked and cleared by each field's onBlur)
  // is what lets Escape actually cancel instead of accidentally committing.
  const cancelingFieldRef = useRef(false);

  function handleEditableKeyDown(e: React.KeyboardEvent<HTMLInputElement>, revert: () => void) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      cancelingFieldRef.current = true;
      revert();
      e.currentTarget.blur();
    }
  }

  // Keep local editable state in sync when the item changes from outside
  // this row (catalog auto-fill, realtime updates from other users, etc).
  // Each field re-syncs independently so an in-progress edit in one field
  // survives an external update landing on a different field.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setSerial(item.serial_id ?? ""), [item.serial_id]);
  useEffect(() => setDeliverable(item.deliverable ?? ""), [item.deliverable]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function edgeFromCursor(clientY: number): "before" | "after" {
    const rect = rowRef.current?.getBoundingClientRect();
    return rect && clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  return (
    <tr
      ref={rowRef}
      className={cn(
        "group border-b border-slate-200 hover:bg-slate-100 dark:border-night-800 dark:hover:bg-night-800/60",
        selected && "bg-brand-50/60 dark:bg-brand-900/20",
        isDragging && "opacity-40",
        // A thin inset line on the edge the row would land on, rather than
        // a box outline/highlight around the whole row - box-shadow (not
        // border) so it doesn't fight the row's own border-b or shift
        // layout by changing border-width.
        isDropTarget &&
          dropPosition === "after" &&
          "shadow-[inset_0_-2px_0_0_#6366f1] dark:shadow-[inset_0_-2px_0_0_#818cf8]",
        isDropTarget &&
          dropPosition !== "after" &&
          "shadow-[inset_0_2px_0_0_#6366f1] dark:shadow-[inset_0_2px_0_0_#818cf8]"
      )}
      onDragOver={
        onDragOverRow
          ? (e) => {
              e.preventDefault();
              // Without this, the event bubbles up to the group wrapper's
              // own onDragOver (GroupSection's handleHeaderDragOver), which
              // would immediately overwrite this row's precise
              // above/below position with "append at the end of the
              // group" on every single row hover - the row itself is
              // always the more specific target once it's the one
              // handling the event.
              e.stopPropagation();
              onDragOverRow(edgeFromCursor(e.clientY));
            }
          : undefined
      }
      onDrop={(e) => {
        if (onDropOnRow) {
          e.preventDefault();
          e.stopPropagation();
          onDropOnRow(edgeFromCursor(e.clientY));
        }
      }}
    >
      {canReorder && (
        <td className="w-6 px-1 py-2 text-center">
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              // Show the whole row as the drag preview, not just this tiny
              // handle - see the matching comment in GroupSection.tsx. The
              // offset is the cursor's own position within the row (not
              // the row's center), so the preview stays "held" from the
              // grip's side under the cursor instead of visually snapping
              // to be grabbed from the middle of the row.
              if (rowRef.current) {
                const rect = rowRef.current.getBoundingClientRect();
                e.dataTransfer.setDragImage(rowRef.current, e.clientX - rect.left, e.clientY - rect.top);
              }
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            title="גרירה לשינוי סדר המשימות"
            className="cursor-grab text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400"
          >
            <GripVertical size={13} />
          </button>
        </td>
      )}
      <td className="w-10 px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 dark:border-night-600 dark:bg-night-800"
        />
      </td>

      <td className="min-w-[220px] px-2 py-1.5">
        <input
          autoFocus={isNewlyAdded}
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (cancelingFieldRef.current) {
              cancelingFieldRef.current = false;
              return;
            }
            if (name !== item.name) {
              onUpdate({ name });
              onNameBlur(name);
            }
          }}
          onKeyDown={(e) => handleEditableKeyDown(e, () => setName(item.name))}
          placeholder="שם המשימה..."
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white disabled:hover:border-transparent dark:text-slate-100 dark:hover:border-night-700 dark:focus:bg-night-800"
        />
      </td>

      <td className="w-16 px-1 py-1.5">
        <PersonPicker
          profiles={profiles}
          personIds={item.person_ids}
          onChange={readOnly ? undefined : (personIds) => onUpdate({ person_ids: personIds })}
          readOnly={readOnly}
        />
      </td>

      <td className="w-52 px-2 py-1.5">
        <input
          list="deliverable-options"
          value={deliverable}
          disabled={readOnly}
          onChange={(e) => setDeliverable(e.target.value)}
          onBlur={() => {
            if (cancelingFieldRef.current) {
              cancelingFieldRef.current = false;
              return;
            }
            if (deliverable !== (item.deliverable ?? "")) onUpdate({ deliverable: deliverable || null });
          }}
          onKeyDown={(e) => handleEditableKeyDown(e, () => setDeliverable(item.deliverable ?? ""))}
          placeholder="תוצר עיצובי"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-300 dark:hover:border-night-700 dark:focus:bg-night-800"
        />
      </td>

      <td className="w-32 px-1 py-1.5">
        <StatusBadge
          status={item.status}
          customLabel={item.status_label}
          readOnly={readOnly}
          onChange={(status: ItemStatus) => onUpdate({ status })}
          onCustomLabelChange={(status_label) => onUpdate({ status_label })}
        />
      </td>

      <td className="w-28 px-2 py-1.5">
        <input
          value={serial}
          disabled={readOnly}
          onChange={(e) => setSerial(e.target.value)}
          onBlur={() => {
            if (cancelingFieldRef.current) {
              cancelingFieldRef.current = false;
              return;
            }
            if (serial !== (item.serial_id ?? "")) {
              onUpdate({ serial_id: serial || null });
              onSerialBlur(serial);
            }
          }}
          onKeyDown={(e) => handleEditableKeyDown(e, () => setSerial(item.serial_id ?? ""))}
          placeholder='מס"ד'
          dir="ltr"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-center text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-300 dark:hover:border-night-700 dark:focus:bg-night-800"
        />
      </td>

      <td className="w-32 px-2 py-1.5">
        <input
          type="date"
          value={item.start_date ?? ""}
          disabled={readOnly}
          onChange={(e) => onUpdate({ start_date: e.target.value || null })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-300 dark:hover:border-night-700 dark:focus:bg-night-800 dark:[color-scheme:dark]"
        />
      </td>

      <td className="w-32 px-2 py-1.5">
        <input
          type="date"
          value={item.due_date ?? ""}
          disabled={readOnly}
          onChange={(e) => onUpdate({ due_date: e.target.value || null })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-300 dark:hover:border-night-700 dark:focus:bg-night-800 dark:[color-scheme:dark]"
        />
      </td>

      <td className="w-20 px-2 py-1.5 text-center">
        {/* Read-only: this is the tracked time (time_logs), not a manual
         * estimate - decimal hours (1h30m -> "1.5"), derived the same way
         * as the time-tracking button's total, just formatted differently. */}
        <span
          className="font-mono text-xs text-slate-600 dark:text-slate-300"
          title="שעות בפועל (ממעקב זמן)"
        >
          {formatHours(trackedSeconds / 3600)}
        </span>
      </td>

      <td className="w-32 px-2 py-1.5">
        <TimeTracker
          itemId={item.id}
          userId={currentUserId}
          profiles={profiles}
          baseSeconds={trackedSeconds}
          activeSessions={activeSessions}
          onTimeLogChanged={onTimeLogChanged}
          readOnly={readOnly}
        />
      </td>
    </tr>
  );
}
