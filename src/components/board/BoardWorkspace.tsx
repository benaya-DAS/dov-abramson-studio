"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BoardHeader from "./BoardHeader";
import ViewTabs, { type BoardView } from "./ViewTabs";
import FilterBar, { type GroupByMode, type SortBy } from "./FilterBar";
import BoardTable from "./BoardTable";
import BoardGantt from "./BoardGantt";
import BoardCalendar from "./BoardCalendar";
import type { DisplayGroup } from "./GroupSection";
import { GROUP_COLORS, STATUS_LABELS, STATUS_ORDER } from "@/lib/constants";
import type { ActiveTimeLog, Board, Group, Item, Profile } from "@/lib/supabase/types";

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

  const [boardName, setBoardName] = useState(board.name);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [trackedSecondsByItem, setTrackedSecondsByItem] = useState<Record<string, number>>({});
  const [activeSessionsByItem, setActiveSessionsByItem] = useState<Record<string, ActiveTimeLog[]>>(
    {}
  );

  const [view, setView] = useState<BoardView>("table");
  const [search, setSearch] = useState("");
  const [filterPersonId, setFilterPersonId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("none");
  const [groupBy, setGroupBy] = useState<GroupByMode>("group");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The id of a "draft" row addItem() just created locally - it isn't in
  // the database at all yet (see addItem below), which is what makes
  // Escape-to-discard trivial: there's nothing to delete or leave a trace
  // of. Cleared the moment the row is actually edited (updateItem), at
  // which point it gets its real INSERT and behaves like any other item
  // from then on. Only one row can be mid-draft at a time.
  const [draftItemId, setDraftItemId] = useState<string | null>(null);
  // Per-item queue of pending writes, so a draft's own INSERT (fired by its
  // first edit) and a second edit landing moments later - e.g. the catalog
  // auto-fill in handleNameBlur, which round-trips to the server before
  // calling updateItem again - can never race each other into an UPDATE
  // reaching Postgres before the INSERT it depends on has.
  const pendingWritesRef = useRef<Map<string, Promise<void>>>(new Map());

  function queueItemWrite(id: string, run: () => Promise<void>) {
    const prior = pendingWritesRef.current.get(id) ?? Promise.resolve();
    const next = prior.then(run, run);
    pendingWritesRef.current.set(id, next);
    return next;
  }
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialGroups.map((g) => [g.id, g.is_collapsed]))
  );

  function renameBoard(name: string) {
    setBoardName(name);
    supabase.from("boards").update({ name }).eq("id", board.id).then();
  }

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

  // ---- Time tracking: completed-session totals + any currently-running
  // session, for every item, from every studio member (not just the
  // viewer's own) -----------------------------------------------------
  const itemIdsKey = useMemo(() => items.map((i) => i.id).join(","), [items]);

  const refreshTrackedSeconds = useCallback(async () => {
    if (items.length === 0) return;
    const itemIds = items.map((i) => i.id);
    const [{ data: totals }, { data: active }] = await Promise.all([
      supabase.from("item_tracked_seconds").select("item_id, tracked_seconds").in("item_id", itemIds),
      supabase
        .from("time_logs")
        .select("id, item_id, user_id, start_time")
        .in("item_id", itemIds)
        .is("end_time", null),
    ]);
    if (totals) {
      setTrackedSecondsByItem(
        Object.fromEntries(totals.map((r) => [r.item_id, r.tracked_seconds]))
      );
    }
    if (active) {
      const grouped: Record<string, ActiveTimeLog[]> = {};
      for (const row of active) {
        (grouped[row.item_id] ??= []).push({
          id: row.id,
          user_id: row.user_id,
          start_time: row.start_time,
        });
      }
      setActiveSessionsByItem(grouped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, itemIdsKey]);

  useEffect(() => {
    // Fetch-on-mount / on-item-set-change to (re)hydrate the group SUM
    // footers and each item's play/pause state with tracked-time totals.
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
  // A draft row (see draftItemId) doesn't exist in the database yet, so its
  // first edit has to INSERT the whole row instead of UPDATEing one - after
  // that it's a normal item and every further call takes the plain update
  // path below.
  async function insertDraftItem(item: Item) {
    // created_at/updated_at are deliberately left out - the database's own
    // defaults reflect the moment the row actually landed, not when the
    // draft was first put on screen.
    const { data, error } = await supabase
      .from("items")
      .insert({
        id: item.id,
        board_id: item.board_id,
        group_id: item.group_id,
        name: item.name,
        person_ids: item.person_ids,
        deliverable: item.deliverable,
        status: item.status,
        status_label: item.status_label,
        serial_id: item.serial_id,
        start_date: item.start_date,
        due_date: item.due_date,
        hours: item.hours,
        position: item.position,
        created_by: item.created_by,
      })
      .select()
      .single();
    if (error || !data) {
      console.error("Failed to save new item:", error);
      // Never actually made it into the database - drop the local draft
      // rather than leaving a row on screen that a refresh would lose.
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
  }

  function updateItem(id: string, patch: Partial<Item>) {
    if (id === draftItemId) {
      const draft = items.find((i) => i.id === id);
      if (!draft) return;
      const merged = { ...draft, ...patch };
      setItems((prev) => prev.map((i) => (i.id === id ? merged : i)));
      setDraftItemId(null);
      queueItemWrite(id, () => insertDraftItem(merged));
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    queueItemWrite(id, async () => {
      const { error } = await supabase.from("items").update(patch).eq("id", id);
      if (error) console.error("Failed to update item:", error);
    });
  }

  // Adds a row that exists only in local state, not yet in the database -
  // nothing to persist until the user actually does something with it (see
  // updateItem/insertDraftItem above). That's what makes discarding it on
  // an immediate Escape (below) trivial: there's no row and no history
  // entry to undo, because none was ever created.
  function addItem(groupId: string) {
    const inGroup = items.filter((i) => i.group_id === groupId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const draft: Item = {
      id,
      board_id: board.id,
      group_id: groupId,
      name: "",
      // Default-assign the item to whoever created it, rather than leaving
      // it unassigned - they can still remove themselves via PersonPicker
      // if that's not actually right for this task.
      person_ids: currentUserId ? [currentUserId] : [],
      deliverable: null,
      status: "not_started",
      status_label: null,
      serial_id: null,
      start_date: null,
      due_date: null,
      hours: 0,
      position: inGroup.length,
      created_by: currentUserId,
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [...prev, draft]);
    setDraftItemId(id);
  }

  // Escaping out of a just-created row's name field before typing anything
  // into it - see draftItemId above. The row was never inserted, so this is
  // just removing it from local state; there's nothing in the database to
  // delete and nothing in board history to leave a trace of.
  function discardDraftItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDraftItemId((current) => (current === id ? null : current));
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setSelected(new Set());
    setDraftItemId((current) => (current && ids.includes(current) ? null : current));
    await supabase.from("items").delete().in("id", ids);
  }

  // Drag-and-drop move: item.position is scoped per group_id (addItem seeds
  // new rows at `inGroup.length`), so moving into a different group means
  // giving the item that group's group_id AND renumbering both the
  // target group (to make room) and the source group (to close the gap it
  // left behind) - not just a single position swap. targetItemId === null
  // means "drop at the end of targetGroupId" (dropped on the group header,
  // or into a currently-empty group); position is which side of
  // targetItemId to land on, and is ignored when targetItemId is null.
  function moveItem(
    draggedId: string,
    targetGroupId: string,
    targetItemId: string | null,
    position: "before" | "after" = "before"
  ) {
    if (draggedId === targetItemId) return;
    setItems((prev) => {
      const dragged = prev.find((i) => i.id === draggedId);
      if (!dragged) return prev;
      const sourceGroupId = dragged.group_id;

      const targetList = prev
        .filter((i) => i.group_id === targetGroupId && i.id !== draggedId)
        .sort((a, b) => a.position - b.position);
      let insertIndex = targetItemId
        ? Math.max(0, targetList.findIndex((i) => i.id === targetItemId))
        : targetList.length;
      if (targetItemId && position === "after") insertIndex += 1;
      targetList.splice(insertIndex, 0, dragged);

      const patches = new Map<string, { position: number; group_id?: string }>();
      targetList.forEach((it, i) => {
        patches.set(it.id, { position: i, group_id: it.id === draggedId ? targetGroupId : undefined });
      });

      if (sourceGroupId !== targetGroupId) {
        prev
          .filter((i) => i.group_id === sourceGroupId && i.id !== draggedId)
          .sort((a, b) => a.position - b.position)
          .forEach((it, i) => patches.set(it.id, { position: i }));
      }

      patches.forEach((patch, id) => {
        const dbPatch: Partial<Item> = { position: patch.position };
        if (patch.group_id) dbPatch.group_id = patch.group_id;
        supabase.from("items").update(dbPatch).eq("id", id).then();
      });

      return prev.map((it) => {
        const patch = patches.get(it.id);
        if (!patch) return it;
        return { ...it, position: patch.position, ...(patch.group_id ? { group_id: patch.group_id } : {}) };
      });
    });
  }

  async function addGroup(name: string) {
    const color = GROUP_COLORS[groups.length % GROUP_COLORS.length];
    const { data } = await supabase
      .from("groups")
      .insert({ board_id: board.id, name, position: groups.length, color })
      .select()
      .single();
    if (data) setGroups((prev) => [...prev, data]);
  }

  function renameGroup(groupId: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
    supabase.from("groups").update({ name }).eq("id", groupId).then();
  }

  function changeGroupColor(groupId: string, color: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, color } : g)));
    supabase.from("groups").update({ color }).eq("id", groupId).then();
  }

  // Drag-and-drop reorder: reads the CURRENT sorted order out of the state
  // updater (not from the `groups` closure, which could be a render behind
  // by the time a fast drag-drop lands) so a quick drag-then-drop sequence
  // always reorders relative to what's actually on screen. position is
  // which side of targetId the dragged group lands on.
  function reorderGroup(draggedId: string, targetId: string, position: "before" | "after" = "before") {
    if (draggedId === targetId) return;
    setGroups((prev) => {
      const ordered = [...prev].sort((a, b) => a.position - b.position);
      const fromIndex = ordered.findIndex((g) => g.id === draggedId);
      if (fromIndex === -1) return prev;
      const [moved] = ordered.splice(fromIndex, 1);
      // Recompute the target's index after removing the dragged group -
      // if the drag moved something from earlier in the list, everything
      // after it shifted back by one.
      const toIndex = ordered.findIndex((g) => g.id === targetId);
      if (toIndex === -1) return prev;
      const insertIndex = position === "after" ? toIndex + 1 : toIndex;
      ordered.splice(insertIndex, 0, moved);
      ordered.forEach((g, i) => {
        if (g.position !== i) supabase.from("groups").update({ position: i }).eq("id", g.id).then();
      });
      return ordered.map((g, i) => ({ ...g, position: i }));
    });
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
      if (filterPersonId && !item.person_ids.includes(filterPersonId)) return false;
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
    // Sorts by the joined names of everyone assigned (alphabetical,
    // comma-separated) - an item with no one assigned sorts last.
    const personNames = (ids: string[]) => {
      if (ids.length === 0) return "￿";
      return ids
        .map((id) => profiles.find((p) => p.id === id)?.full_name ?? "")
        .sort((a, b) => a.localeCompare(b, "he"))
        .join(", ");
    };
    const copy = [...filteredItems];
    copy.sort((a, b) => {
      switch (sortBy) {
        case "person":
          return personNames(a.person_ids).localeCompare(personNames(b.person_ids), "he");
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
      // An item assigned to several people shows up under each of their
      // buckets (a real duplication, not just a display quirk) - there's
      // no single "owning" group to pick when grouping by an inherently
      // multi-valued field.
      const buckets = new Map<string, Item[]>();
      for (const item of sortedItems) {
        const keys = item.person_ids.length > 0 ? item.person_ids : ["__unassigned"];
        for (const key of keys) {
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push(item);
        }
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
        boardName={boardName}
        onRenameBoard={readOnly ? undefined : renameBoard}
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
            onSerialBlur={handleSerialBlur}
            onNameBlur={handleNameBlur}
            onAddItem={addItem}
            draftItemId={draftItemId}
            onDiscardDraftItem={discardDraftItem}
            onAddGroup={addGroup}
            onRenameGroup={renameGroup}
            onDeleteGroup={deleteGroup}
            onChangeGroupColor={changeGroupColor}
            onReorderGroup={reorderGroup}
            onMoveItem={moveItem}
            currentUserId={currentUserId}
            trackedSecondsByItem={trackedSecondsByItem}
            activeSessionsByItem={activeSessionsByItem}
            onTimeLogChanged={refreshTrackedSeconds}
            readOnly={readOnly}
            canAddGroup={groupBy === "group"}
            canReorderGroups={groupBy === "group"}
            canReorderItems={groupBy === "group" && sortBy === "none"}
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
