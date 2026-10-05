#!/usr/bin/env bash
# Replaces ALL data in the `public` schema with the data from a backup made
# by backup.sh. Table structure is left as-is (it comes from
# supabase/schema.sql), only rows are replaced. Runs in a single transaction:
# any error rolls everything back and the database is left untouched.
# Used by .github/workflows/db-restore.yml - see docs/backups.md.
#
#   SUPABASE_DB_URL=postgresql://... scripts/db-backup/restore.sh <file.dump>
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set}"
dump=${1:?usage: restore.sh <file.dump>}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

pg_restore --data-only --no-owner --file="$work/data.sql" "$dump"

cat > "$work/restore.sql" <<SQL
\set ON_ERROR_STOP on
begin;
-- Skips triggers (log_activity etc.) and FK checks while reloading, so
-- restored rows aren't re-logged as new activity and tables can be loaded
-- in any order.
set local session_replication_role = replica;
do \$\$
declare
  tables text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ')
    into tables
    from pg_tables
   where schemaname = 'public';
  if tables is not null then
    execute 'truncate table ' || tables;
  end if;
end
\$\$;
\i $work/data.sql
commit;
SQL

psql "$SUPABASE_DB_URL" --no-psqlrc --quiet --file="$work/restore.sql" > /dev/null
echo "Restored from $(basename "$dump")"
