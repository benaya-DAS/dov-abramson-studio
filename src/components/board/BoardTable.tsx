"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import GroupSection, { type DisplayGroup } from "./GroupSection";
import { DELIVERABLE_OPTIONS } from "@/lib/constants";
import type { ActiveTimeLog, Item, Profile } from "@/lib/supabase/types";

// FLIP ("First, Last, Invert, Play"): archiving/restoring a group moves it
// between two separate sections of the page (active groups vs. the
// "ארכיון" list below), which - since they're rendered by two different
// .map() calls - genuinely unmounts it from one spot and mounts it fresh in
// the other, rather than updating one element in place. That fresh mount is
// exactly what this wraps: if BoardTable recorded where the group's box
// used to be (in originRects, captured the instant the archive toggle was
// clicked, before the re-render moved it), this offsets the freshly-mounted
// box back to that spot with no transition, then releases it to its real
// position on the next frame WITH a transition - so instead of popping
// straight to its new spot, it visibly slides there.
function FlipGroup({
  groupId,
  nodesRef,
  originRects,
  children,
}: {
  groupId: string;
  nodesRef: React.RefObject<Map<string, HTMLDivElement>>;
  originRects: React.RefObject<Map<string, DOMRect>>;
  children: React.ReactNode;
}) {
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) nodesRef.current.set(groupId, el);
      else nodesRef.current.delete(groupId);
    },
    [groupId, nodesRef]
  );

  useLayoutEffect(() => {
    const el = nodesRef.current.get(groupId);
    const origin = originRects.current.get(groupId);
    if (!el || !origin) return;
    originRects.current.delete(groupId);
    const next = el.getBoundingClientRect();
    const dx = origin.left - next.left;
    const dy = origin.top - next.top;
    if (!dx && !dy) return;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    // Forces layout so the browser registers that starting transform
    // before the rAF below flips it to the animated end state - without
    // this the two style writes would coalesce into one and there'd be
    // nothing to visibly transition from.
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)";
      el.style.transform = "";
    });
    // groupId alone as the dep is deliberate: this must run exactly once
    // per genuine mount (a new groupId), never on an ordinary re-render of
    // an already-mounted group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return <div ref={setRef}>{children}</div>;
}

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
  newItemId,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onChangeGroupColor,
  onToggleGroupArchived,
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
  /** The item addItem() most recently created - see BoardWorkspace. */
  newItemId: string | null;
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onChangeGroupColor: (groupId: string, color: string) => void;
  onToggleGroupArchived: (groupId: string, archived: boolean) => void;
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

  // See FlipGroup above - groupNodesRef is every currently-mounted group's
  // own DOM node (so its box can be measured on demand), originRects is
  // where a group's box was the instant it was archived/restored, until
  // FlipGroup consumes that entry on its next mount.
  const groupNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const originRectsRef = useRef<Map<string, DOMRect>>(new Map());

  function handleToggleGroupArchived(groupId: string, archived: boolean) {
    const node = groupNodesRef.current.get(groupId);
    if (node) originRectsRef.current.set(groupId, node.getBoundingClientRect());
    onToggleGroupArchived(groupId, archived);
  }

  function submitNewGroup() {
    const trimmed = newGroupName.trim();
    if (trimmed) onAddGroup(trimmed);
    setNewGroupName("");
    setAddingGroup(false);
  }

  // Archived groups (see DisplayGroup.isArchived) drop to their own
  // "ארכיון" section below the active ones instead of sitting in position
  // order among them - split once here rather than filtering the same
  // array twice below.
  const activeGroups = displayGroups.filter((g) => !g.isArchived);
  const archivedGroups = displayGroups.filter((g) => g.isArchived);

  function renderGroup(group: DisplayGroup) {
    // A group archived on its own (independent of the whole board) is
    // read-only the same way an archived board's groups are - forcing it
    // here, rather than only in GroupSection, is what also turns off
    // reordering and the other per-group edit controls below.
    const effectiveReadOnly = readOnly || group.isArchived;
    const canReorderThis = canReorderGroups && group.isRealGroup && !effectiveReadOnly;
    const canReorderItemsHere = canReorderItems && group.isRealGroup && !effectiveReadOnly;
    return (
      <FlipGroup key={group.id} groupId={group.id} nodesRef={groupNodesRef} originRects={originRectsRef}>
        <GroupSection
          group={group}
          profiles={profiles}
          selected={selected}
          onToggleSelect={onToggleSelect}
          onToggleCollapse={() => onToggleCollapse(group.id)}
          onUpdateItem={onUpdateItem}
          onSerialBlur={onSerialBlur}
          onNameBlur={onNameBlur}
          onAddItem={() => onAddItem(group.id)}
          newItemId={newItemId}
          onRenameGroup={
            group.isRealGroup && !effectiveReadOnly ? (name) => onRenameGroup(group.id, name) : undefined
          }
          onDeleteGroup={
            group.isRealGroup && !effectiveReadOnly ? () => onDeleteGroup(group.id) : undefined
          }
          onColorChange={
            group.isRealGroup && !effectiveReadOnly
              ? (color) => onChangeGroupColor(group.id, color)
              : undefined
          }
          // Deliberately gated on the board-level readOnly, not
          // effectiveReadOnly - it has to stay available while the group
          // itself is archived, since that's the only way back. Routed
          // through handleToggleGroupArchived (not the prop directly) so
          // the FLIP animation has a "before" rect to work from.
          onToggleArchived={
            group.isRealGroup && !readOnly
              ? (archived) => handleToggleGroupArchived(group.id, archived)
              : undefined
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
          readOnly={effectiveReadOnly}
        />
      </FlipGroup>
    );
  }

  return (
    <div className="p-5">
      {displayGroups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">אין משימות להצגה.</p>
      )}

      {activeGroups.map(renderGroup)}

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

      {archivedGroups.length > 0 && (
        <div className="mt-8 border-t border-slate-200 pt-4 dark:border-night-700">
          <h3 className="mb-3 text-sm font-bold text-slate-400 dark:text-slate-500">ארכיון</h3>
          {archivedGroups.map(renderGroup)}
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
