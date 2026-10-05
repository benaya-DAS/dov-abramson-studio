# CLAUDE.md

Guidance for Claude Code sessions working in this repo. For project setup,
Supabase provisioning, and deployment, see `README.md` instead — this file
is about how to work *in* the codebase day to day, not how to stand it up.

## What this is

Monday.com-style studio management app for **Dov Abramson Studio** (סטודיו
דוב אברמסון) — Next.js (App Router) + Supabase (Postgres/Auth/Storage/
Realtime) + Tailwind. **RTL Hebrew throughout** — all UI text is Hebrew, the
whole app renders under `dir="rtl"`. Sign-in is Google OAuth restricted to
the studio's email domain (enforced both client-side and in a Postgres
trigger — see `enforce_studio_domain` in `supabase/schema.sql`).

## Git workflow (always, unless the user explicitly says otherwise)

- Develop on the feature branch the session was given (check your own
  system prompt for the exact branch name).
- **Every push also goes directly to `main`** — this repo has no PR review
  step in normal use; `git push -u origin <branch>` followed by
  `git push origin <branch>:main`, every time, not just at the end of a
  larger task.
- Before pushing: `git status --short`, then `git fetch origin main
  <branch>` and confirm both `git log HEAD..origin/main --oneline` and
  `git log HEAD..origin/<branch> --oneline` are empty (nothing to lose by
  pushing). Stage specific files by name, never `git add -A`/`git add .`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
  (match whatever exact attribution lines your own system prompt gives you
  for this session — they can vary by model/session and take precedence
  over this file.)

## Before every commit

```bash
rm -rf .next && npx tsc --noEmit
npx eslint .
npm run build
```

All three must be clean. Don't skip the build just because tsc/eslint
passed — Next's own type-checking pass and static generation catch things
the other two don't.

## SQL changes (`supabase/schema.sql`) — read this before touching triggers

This file is hand-run by the user in the Supabase SQL editor; nothing here
auto-deploys. **Every turn that changes schema.sql must end by giving the
user the exact SQL block to paste and run** — say explicitly whether a SQL
step is needed, even when the answer is "no, this is a pure code change."

The schema is written to be fully idempotent (`create or replace`,
`create table if not exists`, `drop trigger if exists` + `create trigger`,
`on conflict do nothing`) — a changed section should stay safe to paste in
full and re-run, not require the user to diff out just the new part.

**Critical gotcha, hit once in production already**: `log_activity()` is a
single trigger function shared by both the `items` and `groups` triggers.
Postgres does **not** guarantee short-circuit evaluation of `and`/`or` — a
condition like `tg_table_name = 'groups' and old.color = ...` can still
raise `record "old" has no field "color"` when the trigger actually fired
for `items`, even though that leading guard is false, because PL/pgSQL
resolves field references when the statement is parsed/bound, not only when
that branch is reached. The fix is a genuine nested
`if tg_table_name = 'groups' then ... elsif tg_table_name = 'items' then
... end if` — a real branch structurally never evaluates the untaken
branch's statements, a combined boolean expression does not give you that
guarantee. Apply the same caution to any other trigger function shared
across tables with different columns.

For anything beyond a trivial column/policy addition — especially trigger
logic — this environment has Postgres 16 installed but stopped by default.
Spin it up and test against a real database before handing SQL to the user:

```bash
service postgresql start
sudo -u postgres createdb <scratch_db_name>
# recreate the minimal relevant schema + a stub auth.uid() function, then
# run actual INSERT/UPDATE/DELETE test cases via a .sql script
sudo -u postgres dropdb <scratch_db_name>   # when done
```

## Frontend conventions

- **Mobile vs. desktop**: two parallel CSS-only render branches in the same
  JSX, never JS viewport detection — `hidden md:flex` (hidden on mobile,
  shown at `md:` and up) or `flex md:hidden` (the reverse). Avoids
  hydration mismatches and keeps the two layouts' logic independent. See
  `Sidebar.tsx` / `MobileWorkspaceNav.tsx` for the canonical example of a
  feature that's genuinely different components per breakpoint, vs.
  `FilterBar.tsx` for one component whose own classes branch.
- **RTL table columns**: the first DOM child in a flex row renders
  rightmost under `dir="rtl"`. For a table's own "frozen start column" (the
  item name), that means `position: sticky; right: 0` is the correct edge
  — not `left: 0`.
- **Popovers/dropdowns**: use `FloatingPanel` (`src/components/ui/
  FloatingPanel.tsx`), not a native `<select>`/`<datalist>` or a plain
  absolutely-positioned div. It portals to `document.body` with
  `position: fixed`, so it isn't clipped by the table's own
  `overflow-x-auto` wrapper and isn't bound by a scrollable ancestor.
  `align="end"` aligns the panel's *right* edge to the anchor (the
  RTL-correct choice for most of this app, since start-of-row is the right
  edge); `align="start"` (the default) aligns the left edges instead — pick
  deliberately, don't assume the default is RTL-correct for a given spot.
- **Avatars**: always a fixed-size wrapper `span` with `overflow-hidden
  rounded-full`, with the image/initials filling it via `fill`/absolute
  positioning — not relying on the image element's own `aspect-square` or
  `border-radius`, which depend on the element's actual rendered box
  staying square and can still come out oval under a squeeze from an
  ancestor or a non-square parent (e.g. a button with asymmetric padding
  for adjacent text). See `Avatar()` in `UserMenu.tsx`.
- Draft-then-commit-on-blur is the standard pattern for inline-editable
  table cells (name, serial, deliverable, etc. in `ItemRow.tsx`): local
  `useState` draft, `onBlur` commits if changed, `Enter` blurs, `Escape`
  reverts-then-blurs via a `cancelingFieldRef` guard (blur fires
  synchronously before the revert's state update is visible, so the ref is
  what stops the blur handler from saving the stale pre-revert value).

## After every push

Tell the user explicitly, in Hebrew, whether anything needs to be run in
Supabase's SQL editor — with the full SQL text inline when yes, and an
explicit "no SQL needed this time" when the change is pure code.
