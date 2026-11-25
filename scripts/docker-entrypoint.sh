#!/usr/bin/env bash
set -Eeuo pipefail

media_dir="${CLIPFLOW_MEDIA_DIR:-/data/media}"
if [[ "$media_dir" != /* ]]; then
  echo "CLIPFLOW_MEDIA_DIR must be an absolute path in the container." >&2
  exit 1
fi

mkdir -p "$media_dir"
chown -R node:node "$media_dir"

exec gosu node "$@"
