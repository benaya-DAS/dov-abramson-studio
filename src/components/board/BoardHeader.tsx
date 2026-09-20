"use client";

import { useState } from "react";
import { FileSpreadsheet, History, Lock, Trash2 } from "lucide-react";
import NewMonthButton from "./NewMonthButton";
import CatalogImporter from "./CatalogImporter";
import ExportButton from "./ExportButton";
import DeleteBoardButton from "./DeleteBoardButton";
import ActivityLogDrawer from "./ActivityLogDrawer";
import type { Item, Profile } from "@/lib/supabase/types";

export default function BoardHeader({
  boardId,
  boardName,
  onRenameBoard,
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
  onRenameBoard?: (name: string) => void;
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
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
      <div className="min-w-0 flex-1">
        {workspaceName && <p className="text-xs text-slate-400 dark:text-slate-500">{workspaceName}</p>}
        <div className="flex items-center gap-2">
          {onRenameBoard ? (
            <input
              defaultValue={boardName}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed && trimmed !== boardName) onRenameBoard(trimmed);
              }}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 -mx-1 text-lg font-bold text-slate-900 outline-none hover:border-slate-200 focus:border-brand-400 focus:bg-white dark:text-slate-100 dark:hover:border-night-700 dark:focus:bg-night-800"
            />
          ) : (
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{boardName}</h1>
          )}
          {isArchived && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-night-800 dark:text-slate-400">
              <Lock size={11} />
              ארכיון - לקריאה בלבד
            </span>
          )}
        </div>
      </div>

      {selectedCount > 0 && !isArchived && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
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

      <button
        onClick={() => setShowHistory(true)}
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
        title="היסטוריית פעילות"
      >
        <History size={14} />
        היסטוריה
      </button>

      {!isArchived && (
        <>
          <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
          >
            <FileSpreadsheet size={14} />
            ייבוא קטלוג
          </button>
          <NewMonthButton boardId={boardId} boardName={boardName} />
          {/* Only offered on an empty board - deleting a board that still
           * has items is far more likely to be a costly mistake than an
           * intentional cleanup. */}
          {items.length === 0 && <DeleteBoardButton boardId={boardId} boardName={boardName} />}
        </>
      )}

      {showImporter && <CatalogImporter onClose={() => setShowImporter(false)} />}
      {showHistory && (
        <ActivityLogDrawer
          boardId={boardId}
          profiles={profiles}
          groupNameByGroupId={groupNameByGroupId}
          readOnly={isArchived}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
