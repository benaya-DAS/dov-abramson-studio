"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BoardHeader from "./BoardHeader";
import ViewTabs, { type BoardView } from "./ViewTabs";
import FilterBar, { type GroupByMode, type SortBy } from "./FilterBar";
import BoardTable from "./BoardTable";
import BoardGantt from "./BoardGantt";
import BoardCalendar from "./BoardCalendar";
import type { DisplayGroup } from "./GroupSection";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { Board, Group, Item, Profile } from "@/lib/supabase/types";

export default function BoardWorkspace({
  board,
  workspaceName,
  initialGroups,
  initialItems,
  profiles,
  currentUserId,
}: {
  board: Board;
  workspaceName?: string;
  initialGroups: Group[];
  initialItems: Item[];
  profiles: Profile[];
  currentUserId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const readOnly = board.is_archived;

  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [trackedSecondsByItem, setTrackedSecondsByItem] = useState<Record<string, number>>({});

  const [view, setView] = useState<BoardView>("table");
  const [search, setSearch] = useState("");
  const [filterPersonId, setFilterPersonId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("none");
  const [groupBy, setGroupBy] = useState<GroupByMode>("group");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialGroups.map((g) => [g.id, g.is_collapsed]))
  );

  // ---- Realtime sync -------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`board-${board.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((i) => i.id !== (payload.old as Item).id);
            }
            const row = payload.new as Item;
            const exists = prev.some((i) => i.id === row.id);
            return exists ? prev.map((i) => (i.id === row.id ? row : i)) : [...prev, row];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `board_id=eq.${board.id}` },
        (payload) => {
          setGroups((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((g) => g.id !== (payload.old as Group).id);
            }
            const row = payload.new as Group;
            const exists = prev.some((g) => g.id === row.id);
            return exists ? prev.map((g) => (g.id === row.id ? row : g)) : [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, board.id]);

  // ---- Tracked-time totals (closed sessions) --------------------------
  const itemIdsKey = useMemo(() => items.map((i) => i.id).join(","), [items]);

  const refreshTrackedSeconds = useCallback(async () => {
    if (items.length === 0) return;
    const { data } = await supabase
      .from("item_tracked_seconds")
      .select("item_id, tracked_seconds")
      .in(
        "item_id",
        items.map((i) => i.id)
      );
    if (data) {
      setTrackedSecondsByItem(
        Object.fromEntries(data.map((r) => [r.item_id, r.tracked_seconds]))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, itemIdsKey]);

  useEffect(() => {
    // Fetch-on-mount / on-item-set-change to (re)hydrate the group SUM
    // footers with tracked-time totals.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshTrackedSeconds();
  }, [refreshTrackedSeconds]);

  useEffect(() => {
    const channel = supabase
      .channel(`board-time-${board.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_logs" }, () => {
        refreshTrackedSeconds();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, board.id, refreshTrackedSeconds]);

  // ---- Mutations --------------------------------------------------------
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    supabase.from("items").update(patch).eq("id", id).then();
  }

  async function addItem(groupId: string) {
    const inGroup = items.filter((i) => i.group_id === groupId);
    const { data } = await supabase
      .from("items")
      .insert({ board_id: board.id, group_id: groupId, position: inGroup.length })
      .select()
      .single();
    if (data) setItems((prev) => [...prev, data]);
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await supabase.from("items").delete().eq("id", id);
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected(new Set());
    await supabase.from("items").delete().in("id", ids);
  }

  async function addGroup(name: string) {
    const { data } = await supabase
      .from("groups")
      .insert({ board_id: board.id, name, position: groups.length })
      .select()
      .single();
    if (data) setGroups((prev) => [...prev, data]);
  }

  function renameGroup(groupId: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
    supabase.from("groups").update({ name }).eq("id", groupId).then();
  }

  async function deleteGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    await supabase.from("groups").delete().eq("id", groupId);
  }

  function toggleCollapse(groupId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      supabase.from("groups").update({ is_collapsed: next[groupId] }).eq("id", groupId).then();
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ---- Catalog auto-fill (מס"ד <-> Item) ---------------------------
  async function handleSerialBlur(itemId: string, serial: string) {
    const trimmed = serial.trim();
    if (!trimmed) return;
    const { data } = await supabase
      .from("project_catalog")
      .select("title")
      .eq("serial_id", trimmed)
      .maybeSingle();
    if (data?.title) updateItem(itemId, { name: data.title });
  }

  async function handleNameBlur(itemId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = items.find((i) => i.id === itemId);
    if (current?.serial_id) return; // already linked to a serial, don't override
    const { data } = await supabase
      .from("project_catalog")
      .select("serial_id")
      .ilike("title", trimmed)
      .maybeSingle();
    if (data?.serial_id) updateItem(itemId, { serial_id: data.serial_id });
  }

  // ---- Derived: filter + sort + group -----------------------------
  const groupNameByGroupId = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterPersonId && item.person_id !== filterPersonId) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${item.name} ${item.serial_id ?? ""} ${item.deliverable ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterPersonId, search]);

  const sortedItems = useMemo(() => {
    if (sortBy === "none") return filteredItems;
    const personName = (id: string | null) =>
      profiles.find((p) => p.id === id)?.full_name ?? "￿";
    const copy = [...filteredItems];
    copy.sort((a, b) => {
      switch (sortBy) {
        case "person":
          return personName(a.person_id).localeCompare(personName(b.person_id), "he");
        case "status":
          return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        case "due_date":
          return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
        case "serial_id":
          return (a.serial_id ?? "").localeCompare(b.serial_id ?? "");
        default:
          return 0;
      }
    });
    return copy;
  }, [filteredItems, sortBy, profiles]);

  const displayGroups: DisplayGroup[] = useMemo(() => {
    if (groupBy === "group") {
      return groups
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((g) => ({
          id: g.id,
          name: g.name,
          color: g.color,
          collapsed: collapsed[g.id] ?? false,
          items: sortedItems
            .filter((i) => i.group_id === g.id)
            .sort((a, b) => (sortBy === "none" ? a.position - b.position : 0)),
          isRealGroup: true,
        }));
    }

    if (groupBy === "person") {
      const buckets = new Map<string, Item[]>();
      for (const item of sortedItems) {
        const key = item.person_id ?? "__unassigned";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(item);
      }
      return Array.from(buckets.entries()).map(([key, its]) => ({
        id: key,
        name:
          key === "__unassigned"
            ? "ללא הקצאה"
            : profiles.find((p) => p.id === key)?.full_name ?? "לא ידוע",
        color: "#579bfc",
        collapsed: collapsed[key] ?? false,
        items: its,
        isRealGroup: false,
      }));
    }

    // groupBy === 'status'
    const buckets = new Map<string, Item[]>();
    for (const status of STATUS_ORDER) buckets.set(status, []);
    for (const item of sortedItems) buckets.get(item.status)!.push(item);
    return Array.from(buckets.entries())
      .filter(([, its]) => its.length > 0)
      .map(([status, its]) => ({
        id: status,
        name: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
        color: "#579bfc",
        collapsed: collapsed[status] ?? false,
        items: its,
        isRealGroup: false,
      }));
  }, [groupBy, groups, sortedItems, collapsed, profiles, sortBy]);

  return (
    <div className="flex h-full flex-col">
      <BoardHeader
        boardId={board.id}
        boardName={board.name}
        workspaceName={workspaceName}
        isArchived={readOnly}
        selectedCount={selected.size}
        onDeleteSelected={deleteSelected}
        items={sortedItems}
        profiles={profiles}
        groupNameByGroupId={groupNameByGroupId}
        trackedSecondsByItem={trackedSecondsByItem}
      />
      <ViewTabs view={view} onChange={setView} />
      {view === "table" && (
        <FilterBar
          profiles={profiles}
          currentUserId={currentUserId}
          search={search}
          onSearchChange={setSearch}
          filterPersonId={filterPersonId}
          onFilterPersonChange={setFilterPersonId}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {view === "table" && (
          <BoardTable
            displayGroups={displayGroups}
            profiles={profiles}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleCollapse={toggleCollapse}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onSerialBlur={handleSerialBlur}
            onNameBlur={handleNameBlur}
            onAddItem={addItem}
            onAddGroup={addGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={deleteGroup}
            currentUserId={currentUserId}
            trackedSecondsByItem={trackedSecondsByItem}
            readOnly={readOnly}
            canAddGroup={groupBy === "group"}
          />
        )}
        {view === "gantt" && (
          <BoardGantt items={filteredItems} profiles={profiles} groupNameByGroupId={groupNameByGroupId} />
        )}
        {view === "calendar" && (
          <BoardCalendar
            items={filteredItems}
            profiles={profiles}
            initialMonth={board.month}
            initialYear={board.year}
          />
        )}
      </div>
    </div>
  );
}
