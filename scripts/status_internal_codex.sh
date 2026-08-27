#!/bin/bash
set -Eeuo pipefail
RUNTIME_DIR="$HOME/Library/Application Support/codex-digitalman"
PID_FILE="$RUNTIME_DIR/codex-entry.pid"
LOG_FILE="$RUNTIME_DIR/codex-entry.log"
ASR_PID_FILE="$RUNTIME_DIR/asr-gateway.pid"
if /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:8010/health" 2>/dev/null | /usr/bin/grep -q 'xiaozhi_sherpa'; then printf '本地语音识别：就绪\n'; else printf '本地语音识别：未就绪\n'; fi
if [ ! -f "$PID_FILE" ]; then printf '入口控制器：未运行\n'; exit 1; fi
PID="$(/bin/cat "$PID_FILE")"
if /bin/kill -0 "$PID" 2>/dev/null; then
  printf '入口控制器：运行中（PID %s）\n' "$PID"
  /usr/bin/tail -n 5 "$LOG_FILE" 2>/dev/null || true
else
  printf '入口控制器：已停止（残留 PID %s）\n' "$PID"
  exit 1
fi
