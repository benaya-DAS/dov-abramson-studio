-- ============================================================================
-- Optional sample data matching the studio's real structure.
-- Safe to run once after schema.sql. Re-running will create duplicates
-- (there's no natural unique key on names), so guard with the NOT EXISTS
-- checks below if you re-run this file.
-- ============================================================================

do $$
declare
  v_ws_design uuid;
  v_ws_anim uuid;
  v_ws_mgmt uuid;
  v_ws_office uuid;
  v_board_avichai uuid;
  v_board_masa uuid;
  v_board_zion uuid;
  v_group_morning uuid;
  v_group_general uuid;
begin
  if exists (select 1 from public.workspaces) then
    raise notice 'Workspaces already seeded, skipping.';
    return;
  end if;

  insert into public.workspaces (name, position) values ('מחלקת דיזיין - הסלון', 0) returning id into v_ws_design;
  insert into public.workspaces (name, position) values ('מחלקת אנימציה - גוזמא', 1) returning id into v_ws_anim;
  insert into public.workspaces (name, position) values ('הנהלת הסטודיו', 2) returning id into v_ws_mgmt;
  insert into public.workspaces (name, position) values ('משרד הסטודיו והפקה', 3) returning id into v_ws_office;

  insert into public.boards (workspace_id, name, month, year, position)
  values (v_ws_design, 'בית אבי חי - ספטמבר 2026', 9, 2026, 0)
  returning id into v_board_avichai;

  insert into public.groups (board_id, name, color, position) values (v_board_avichai, 'סדר בוקר', '#fdab3d', 0) returning id into v_group_morning;
  insert into public.groups (board_id, name, color, position) values (v_board_avichai, 'כללי', '#579bfc', 1) returning id into v_group_general;

  insert into public.boards (workspace_id, name, month, year, position)
  values (v_ws_anim, 'מסע ישראלי - ספטמבר 2026', 9, 2026, 0)
  returning id into v_board_masa;
  insert into public.groups (board_id, name, color, position) values (v_board_masa, 'כללי', '#579bfc', 0);

  insert into public.boards (workspace_id, name, month, year, position)
  values (v_ws_mgmt, 'קהילת ציון - ספטמבר 2026', 9, 2026, 0)
  returning id into v_board_zion;
  insert into public.groups (board_id, name, color, position) values (v_board_zion, 'כללי', '#579bfc', 0);

  insert into public.boards (workspace_id, name, position) values (v_ws_office, 'משימות משרד', 0);

  insert into public.project_catalog (serial_id, title, raw_text) values
    ('2590543', 'Pilgrims episode 1', '2590543 - Pilgrims episode 1'),
    ('2590544', 'Pilgrims episode 2', '2590544 - Pilgrims episode 2')
  on conflict (serial_id) do nothing;

  insert into public.items (board_id, group_id, name, deliverable, status, serial_id, start_date, due_date, hours, position)
  values
    (v_board_avichai, v_group_morning, 'Pilgrims episode 1', 'דימוי ובאנרים', 'working', '2590543', current_date, current_date + 5, 4, 0),
    (v_board_avichai, v_group_general, 'מודעת עיתון - ראש השנה', 'מודעות עיתונים', 'not_started', null, current_date + 1, current_date + 8, 2, 0);
end $$;
