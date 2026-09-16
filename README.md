# סטודיו דב אברמסון — מערכת ניהול פרויקטים

Full-featured, RTL-native studio management app for Dov Abramson Studio — a
Monday.com-style tool built with **Next.js 16 (App Router)**, **Tailwind
CSS**, **Lucide Icons**, and **Supabase** (Postgres + Auth + Realtime).

## Supabase project

`.env.local` (gitignored — not committed) is configured for project
`fyiostdopgrivjgmzhxw`. Its anon key is a well-formed JWT (`role: anon`, and
the `ref` claim matches the project URL), but that only confirms it's
correctly *shaped* — it can't confirm it's still valid against your actual
project (a rotated or revoked key would fail at request time). If sign-in or
data loading fails, re-copy the key from **Supabase Dashboard → Project
Settings → API → Project API keys → `anon` `public`** and confirm the URL
matches the same project.

## Tech stack

- **Next.js 16** (App Router, Server Components, Route Handlers, Middleware)
- **TypeScript**, **Tailwind CSS**, **Lucide Icons**
- **Supabase**: Postgres, Row Level Security, Auth (Google OAuth), Realtime
- **xlsx** (SheetJS) for Excel catalog import/export — runs client-side
- **date-fns** for Gantt/Calendar date math, with Hebrew locale

## 1. Project setup

```bash
npm install
cp .env.local.example .env.local   # then fill in your real Supabase values
npm run dev
```

The app opens at `http://localhost:3000` and redirects to `/login`.

## 2. Supabase project setup

### 2.1 Run the schema

In the Supabase SQL editor (or via `supabase db push` with the CLI), run,
in order:

1. `supabase/schema.sql` — tables, RLS policies, triggers, and functions.
2. `supabase/seed.sql` *(optional)* — sample workspaces/boards matching the
   studio's real structure ("מחלקת דיזיין - הסלון", "בית אבי חי", etc.) plus
   two sample catalog rows.

The schema is safe to re-run (`create or replace`, `if not exists`) except
for `seed.sql`, which no-ops once any workspace exists.

### 2.2 Enable Google OAuth

**Authentication → Providers → Google** in the Supabase dashboard:

1. Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (OAuth client type: **Web application**).
2. Add the Supabase callback URL shown in the dashboard
   (`https://<project-ref>.supabase.co/auth/v1/callback`) as an **Authorized
   redirect URI**.
3. Paste the Google **Client ID** and **Client secret** into Supabase and
   enable the provider.
4. In **Authentication → URL Configuration**, set the **Site URL** to your
   deployed app URL (or `http://localhost:3000` for local dev) and add it to
   **Redirect URLs** together with `<site-url>/auth/callback`.

### 2.3 Lock sign-up to the studio's domain (critical security step)

Domain restriction is enforced in **three independent layers**, so a
misconfiguration in any single one never opens the app to outside accounts:

| Layer | Where | What it does |
|---|---|---|
| 1. UX hint | `src/app/login/page.tsx` | Passes `hd=studiodov.com` to Google's OAuth screen so only Workspace accounts on that domain appear in the picker. Cosmetic only — bypassable by URL editing. |
| 2. Database trigger (authoritative) | `supabase/schema.sql` → `enforce_studio_domain()` | A `BEFORE INSERT` trigger on `auth.users` that raises an exception (aborting sign-up) for any email outside `public.allowed_domains`. This runs inside Postgres and cannot be bypassed from the client. |
| 3. Middleware re-check | `src/lib/supabase/middleware.ts` | On every request, re-validates the signed-in user's email against `is_allowed_email()` and force-signs-out + redirects to `/auth/auth-error` only when that check explicitly returns `false` (defense in depth for pre-existing sessions after a domain-list change). A technical failure calling the RPC itself (not a rejection) is logged and does not sign the user out — layer 2 remains the authoritative gate either way. |

To change or add allowed domains later, update the `public.allowed_domains`
table directly in the Supabase SQL editor — no redeploy needed, but note this
is a **live data change**, not something a code push applies on its own:

```sql
insert into public.allowed_domains (domain) values ('anotherdomain.com');
-- and to fully replace the studio's domain rather than add to it:
delete from public.allowed_domains where domain <> 'anotherdomain.com';
```

(`supabase/schema.sql`'s own `insert ... on conflict do nothing` seed only
ever runs against a brand-new project — re-running the file will not remove
or rename a domain that's already stored, so a domain rename always needs
this manual step against every environment that already has the schema
applied.)

**Optional extra layer** — Supabase's native "Before User Created" Auth
Hook gives a nicer error message *before* Supabase even attempts the insert.
To wire it up: **Authentication → Hooks → Before User Created**, point it at
a Postgres function, e.g.:

```sql
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_allowed_email(event->'claims'->>'email') then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Sign-up is restricted to studio Google accounts.'
      )
    );
  end if;
  return jsonb_build_object();
end;
$$;
```

This is additive — the trigger from layer 2 still protects you even if you
skip this step.

### 2.4 Row Level Security

RLS is enabled on every table. The policy model:

- Any row in `public.profiles` (i.e. any signed-in studio member — and only
  a studio member can ever get a profile row, per §2.3) can read and
  collaborate on all workspaces/boards/groups/items/time logs. This mirrors
  a small internal studio team where everyone needs full visibility.
- **Archived boards are enforced read-only at the database level**: the
  `groups`/`items` write policies check `boards.is_archived = false` via a
  subquery, so even a direct API/SQL call cannot mutate an archived board's
  content — not just the UI.
- `time_logs` writes are further scoped to `user_id = auth.uid()` — you can
  only start/stop your own timer.
