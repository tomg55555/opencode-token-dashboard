# OpenCode Token Dashboard

[![npm version](https://img.shields.io/npm/v/opencode-token-dashboard)](https://www.npmjs.com/package/opencode-token-dashboard)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

`opencode-token-dashboard` is an OpenCode plugin that adds a token analytics dashboard with clear ASCII tables and a ready-to-use slash command.

## Features

- `/token-usage` slash command
- `token_usage` tool (primary)
- `token_dashboard` tool (alias)
- Aggregated analytics across one or both OpenCode databases
- Styled ASCII output for overview, model usage, and top sessions

## Installation (npm recommended)

1. Install the package:

```bash
npm install opencode-token-dashboard
```

2. Add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-token-dashboard"]
}
```

3. Restart OpenCode.

4. Run:

```text
/token-usage
```

## Local development install

Use this path when developing or testing from source.

1. Install dependencies in this repository:

```bash
bun install
```

2. Reference the local plugin entrypoint in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///<Full-Plugin-Path>/opencode-token-dashboard/index.ts"]
}
```

3. Restart OpenCode, then run `/token-usage`.

## Usage

Slash command examples:

```text
/token-usage
/token-usage 14 8
/token-usage 30 10
```

Tool examples (via prompt):

- `Run token_usage with days=30 and topSessions=10`
- `Run token_dashboard with days=7`

## Arguments

`token_usage` and `token_dashboard` support:

| Argument | Type | Default | Range |
| --- | --- | --- | --- |
| `days` | number | `7` | `1..365` |
| `topSessions` | number | `5` | `1..20` |
| `includeMain` | boolean | `true` | `true/false` |
| `includeLocal` | boolean | `true` | `true/false` |

For slash command usage:

- first positional argument -> `days`
- second positional argument -> `topSessions`

## Data sources

By default, the plugin reads:

- `~/.local/share/opencode/opencode.db`
- `~/.local/share/opencode/opencode-local.db`

## Environment overrides

Use environment variables when databases are in non-default locations:

- `OPENCODE_DB_PATH`
- `OPENCODE_LOCAL_DB_PATH`

Example:

```bash
OPENCODE_DB_PATH="/custom/path/opencode.db" opencode
```

## Troubleshooting

- Command not found:
  - verify plugin entry in `~/.config/opencode/opencode.json`
  - restart OpenCode after config changes
- Empty dashboard or missing source data:
  - confirm database files exist
  - confirm custom environment variable paths
- Dependency issues:
  - local install: run `bun install` again in this repository
  - npm install: reinstall plugin and restart OpenCode

## Maintainer release notes

```bash
npm whoami
npm publish --access public
```

If `npm whoami` fails, run `npm login` first.

## License

MIT
