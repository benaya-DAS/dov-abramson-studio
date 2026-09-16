"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import StatusBadge from "./StatusBadge";
import PersonPicker from "./PersonPicker";
import TimeTracker from "./TimeTracker";
import type { ActiveTimeLog, Item, ItemStatus, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export default function ItemRow({
  item,
  profiles,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
  onSerialBlur,
  onNameBlur,
  currentUserId,
  trackedSeconds,
  activeSessions,
  onTimeLogChanged,
  readOnly,
  canReorder,
  isDragging,
  isDropTarget,
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
  onDelete: () => void;
  onSerialBlur: (serial: string) => void;
  onNameBlur: (name: string) => void;
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
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverRow?: (e: React.DragEvent) => void;
  onDropOnRow?: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [serial, setSerial] = useState(item.serial_id ?? "");
  const [deliverable, setDeliverable] = useState(item.deliverable ?? "");
  const [hours, setHours] = useState(String(item.hours ?? 0));
  const rowRef = useRef<HTMLTableRowElement>(null);

  // Keep local editable state in sync when the item changes from outside
  // this row (catalog auto-fill, realtime updates from other users, etc).
  // Each field re-syncs independently so an in-progress edit in one field
  // survives an external update landing on a different field.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setSerial(item.serial_id ?? ""), [item.serial_id]);
  useEffect(() => setDeliverable(item.deliverable ?? ""), [item.deliverable]);
  useEffect(() => setHours(String(item.hours ?? 0)), [item.hours]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <tr
      ref={rowRef}
      className={cn(
        "group border-b border-slate-100 hover:bg-slate-50",
        selected && "bg-brand-50/60",
        isDragging && "opacity-40",
        isDropTarget && "bg-brand-50 outline outline-2 -outline-offset-2 outline-brand-400"
      )}
      onDragOver={onDragOverRow}
      onDrop={(e) => {
        if (onDropOnRow) {
          e.preventDefault();
          onDropOnRow();
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
              // handle - see the matching comment in GroupSection.tsx.
              if (rowRef.current) {
                const rect = rowRef.current.getBoundingClientRect();
                e.dataTransfer.setDragImage(rowRef.current, rect.width / 2, rect.height / 2);
              }
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            title="גרירה לשינוי סדר המשימות"
            className="cursor-grab text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
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
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
      </td>

      <td className="min-w-[220px] px-2 py-1.5">
        <input
          value={name}
          disabled={readOnly}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== item.name) {
              onUpdate({ name });
              onNameBlur(name);
            }
          }}
          placeholder="שם המשימה..."
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white disabled:hover:border-transparent"
        />
      </td>

      <td className="w-16 px-1 py-1.5">
        <PersonPicker
          profiles={profiles}
          personId={item.person_id}
          onChange={readOnly ? undefined : (personId) => onUpdate({ person_id: personId })}
          readOnly={readOnly}
        />
      </td>

      <td className="w-40 px-2 py-1.5">
        <input
          list="deliverable-options"
          value={deliverable}
          disabled={readOnly}
          onChange={(e) => setDeliverable(e.target.value)}
          onBlur={() => deliverable !== (item.deliverable ?? "") && onUpdate({ deliverable: deliverable || null })}
          placeholder="תוצר עיצובי"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white"
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
            if (serial !== (item.serial_id ?? "")) {
              onUpdate({ serial_id: serial || null });
              onSerialBlur(serial);
            }
          }}
          placeholder='מס"ד'
          dir="ltr"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-center text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
      </td>

      <td className="w-32 px-2 py-1.5">
        <input
          type="date"
          value={item.start_date ?? ""}
          disabled={readOnly}
          onChange={(e) => onUpdate({ start_date: e.target.value || null })}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
      </td>

      <td className="w-32 px-2 py-1.5">
        <input
          type="date"
          value={item.due_date ?? ""}
          disabled={readOnly}
          onChange={(e) => onUpdate({ due_date: e.target.value || null })}
          className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
      </td>

      <td className="w-20 px-2 py-1.5">
        <input
          type="number"
          step="0.25"
          min="0"
          value={hours}
          disabled={readOnly}
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => {
            const n = parseFloat(hours) || 0;
            if (n !== item.hours) onUpdate({ hours: n });
          }}
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-center text-xs text-slate-600 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white"
        />
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

      <td className="w-9 px-1 py-1.5 text-center">
        {!readOnly && (
          <button
            onClick={onDelete}
            className="hidden rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
            title="מחיקת משימה"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
