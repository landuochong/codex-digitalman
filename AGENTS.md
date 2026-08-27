# Repository Guidance

## Goal

Build a local-first Codex companion integration with a standard plugin, an independent digital-human window, and an optional Codex Desktop sidebar shortcut.

## Invariants

- Keep `/Users/Admin/whb/AI/digitalman/` unchanged unless a task explicitly includes it.
- Treat `packages/codex-entry` as an optional compatibility layer, not a stable plugin API.
- Keep the core workflow usable through the standard plugin without DOM injection.
- Read only explicitly requested or most-recent ended sessions; never summarize an active session silently.
- Keep session data local by default. Do not persist audio or video.
- Do not add Obsidian writes until a later task explicitly restores that scope.
- Do not declare `mcpServers` in the plugin manifest until a working `.mcp.json` and server command exist.

## Change discipline

- Update `docs/SESSION_CONTRACT.md` before changing public session or tool schemas.
- Update `docs/ARCHITECTURE.md` when component ownership or trust boundaries change.
- Add version guards and a kill switch to any Codex UI injection.
- Prefer loopback networking, explicit allow-lists, and short-lived capability tokens.
- Keep generated runtime data outside source directories and out of Git.

## Validation

Validate the plugin and Skill after changing their metadata:

```bash
python3 /Users/Admin/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-digitalman
python3 /Users/Admin/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/codex-digitalman/skills/companion-chat
```
