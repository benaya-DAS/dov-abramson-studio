#!/usr/bin/env bash
# Decides which backup file db-restore.yml restores, given the candidate
# file names on stdin (one per line, from `rclone lsf`). Prints the path
# relative to db-backups: "dump/<file>" or "pre-restore/<file>".
#
#   BACKUP_FILE=<name>           that exact backup (from db-backups/dump)
#   BACKUP_FILE=pre-restore/<f>  that safety copy (undo a restore)
#   BACKUP_FILE=pre-restore/latest
#                                the newest safety copy (undo the last restore)
#   BACKUP_BEFORE/BACKUP_AFTER   (ISO times; BACKUP_FILE empty) the backup
#                                made by the run between those times - how
#                                the app picks one from its list
#   nothing set                  the newest backup
#
# File names carry their Israel-time minute (studio-backup_YYYY-MM-DD_HHMM),
# so they sort chronologically as plain strings.
set -euo pipefail

names=$(grep -v '^$' || true)
stamp() { TZ=Asia/Jerusalem date -d "@$1" +%Y-%m-%d_%H%M; }

case "${BACKUP_FILE:-}" in
  pre-restore/latest)
    pick=$(printf '%s\n' "$names" | grep '^pre-restore_.*\.dump$' | sort | tail -n 1 || true)
    [ -n "$pick" ] && echo "pre-restore/$pick"
    ;;
  pre-restore/*)
    echo "$BACKUP_FILE"
    ;;
  ?*)
    echo "dump/$(basename "$BACKUP_FILE")"
    ;;
  *)
    if [ -n "${BACKUP_BEFORE:-}" ]; then
      # The dump's name is stamped while its run is going, so it falls
      # between the run's start (a minute of slack for rounding) and end.
      lo="studio-backup_$(stamp $(($(date -d "${BACKUP_AFTER:-$BACKUP_BEFORE}" +%s) - 60))).dump"
      hi="studio-backup_$(stamp "$(date -d "$BACKUP_BEFORE" +%s)").dump"
      pick=$(printf '%s\n' "$names" | grep '^studio-backup_.*\.dump$' | sort |
        awk -v lo="$lo" -v hi="$hi" '$0 >= lo && $0 <= hi' | tail -n 1 || true)
    else
      pick=$(printf '%s\n' "$names" | grep '^studio-backup_.*\.dump$' | sort | tail -n 1 || true)
    fi
    [ -n "$pick" ] && echo "dump/$pick"
    ;;
esac
exit 0