- `profiles` rows are only ever written by the `handle_auth_user_upsert()`
  trigger (from the Google account's name/avatar/email) — no client-side
  insert/delete policy exists for it, so a user cannot impersonate another
  profile.

**No `workspace_members` table** — every studio member sees every
workspace/board, gated by the `is_studio_member()` helper every policy
above calls. That helper checks for a `public.profiles` row *or*, as a
fallback, re-derives membership straight from the JWT's own email via
`is_allowed_email()`. The fallback matters because rows visible in the
Supabase Table Editor bypass RLS entirely (it runs as the service role) —
if a signed-in user's `profiles` row is ever missing (e.g. it predates the
`handle_auth_user_upsert()` trigger), every RLS-gated `select`, workspaces
included, would otherwise silently return zero rows with no error, which
looks from the app exactly like "there's no data" even though the tables
plainly aren't empty. `schema.sql` also backfills any `auth.users` row
missing a `profiles` row every time it's run, so re-running it repairs
this if it ever happens.

## 3. Application structure

```
supabase/
  schema.sql        # tables, RLS, triggers, rollover_board_month() function
  seed.sql           # optional sample data
middleware.ts         # session refresh + domain re-check on every request
src/
  app/
    login/                       # Google sign-in screen
    auth/callback/               # OAuth code exchange (route handler)
    auth/auth-error/             # domain-rejected / error screen
    onboarding/                  # empty-state screen (no workspaces yet)
    (app)/layout.tsx             # authenticated shell: Sidebar + TopBar
    (app)/board/[boardId]/       # main board (table/gantt/calendar views)
    (app)/archive/               # archived boards gallery (read-only)
  components/
    sidebar/     # workspace tree, board nav, "+ לוח חדש"
    topbar/      # user menu, avatar
    board/       # BoardWorkspace (state owner), BoardTable, BoardGantt,
                 # BoardCalendar, ItemRow, StatusBadge, PersonPicker,
                 # TimeTracker, CatalogImporter, NewMonthButton, ExportButton
  lib/
    supabase/    # browser + server clients, middleware helper, DB types
    catalog/parse.ts   # Excel column parsing + serial-prefix cleaning
    data.ts            # server-side data-fetching helpers
    constants.ts, utils.ts
```

### Key feature notes

- **Excel catalog import** (`CatalogImporter.tsx` + `lib/catalog/parse.ts`):
  parses column A ("הגדרת אירוע") and B ("מס\"ד") from the uploaded
  workbook client-side (SheetJS), strips a redundant leading
  `"<serial> - "` prefix from the title, and upserts into
  `project_catalog`. Entering a `מס"ד` on any item blurs into a catalog
  lookup that auto-fills the item name (and vice versa, when the typed name
  exactly matches a catalog title).
- **"חודש חדש" rollover**: calls the `rollover_board_month(p_board_id)`
  Postgres function (`supabase/schema.sql`), which archives the current
  board (`is_archived = true`, now read-only via RLS), then creates a new
  board in the same workspace for the following month with the same groups
  but zero items/time logs. Board name month/year suffix is auto-incremented
  in Hebrew (e.g. "ספטמבר 2026" → "אוקטובר 2026").
- **Time tracking**: `time_logs` rows with `started_at`/`ended_at`; a
  partial unique index guarantees one active (unstopped) timer per user at a
  time. The UI ticks live client-side and calls `stop_time_log()` to close
  the session.
- **Realtime**: `BoardWorkspace` subscribes to Postgres changes on `items`,
  `groups`, and `time_logs` scoped to the open board, so edits from other
  studio members appear live without a refresh.
- **Views**: Table (grouped, collapsible, per-group SUM footer for hours +
  tracked time), Gantt (CSS-grid day timeline colored by status), Calendar
  (month grid keyed by due date, falls back to start date).

## 4. Deployment

### Vercel (recommended)

1. Push this repo to GitHub.
2. Import it in Vercel, framework preset **Next.js**.
3. Add the environment variables from `.env.local` (with your **real**
   Supabase URL/anon key) in **Project Settings → Environment Variables**.
4. In Supabase, add your production URL to **Authentication → URL
   Configuration → Redirect URLs** (`https://your-app.vercel.app/auth/callback`).
5. Deploy.

### Security checklist before going live

- [ ] Replaced the placeholder anon key with the real one.
- [ ] Confirmed `public.allowed_domains` only contains the studio's real
      domain(s).
- [ ] Verified Google OAuth redirect URIs match your production URL exactly.
- [ ] Ran `supabase/schema.sql` against the production project and confirmed
      RLS is **enabled** (Table Editor shows a lock icon) on every table.
- [ ] Tried signing in with a non-studio Google account and confirmed it is
      rejected with the "הגישה נדחתה" screen.
- [ ] `.env.local` is not committed (already covered by `.gitignore`).

### Known accepted risk: `xlsx` (SheetJS)

`npm audit` flags the `xlsx` package (prototype pollution / ReDoS
advisories with no upstream npm fix at the time of writing). It is used
**only client-side**, to parse a file the signed-in studio user picks from
their own machine (`CatalogImporter.tsx`) and to generate the export
(`ExportButton.tsx`) — it never runs on a server or touches
attacker-controlled input over the network, which substantially limits the
blast radius. If this matters for your compliance posture, either install
the patched build from SheetJS's own CDN (`https://cdn.sheetjs.com`, see
their [advisory](https://cdn.sheetjs.com/advisories)) instead of the npm
registry version, or swap in `exceljs` and adapt `lib/catalog/parse.ts`'s
callers accordingly.

## 5. Local development scripts

```bash
npm run dev         # start dev server
npm run build        # production build
npm run start        # run the production build
npm run lint          # next lint
npm run typecheck     # tsc --noEmit
```
