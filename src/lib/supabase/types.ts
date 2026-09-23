// Hand-written types mirroring supabase/schema.sql.
// If the schema changes, update this file (or generate it with
// `supabase gen types typescript` and replace this file wholesale).

export type ItemStatus = "not_started" | "working" | "stuck" | "done";

// NOTE: these row types are declared with `type`, not `interface`, on
// purpose. TypeScript only treats plain object-literal `type` aliases as
// structurally compatible with `Record<string, unknown>` (the shape
// supabase-js's generated `Database` types require for `Row`/`Insert`/
// `Update`); `interface` declarations are not, and silently collapse the
// whole typed client to `never` if used here.

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
  created_at: string;
};

export type Board = {
  id: string;
  workspace_id: string;
  name: string;
  month: number | null;
  year: number | null;
  is_archived: boolean;
  archived_at: string | null;
  source_board_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  is_collapsed: boolean;
  is_archived: boolean;
  created_at: string;
};

export type Item = {
  id: string;
  board_id: string;
  group_id: string;
  name: string;
  person_ids: string[];
  deliverable: string | null;
  status: ItemStatus;
  status_label: string | null;
  serial_id: string | null;
  start_date: string | null;
  due_date: string | null;
  hours: number;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectCatalogEntry = {
  id: string;
  serial_id: string;
  title: string;
  raw_text: string | null;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeLog = {
  id: string;
  item_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  created_at: string;
};

// A currently-running (end_time null) session, as surfaced to the UI —
// enough to identify it, attribute it, and live-tick its elapsed time.
export type ActiveTimeLog = Pick<TimeLog, "id" | "user_id" | "start_time">;

export type ActivityEntityType = "item" | "group";
export type ActivityActionType = "insert" | "update" | "delete";

export type ActivityLog = {
  id: string;
  board_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action_type: ActivityActionType;
  // Full row snapshot from the trigger (to_jsonb(OLD)/to_jsonb(NEW)) - keys
  // match the entity's own column names, so this is intentionally loose
  // rather than typed as Item/Group (an update only ever changes a few
  // columns, but the snapshot always carries every column as it stood).
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  changed_by: string | null;
  undone_at: string | null;
  created_at: string;
};

type Relationships = never[];

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile>;
        Update: Partial<Profile>;
        Relationships: Relationships;
      };
      workspaces: {
        Row: Workspace;
        Insert: Partial<Workspace>;
        Update: Partial<Workspace>;
        Relationships: Relationships;
      };
      boards: {
        Row: Board;
        Insert: Partial<Board>;
        Update: Partial<Board>;
        Relationships: Relationships;
      };
      groups: {
        Row: Group;
        Insert: Partial<Group>;
        Update: Partial<Group>;
        Relationships: Relationships;
      };
      items: {
        Row: Item;
        Insert: Partial<Item>;
        Update: Partial<Item>;
        Relationships: Relationships;
      };
      project_catalog: {
        Row: ProjectCatalogEntry;
        Insert: Partial<ProjectCatalogEntry>;
        Update: Partial<ProjectCatalogEntry>;
        Relationships: Relationships;
      };
      time_logs: {
        Row: TimeLog;
        Insert: Partial<TimeLog>;
        Update: Partial<TimeLog>;
        Relationships: Relationships;
      };
      activity_logs: {
        Row: ActivityLog;
        Insert: Partial<ActivityLog>;
        Update: Partial<ActivityLog>;
        Relationships: Relationships;
      };
    };
    Views: {
      item_tracked_seconds: {
        Row: { item_id: string; tracked_seconds: number };
        Relationships: Relationships;
      };
    };
    Functions: {
      rollover_board_month: { Args: { p_board_id: string }; Returns: Board };
      // Returns null (not an error) when the UPDATE matches zero rows - e.g.
      // the session was already stopped elsewhere, or p_log_id/user_id no
      // longer line up - so callers must check for that explicitly.
      stop_time_log: { Args: { p_log_id: string }; Returns: TimeLog | null };
      undo_activity_log: { Args: { p_log_id: string }; Returns: undefined };
      is_allowed_email: { Args: { p_email: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
