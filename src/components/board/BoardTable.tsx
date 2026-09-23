"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import GroupSection, { type DisplayGroup } from "./GroupSection";
import { DELIVERABLE_OPTIONS } from "@/lib/constants";
import type { ActiveTimeLog, Item, Profile } from "@/lib/supabase/types";

export default function BoardTable({
  displayGroups,
  profiles,
  selected,
  onToggleSelect,
  onToggleCollapse,
  onUpdateItem,
  onSerialBlur,
  onNameBlur,
  onAddItem,
  draftItemId,
  onDiscardDraftItem,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onChangeGroupColor,
  onReorderGroup,
  onMoveItem,
  currentUserId,
  trackedSecondsByItem,
  activeSessionsByItem,
  onTimeLogChanged,
  readOnly,
  canAddGroup,
  canReorderGroups,
  canReorderItems,
}: {
  displayGroups: DisplayGroup[];
  profiles: Profile[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleCollapse: (groupId: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onSerialBlur: (id: string, serial: string) => void;
  onNameBlur: (id: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  /** The id of a not-yet-saved draft row addItem() just created locally -
   * see BoardWorkspace. */
  draftItemId: string | null;
  onDiscardDraftItem: (id: string) => void;
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onChangeGroupColor: (groupId: string, color: string) => void;
  onReorderGroup: (draggedId: string, targetId: string, position: "before" | "after") => void;
  /** targetItemId null means "append at the end of targetGroupId" (dropped
   * on the group header, or into a currently-empty group); position is
   * ignored in that case. */
  onMoveItem: (
    draggedId: string,
    targetGroupId: string,
    targetItemId: string | null,
    position: "before" | "after"
  ) => void;
  currentUserId: string | null;
  trackedSecondsByItem: Record<string, number>;
  activeSessionsByItem: Record<string, ActiveTimeLog[]>;
  onTimeLogChanged: () => void;
  readOnly?: boolean;
  canAddGroup: boolean;
  canReorderGroups: boolean;
  canReorderItems: boolean;
}) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  // Which edge of dragOverGroupId the dragged group would land on - drives
  // the top/bottom insertion-line indicator instead of a box highlight.
  const [dragOverGroupPosition, setDragOverGroupPosition] = useState<"before" | "after">("before");

  // Lifted above per-group state (rather than living inside each
  // GroupSection) so a row in one group can recognize an item drag that
  // started in a DIFFERENT group's table - that's what makes moving an
  // item across groups possible, not just reordering within one.
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  // Either an item id (hovering a row) or `group:<id>` (hovering a group's
  // header/empty body, for appending at the end of that group).
  const [dragOverItemKey, setDragOverItemKey] = useState<string | null>(null);
  // Which edge of the hovered row the dragged item would land on - only
  // meaningful when dragOverItemKey is an item id, not a `group:<id>`
  // header key (appending always lands at the very end, no ambiguity).
  const [dragOverItemPosition, setDragOverItemPosition] = useState<"before" | "after">("before");

  function submitNewGroup() {
    const trimmed = newGroupName.trim();
    if (trimmed) onAddGroup(trimmed);
    setNewGroupName("");
    setAddingGroup(false);
  }

  return (
    <div className="p-5">
      {displayGroups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">אין משימות להצגה.</p>
      )}

      {displayGroups.map((group) => {
        const canReorderThis = canReorderGroups && group.isRealGroup && !readOnly;
        const canReorderItemsHere = canReorderItems && group.isRealGroup && !readOnly;
        return (
          <GroupSection
            key={group.id}
            group={group}
            profiles={profiles}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleCollapse={() => onToggleCollapse(group.id)}
            onUpdateItem={onUpdateItem}
            onSerialBlur={onSerialBlur}
            onNameBlur={onNameBlur}
            onAddItem={() => onAddItem(group.id)}
            draftItemId={draftItemId}
            onDiscardDraftItem={onDiscardDraftItem}
            onRenameGroup={
              group.isRealGroup && !readOnly ? (name) => onRenameGroup(group.id, name) : undefined
            }
            onDeleteGroup={
              group.isRealGroup && !readOnly ? () => onDeleteGroup(group.id) : undefined
            }
            onColorChange={
              group.isRealGroup && !readOnly ? (color) => onChangeGroupColor(group.id, color) : undefined
            }
            canReorder={canReorderThis}
            isDragging={draggingId === group.id}
            isDropTarget={dragOverGroupId === group.id && draggingId !== group.id}
            dragOverGroupPosition={dragOverGroupPosition}
            onDragStart={canReorderThis ? () => setDraggingId(group.id) : undefined}
            onDragEnd={
              canReorderThis
                ? () => {
                    setDraggingId(null);
                    setDragOverGroupId(null);
                  }
                : undefined
            }
            onDragOverGroup={
              canReorderThis && draggingId
                ? (position) => {
                    setDragOverGroupId(group.id);
                    setDragOverGroupPosition(position);
                  }
                : undefined
            }
            onDropOnGroup={
              canReorderThis && draggingId
                ? (position) => {
                    onReorderGroup(draggingId, group.id, position);
                    setDraggingId(null);
                    setDragOverGroupId(null);
                  }
                : undefined
            }
            canReorderItems={canReorderItemsHere}
            draggingItemId={draggingItemId}
            dragOverItemKey={dragOverItemKey}
            dragOverItemPosition={dragOverItemPosition}
            onItemDragStart={(itemId) => setDraggingItemId(itemId)}
            onItemDragEnd={() => {
              setDraggingItemId(null);
              setDragOverItemKey(null);
            }}
            onItemDragOver={(key, position) => {
              setDragOverItemKey(key);
              setDragOverItemPosition(position);
            }}
            onMoveItemHere={(draggedId, targetItemId, position) =>
              onMoveItem(draggedId, group.id, targetItemId, position)
            }
            currentUserId={currentUserId}
            trackedSecondsByItem={trackedSecondsByItem}
            activeSessionsByItem={activeSessionsByItem}
            onTimeLogChanged={onTimeLogChanged}
            readOnly={readOnly}
          />
        );
      })}

      {!readOnly && canAddGroup && (
        <div className="mt-2">
          {addingGroup ? (
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onBlur={submitNewGroup}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewGroup();
                if (e.key === "Escape") setAddingGroup(false);
              }}
              placeholder="שם הקבוצה החדשה"
              className="w-56 rounded-md border border-brand-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none dark:border-brand-700 dark:bg-night-800 dark:text-slate-100"
            />
          ) : (
            <button
              onClick={() => setAddingGroup(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-500 dark:hover:bg-night-800 dark:hover:text-brand-400"
            >
              <Plus size={15} />
              הוספת קבוצה
            </button>
          )}
        </div>
      )}

      <datalist id="deliverable-options">
        {DELIVERABLE_OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
