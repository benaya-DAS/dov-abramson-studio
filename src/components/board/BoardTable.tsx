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
  onDeleteItem,
  onSerialBlur,
  onNameBlur,
  onAddItem,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  currentUserId,
  trackedSecondsByItem,
  activeSessionsByItem,
  readOnly,
  canAddGroup,
}: {
  displayGroups: DisplayGroup[];
  profiles: Profile[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleCollapse: (groupId: string) => void;
  onUpdateItem: (id: string, patch: Partial<Item>) => void;
  onDeleteItem: (id: string) => void;
  onSerialBlur: (id: string, serial: string) => void;
  onNameBlur: (id: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  onAddGroup: (name: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  currentUserId: string | null;
  trackedSecondsByItem: Record<string, number>;
  activeSessionsByItem: Record<string, ActiveTimeLog[]>;
  readOnly?: boolean;
  canAddGroup: boolean;
}) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  function submitNewGroup() {
    const trimmed = newGroupName.trim();
    if (trimmed) onAddGroup(trimmed);
    setNewGroupName("");
    setAddingGroup(false);
  }

  return (
    <div className="p-5">
      {displayGroups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">אין משימות להצגה.</p>
      )}

      {displayGroups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          profiles={profiles}
          selected={selected}
          onToggleSelect={onToggleSelect}
          onToggleCollapse={() => onToggleCollapse(group.id)}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onSerialBlur={onSerialBlur}
          onNameBlur={onNameBlur}
          onAddItem={() => onAddItem(group.id)}
          onRenameGroup={
            group.isRealGroup && !readOnly ? (name) => onRenameGroup(group.id, name) : undefined
          }
          onDeleteGroup={
            group.isRealGroup && !readOnly ? () => onDeleteGroup(group.id) : undefined
          }
          currentUserId={currentUserId}
          trackedSecondsByItem={trackedSecondsByItem}
          activeSessionsByItem={activeSessionsByItem}
          readOnly={readOnly}
        />
      ))}

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
              className="w-56 rounded-md border border-brand-300 px-3 py-1.5 text-sm outline-none"
            />
          ) : (
            <button
              onClick={() => setAddingGroup(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-100 hover:text-brand-600"
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
