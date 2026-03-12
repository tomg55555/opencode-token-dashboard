# OpenCode Token Dashboard Plugin

OpenCode plugin that adds a styled token analytics dashboard and a slash command.

## What you get

- `/token-usage` slash command
- `token_usage` tool (primary)
- `token_dashboard` tool (alias)
- Styled ASCII tables for:
  - overview totals
  - model usage breakdown
  - top sessions by token count

The plugin reads your local OpenCode databases:
- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/opencode-local.db`

## Quick start (local install)

1) Install dependencies in this plugin folder:

```bash
bun install
```

2) Add plugin path to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///Users/tommasogarzaro/Developer/opencode-token-dashboard/index.js"
  ]
}
```

3) Restart OpenCode.

4) In a session, run:

```text
/token-usage
```

5) Optional custom range and top sessions:

```text
/token-usage 30 10
```

## Usage examples

- Slash command:
  - `/token-usage`
  - `/token-usage 14 8`
- Tool call via prompt:
  - `Run token_usage with days=30 and topSessions=10`
  - `Run token_dashboard with days=7`

## Arguments

`token_usage` and `token_dashboard` support:

- `days` (number, default `7`, min `1`, max `365`)
- `topSessions` (number, default `5`, min `1`, max `20`)
- `includeMain` (boolean, default `true`)
- `includeLocal` (boolean, default `true`)

For slash usage, positional arguments map as:
- first arg -> `days`
- second arg -> `topSessions`

## Environment overrides

Use these if your DB files are in non-default locations:

- `OPENCODE_DB_PATH` (default `~/.local/share/opencode/opencode.db`)
- `OPENCODE_LOCAL_DB_PATH` (default `~/.local/share/opencode/opencode-local.db`)

Example:

```bash
OPENCODE_DB_PATH="/custom/path/opencode.db" opencode
```

## Troubleshooting

- Command not found:
  - Confirm plugin path in `~/.config/opencode/opencode.json`
  - Restart OpenCode after config changes
- Empty dashboard / missing sources:
  - Verify DB files exist in `~/.local/share/opencode/`
  - Check custom env paths if you override defaults
- Dependency errors:
  - Run `bun install` again in this plugin directory

## Share with colleagues now

- Share this repo URL (or zip)
- Teammates clone it locally
- Teammates add the `file://.../index.js` plugin path to their `opencode.json`
- Teammates run `bun install` in the plugin folder

## Publish later (npm)

1) Update `name` and `version` in `package.json`
2) Log in: `npm login`
3) Publish: `npm publish --access public`
4) Users install via plugin config:

```json
{
  "plugin": ["opencode-token-dashboard"]
}
```

---

For GitHub + SSH setup and first push, see `docs/GITHUB_SSH_SETUP.md`.
