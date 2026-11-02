#!/usr/bin/env bash
# Turns the GDRIVE_TOKEN secret into rclone's token config. `rclone
# authorize` prints either the token JSON itself or - when it's given a
# config blob, as the command in docs/backups.md is - a base64 blob that
# wraps it ({"token": "<token JSON>", ...}). Accepts both.
set -euo pipefail
if [ -z "${GDRIVE_TOKEN:-}" ]; then
  exit 0
fi

token=$(python3 - <<'PY'
import base64, json, os, re
raw = os.environ["GDRIVE_TOKEN"].strip()
if raw.startswith("{"):
    print(raw)
else:
    blob = re.sub(r"\s+", "", raw)
    print(json.loads(base64.b64decode(blob + "=" * (-len(blob) % 4)))["token"])
PY
)

echo "::add-mask::$token"
echo "RCLONE_CONFIG_GDRIVE_TOKEN=$token" >> "$GITHUB_ENV"
