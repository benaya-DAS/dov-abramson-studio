import { createClient } from "@/lib/supabase/server";
import type { Board, Workspace } from "@/lib/supabase/types";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export type WorkspaceWithBoards = Workspace & { boards: Board[] };

export async function getWorkspacesWithBoards(): Promise<WorkspaceWithBoards[]> {
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .order("position", { ascending: true });

  const { data: boards } = await supabase
    .from("boards")
    .select("*")
    .eq("is_archived", false)
    .order("position", { ascending: true });

  return (workspaces ?? []).map((ws) => ({
    ...ws,
    boards: (boards ?? []).filter((b) => b.workspace_id === ws.id),
  }));
}

export async function getArchivedBoards() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("*, workspaces(name)")
    .eq("is_archived", true)
    .order("archived_at", { ascending: false });
  return data ?? [];
}

export async function getBoardMeta(boardId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("boards")
    .select("*, workspaces(id, name)")
    .eq("id", boardId)
    .single();
  return data;
}

export async function getBoardFull(boardId: string) {
  const supabase = await createClient();

  const [{ data: board }, { data: groups }, { data: items }, { data: profiles }] =
    await Promise.all([
      supabase.from("boards").select("*, workspaces(id, name)").eq("id", boardId).single(),
      supabase.from("groups").select("*").eq("board_id", boardId).order("position"),
      supabase.from("items").select("*").eq("board_id", boardId).order("position"),
      supabase.from("profiles").select("*").order("full_name"),
    ]);

  return {
    board,
    groups: groups ?? [],
    items: items ?? [],
    profiles: profiles ?? [],
  };
}
