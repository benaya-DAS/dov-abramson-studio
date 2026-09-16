"use client";

import { useState } from "react";
import { FileSpreadsheet, Lock, Trash2 } from "lucide-react";
import NewMonthButton from "./NewMonthButton";
import CatalogImporter from "./CatalogImporter";
import ExportButton from "./ExportButton";
import type { Item, Profile } from "@/lib/supabase/types";

export default function BoardHeader({
  boardId,
  boardName,
  workspaceName,
  isArchived,
  selectedCount,
  onDeleteSelected,
  items,
  profiles,
  groupNameByGroupId,
  trackedSecondsByItem,
}: {
  boardId: string;
  boardName: string;
  workspaceName?: string;
  isArchived: boolean;
  selectedCount: number;
  onDeleteSelected: () => void;
  items: Item[];
  profiles: Profile[];
  groupNameByGroupId: Record<string, string>;
  trackedSecondsByItem: Record<string, number>;
}) {
  const [showImporter, setShowImporter] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
      <div className="min-w-0 flex-1">
        {workspaceName && <p className="text-xs text-slate-400">{workspaceName}</p>}
        <h1 className="flex items-center gap-2 truncate text-lg font-bold text-slate-900">
          {boardName}
          {isArchived && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              <Lock size={11} />
              ארכיון - לקריאה בלבד
            </span>
          )}
        </h1>
      </div>

      {selectedCount > 0 && !isArchived && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 size={14} />
          מחיקת {selectedCount} נבחרים
        </button>
      )}

      <ExportButton
        items={items}
        profiles={profiles}
        groupNameByGroupId={groupNameByGroupId}
        boardName={boardName}
        trackedSecondsByItem={trackedSecondsByItem}
      />

      {!isArchived && (
        <>
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileSpreadsheet size={14} />
            ייבוא קטלוג
          </button>
          <NewMonthButton boardId={boardId} boardName={boardName} />
        </>
      )}

      {showImporter && <CatalogImporter onClose={() => setShowImporter(false)} />}
    </div>
  );
}
