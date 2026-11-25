#!/usr/bin/env bash
set -Eeuo pipefail

npm run start -- -H 0.0.0.0 &
web_pid=$!
worker_pid=""

if [[ "${RUN_PUBLISHING_WORKER:-false}" == "true" ]]; then
  npm run worker:publish &
  worker_pid=$!
fi

shutdown() {
  local status=$?
  trap - EXIT TERM INT
  kill -TERM "$web_pid" ${worker_pid:+"$worker_pid"} 2>/dev/null || true
  wait "$web_pid" 2>/dev/null || true
  if [[ -n "$worker_pid" ]]; then
    wait "$worker_pid" 2>/dev/null || true
  fi
  exit "$status"
}

trap shutdown TERM INT

set +e
if [[ -n "$worker_pid" ]]; then
  wait -n "$web_pid" "$worker_pid"
  status=$?
else
  wait "$web_pid"
  status=$?
fi
set -e
exit "$status"
