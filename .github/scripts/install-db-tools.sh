#!/usr/bin/env bash
# Installs rclone and a Postgres client matching the server's major version
# (pg_dump refuses to dump a server newer than itself).
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL secret is not set}"

sudo apt-get update -qq
sudo apt-get install -y -qq postgresql-common postgresql-client rclone > /dev/null

major=$(psql "$SUPABASE_DB_URL" -tAc "select current_setting('server_version_num')::int / 10000")
echo "Server is Postgres $major"

sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y > /dev/null
sudo apt-get install -y -qq "postgresql-client-$major" > /dev/null

# Put the matching client first on PATH for all later steps.
echo "/usr/lib/postgresql/$major/bin" >> "$GITHUB_PATH"
