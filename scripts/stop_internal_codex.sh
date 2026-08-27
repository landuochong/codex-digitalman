#!/bin/bash
set -Eeuo pipefail
RUNTIME_DIR="$HOME/Library/Application Support/codex-digitalman"
PID_FILE="$RUNTIME_DIR/codex-entry.pid"
ASR_PID_FILE="$RUNTIME_DIR/asr-gateway.pid"
if [ -f "$PID_FILE" ]; then
  PID="$(/bin/cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$PID" ] && /bin/kill -0 "$PID" 2>/dev/null; then
    COMMAND="$(/bin/ps -p "$PID" -o command= 2>/dev/null || true)"
    case "$COMMAND" in *codex-entry/src/cli.js*) /bin/kill -TERM "$PID";; *) printf '拒绝停止身份不匹配的 PID %s\n' "$PID" >&2; exit 1;; esac
  fi
  /bin/rm -f "$PID_FILE"
fi
if [ -f "$ASR_PID_FILE" ]; then
  ASR_PID="$(/bin/cat "$ASR_PID_FILE" 2>/dev/null || true)"
  if [ -n "$ASR_PID" ] && /bin/kill -0 "$ASR_PID" 2>/dev/null; then
    ASR_COMMAND="$(/bin/ps -p "$ASR_PID" -o command= 2>/dev/null || true)"
    case "$ASR_COMMAND" in *agent_voice_gateway.app:app*) /bin/kill -TERM "$ASR_PID";; *) printf '拒绝停止身份不匹配的 ASR PID %s\n' "$ASR_PID" >&2; exit 1;; esac
  fi
  /bin/rm -f "$ASR_PID_FILE"
fi
printf '入口控制器已停止。请完全退出 Codex，再从 Dock 正常打开以关闭 CDP。\n'
