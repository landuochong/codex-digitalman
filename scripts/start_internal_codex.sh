#!/bin/bash
set -Eeuo pipefail

PROJECT_ROOT="/Users/Admin/whb/AI/codex-digitalman"
CODEX_APP="/Applications/ChatGPT.app"
INFO_PLIST="$CODEX_APP/Contents/Info.plist"
RUNTIME_DIR="$HOME/Library/Application Support/codex-digitalman"
ENTRY_PID_FILE="$RUNTIME_DIR/codex-entry.pid"
ENTRY_LOG="$RUNTIME_DIR/codex-entry.log"
ASR_PID_FILE="$RUNTIME_DIR/asr-gateway.pid"
ASR_LOG="$RUNTIME_DIR/asr-gateway.log"
ASR_START="/Users/Admin/whb/robot/WALL-E/tools/agent_voice_gateway/scripts/start_xiaozhi_sherpa.sh"
DEBUG_PORT="${CODEX_DIGITALMAN_CODEX_DEBUG_PORT:-9341}"
NODE="$(command -v node || true)"

fail(){ printf 'Codex Digitalman: %s\n' "$1" >&2; exit 1; }
[ -d "$CODEX_APP" ] || fail "未找到 $CODEX_APP"
[ -n "$NODE" ] || fail "未找到 node"
case "$DEBUG_PORT" in ''|*[!0-9]*) fail "调试端口必须是数字";; esac
[ "$DEBUG_PORT" -ge 1024 ] && [ "$DEBUG_PORT" -le 65535 ] || fail "调试端口必须在 1024–65535"

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
/usr/bin/grep -Fq "\"$VERSION\"" "$PROJECT_ROOT/packages/codex-entry/supported-versions.json" \
  || fail "Codex $VERSION 尚未加入测试允许列表"

if /usr/bin/pgrep -f '/Applications/ChatGPT.app/Contents/MacOS/ChatGPT' >/dev/null 2>&1; then
  fail "Codex 正在运行。请先完全退出 Codex，再重新执行本命令"
fi
if [ -f "$ENTRY_PID_FILE" ]; then
  OLD_PID="$(/bin/cat "$ENTRY_PID_FILE" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && /bin/kill -0 "$OLD_PID" 2>/dev/null; then
    fail "入口控制器仍在运行（PID $OLD_PID），请先执行 scripts/stop_internal_codex.sh"
  fi
  /bin/rm -f "$ENTRY_PID_FILE"
fi

/bin/mkdir -p "$RUNTIME_DIR"
/bin/chmod 700 "$RUNTIME_DIR"
: > "$ENTRY_LOG"
/bin/chmod 600 "$ENTRY_LOG"

if ! /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:8010/health" 2>/dev/null | /usr/bin/grep -q 'xiaozhi_sherpa'; then
  [ -x "$ASR_START" ] || fail "未找到本地 ASR 启动脚本：$ASR_START"
  : > "$ASR_LOG";/bin/chmod 600 "$ASR_LOG"
  ASR_WORKDIR="$(/usr/bin/dirname "$(/usr/bin/dirname "$ASR_START")")"
  (cd "$ASR_WORKDIR" && /usr/bin/nohup /usr/bin/env AGENT_VOICE_HOST=127.0.0.1 "$ASR_START" >> "$ASR_LOG" 2>&1 & printf '%s\n' $! > "$ASR_PID_FILE")
  ASR_READY="false"
  for _ in $(/usr/bin/seq 1 120); do
    if /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:8010/health" 2>/dev/null | /usr/bin/grep -q 'xiaozhi_sherpa'; then ASR_READY="true"; break; fi
    /bin/sleep 0.25
  done
  [ "$ASR_READY" = "true" ] || fail "本地 ASR 未在 30 秒内就绪，请查看 $ASR_LOG"
fi

printf '正在以专用 CDP 端口 %s 启动 Codex %s…\n' "$DEBUG_PORT" "$VERSION"
/usr/bin/open -na "$CODEX_APP" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$DEBUG_PORT"

READY="false"
for _ in $(/usr/bin/seq 1 120); do
  if /usr/bin/curl -fsS --max-time 1 "http://127.0.0.1:$DEBUG_PORT/json/list" 2>/dev/null \
    | /usr/bin/grep -q '"webSocketDebuggerUrl"'; then READY="true"; break; fi
  /bin/sleep 0.25
done
[ "$READY" = "true" ] || fail "Codex 未在 30 秒内开放可信 CDP 页面；请正常退出后重试"

cd "$PROJECT_ROOT"
/usr/bin/nohup /usr/bin/env \
  CODEX_DIGITALMAN_ENTRY_ENABLED=true \
  CODEX_DIGITALMAN_CODEX_VERSION="$VERSION" \
  CODEX_DIGITALMAN_CODEX_DEBUG_PORT="$DEBUG_PORT" \
  CODEX_DIGITALMAN_RUNTIME_DIR="$RUNTIME_DIR" \
  "$NODE" packages/codex-entry/src/cli.js >> "$ENTRY_LOG" 2>&1 &
ENTRY_PID=$!
printf '%s\n' "$ENTRY_PID" > "$ENTRY_PID_FILE"
/bin/chmod 600 "$ENTRY_PID_FILE"

ENABLED="false"
for _ in $(/usr/bin/seq 1 40); do
  if /usr/bin/grep -q '"enabled":true' "$ENTRY_LOG"; then ENABLED="true"; break; fi
  /bin/kill -0 "$ENTRY_PID" 2>/dev/null || break
  /bin/sleep 0.25
done
if [ "$ENABLED" != "true" ]; then
  /bin/kill "$ENTRY_PID" 2>/dev/null || true
  /bin/rm -f "$ENTRY_PID_FILE"
  /bin/cat "$ENTRY_LOG" >&2
  fail "入口控制器未成功启用"
fi

printf '准备完成：Codex 内部数字人入口与本地语音识别已启用。\n'
printf '测试后运行：%s/scripts/stop_internal_codex.sh\n' "$PROJECT_ROOT"
