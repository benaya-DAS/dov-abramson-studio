"use client";

import { ChevronDown, ChevronLeft, Plus } from "lucide-react";
import ItemRow from "./ItemRow";
import { formatDuration, formatHours } from "@/lib/utils";
import type { ActiveTimeLog, Item, Profile } from "@/lib/supabase/types";

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

  return (
    <div className="mb-4">
      <button
        onClick={onToggleCollapse}
        className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2"
        style={{ backgroundColor: `${group.color}1a` }}
      >
        {group.collapsed ? (
          <ChevronLeft size={16} style={{ color: group.color }} />
        ) : (
          <ChevronDown size={16} style={{ color: group.color }} />
        )}
        {onRenameGroup ? (
          <input
            defaultValue={group.name}
            onBlur={(e) => e.target.value.trim() && onRenameGroup(e.target.value.trim())}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-sm font-bold outline-none"
            style={{ color: group.color }}
          />
        ) : (
          <span className="text-sm font-bold" style={{ color: group.color }}>
            {group.name}
          </span>
        )}
        <span className="text-xs font-medium text-slate-400">{group.items.length} משימות</span>
        {onDeleteGroup && group.items.length === 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup();
            }}
            className="mr-auto text-xs text-slate-400 hover:text-red-500"
          >
            מחיקת קבוצה
          </button>
        )}
      </button>

      {!group.collapsed && (
        <div className="overflow-x-auto rounded-b-lg border border-t-0 border-slate-200">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-400">
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
                />
              ))}

              {!readOnly && group.isRealGroup && (
                <tr>
                  <td colSpan={11} className="px-3 py-1.5">
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
                <td colSpan={8} className="px-3 py-2 text-left">
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
