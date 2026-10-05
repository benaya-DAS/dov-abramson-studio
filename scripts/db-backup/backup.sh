#!/usr/bin/env bash
# Dumps the whole `public` schema (tables + data) to a pg_dump custom-format
# file and prints its path. Used by .github/workflows/db-backup.yml - see
# docs/backups.md.
#
#   SUPABASE_DB_URL=postgresql://... scripts/db-backup/backup.sh [out_dir] [prefix]
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set}"

out_dir=${1:-.}
prefix=${2:-studio-backup}
stamp=$(TZ=Asia/Jerusalem date +%Y-%m-%d_%H%M)
file="$out_dir/${prefix}_${stamp}.dump"

pg_dump "$SUPABASE_DB_URL" --format=custom --schema=public --file="$file"

# A dump that can't even be listed back is useless as a backup - fail loudly
# here rather than find out at restore time.
pg_restore --list "$file" > /dev/null

echo "$file"
