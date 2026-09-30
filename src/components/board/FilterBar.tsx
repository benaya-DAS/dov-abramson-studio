"use client";

import { useState } from "react";
import { FoldVertical, Search, UnfoldVertical, Users, X } from "lucide-react";
import { Avatar } from "@/components/topbar/UserMenu";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type SortBy = "none" | "person" | "status" | "due_date" | "serial_id";
export type GroupByMode = "group" | "person" | "status";

export default function FilterBar({
  profiles,
  currentUserId,
  search,
  onSearchChange,
  filterPersonId,
  onFilterPersonChange,
  sortBy,
  onSortByChange,
  groupBy,
  onGroupByChange,
  onCollapseAll,
  onExpandAll,
}: {
  profiles: Profile[];
  currentUserId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  filterPersonId: string | null;
  onFilterPersonChange: (v: string | null) => void;
  sortBy: SortBy;
  onSortByChange: (v: SortBy) => void;
  groupBy: GroupByMode;
  onGroupByChange: (v: GroupByMode) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}) {
  // Mobile only - see the two blocks below. Desktop always shows the input
  // outright (there's room for it); a phone-width bar doesn't have space
  // to spare for a search box that isn't in use, so it starts collapsed to
  // just an icon button there and expands into the same input on tap.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-5 py-2.5 dark:border-night-700 dark:bg-night-900">
      <div className="relative hidden md:block">
        <Search size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder="חיפוש משימה..."
          className="w-48 rounded-md border border-slate-200 bg-white py-1.5 pr-8 pl-2 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-night-700 dark:bg-night-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="md:hidden">
        {mobileSearchOpen ? (
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setMobileSearchOpen(false);
                  e.currentTarget.blur();
                }
              }}
              placeholder="חיפוש משימה..."
              className="w-40 rounded-md border border-slate-200 bg-white py-1.5 pr-8 pl-7 text-sm text-slate-900 outline-none focus:border-brand-400 dark:border-night-700 dark:bg-night-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              onClick={() => {
                onSearchChange("");
                setMobileSearchOpen(false);
              }}
              title="סגירת חיפוש"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setMobileSearchOpen(true)}
            title="חיפוש משימה"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border",
              search
                ? "border-brand-400 bg-brand-50 text-brand-600 dark:border-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-night-700 dark:text-slate-400 dark:hover:bg-night-800"
            )}
          >
            <Search size={16} />
          </button>
        )}
      </div>

      <button
        onClick={() => onFilterPersonChange(filterPersonId === currentUserId ? null : currentUserId)}
        disabled={!currentUserId}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
          filterPersonId && filterPersonId === currentUserId
            ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-300"
            : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
        )}
      >
        <Users size={14} />
        המשימות שלי
      </button>

      {filterPersonId && filterPersonId !== currentUserId && (
        <span className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          <Avatar
            profile={profiles.find((p) => p.id === filterPersonId) ?? null}
            size={16}
          />
          {profiles.find((p) => p.id === filterPersonId)?.full_name}
          <button onClick={() => onFilterPersonChange(null)}>
            <X size={12} />
          </button>
        </span>
      )}

      <select
        value={filterPersonId ?? ""}
        onChange={(e) => onFilterPersonChange(e.target.value || null)}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none dark:border-night-700 dark:bg-night-800 dark:text-slate-300"
      >
        <option value="">כל האנשים</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name || p.email}
          </option>
        ))}
      </select>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-night-700" />

      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        מיון:
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as SortBy)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-night-700 dark:bg-night-800 dark:text-slate-300"
        >
          <option value="none">ברירת מחדל</option>
          <option value="person">איש צוות</option>
          <option value="status">סטטוס</option>
          <option value="due_date">תאריך יעד</option>
          <option value="serial_id">מס&quot;ד</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        קיבוץ:
        <select
          value={groupBy}
          onChange={(e) => onGroupByChange(e.target.value as GroupByMode)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none dark:border-night-700 dark:bg-night-800 dark:text-slate-300"
        >
          <option value="group">קבוצות הלוח</option>
          <option value="person">איש צוות</option>
          <option value="status">סטטוס</option>
        </select>
      </label>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-night-700" />

      <button
        onClick={onCollapseAll}
        title="כיווץ כל הקבוצות"
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
      >
        <FoldVertical size={14} />
        כיווץ הכל
      </button>
      <button
        onClick={onExpandAll}
        title="פתיחת כל הקבוצות"
        className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-night-700 dark:text-slate-300 dark:hover:bg-night-800"
      >
        <UnfoldVertical size={14} />
        פתיחת הכל
      </button>
    </div>
  );
}
