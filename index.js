import { tool } from "@opencode-ai/plugin"
import { Database } from "bun:sqlite"
import Table from "cli-table3"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

const DEFAULT_MAIN_DB = "~/.local/share/opencode/opencode.db"
const DEFAULT_LOCAL_DB = "~/.local/share/opencode/opencode-local.db"
const DAY_MS = 24 * 60 * 60 * 1000
const COMMAND_NAME = "token-usage"

const numberFormat = new Intl.NumberFormat("en-US")
const z = tool.schema

const ASCII_BORDER = {
  top: "-",
  "top-mid": "+",
  "top-left": "+",
  "top-right": "+",
  bottom: "-",
  "bottom-mid": "+",
  "bottom-left": "+",
  "bottom-right": "+",
  left: "|",
  "left-mid": "+",
  mid: "-",
  "mid-mid": "+",
  right: "|",
  "right-mid": "+",
  middle: "|",
}

function resolveHome(input) {
  if (!input) return input
  if (input === "~") return homedir()
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2))
  return input
}

function normalizePath(input) {
  return path.resolve(resolveHome(input))
}

function toNumber(value) {
  if (value === null || value === undefined) return 0
  const asNumber = Number(value)
  return Number.isFinite(asNumber) ? asNumber : 0
}

function formatNumber(value) {
  return numberFormat.format(Math.round(value))
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

function formatTime(ms) {
  if (!ms) return "n/a"
  return new Date(ms).toISOString().replace("T", " ").replace("Z", " UTC")
}

function truncateText(input, max) {
  const text = String(input ?? "")
  if (text.length <= max) return text
  if (max <= 3) return text.slice(0, max)
  return `${text.slice(0, max - 3)}...`
}

function openDatabase(filePath) {
  if (!filePath || !existsSync(filePath)) return null
  try {
    return new Database(filePath, { readonly: true })
  } catch {
    return null
  }
}

function querySummary(db, sinceMs) {
  const stmt = db.prepare(`
    SELECT
      min(time_created) AS start_time,
      max(time_created) AS end_time,
      count(*) AS assistant_messages,
      count(distinct session_id) AS sessions,
      sum(json_extract(data, '$.tokens.total')) AS total_tokens,
      sum(json_extract(data, '$.tokens.input')) AS input_tokens,
      sum(json_extract(data, '$.tokens.output')) AS output_tokens,
      sum(json_extract(data, '$.tokens.reasoning')) AS reasoning_tokens,
      sum(json_extract(data, '$.tokens.cache.read')) AS cache_read_tokens,
      sum(json_extract(data, '$.tokens.cache.write')) AS cache_write_tokens
    FROM message
    WHERE time_created >= ?
      AND json_extract(data, '$.tokens.total') IS NOT NULL
  `)
  return stmt.get(sinceMs)
}

function queryModels(db, sinceMs) {
  const stmt = db.prepare(`
    SELECT
      json_extract(data, '$.providerID') AS provider,
      json_extract(data, '$.modelID') AS model,
      count(*) AS assistant_messages,
      sum(json_extract(data, '$.tokens.total')) AS total_tokens,
      sum(json_extract(data, '$.tokens.input')) AS input_tokens,
      sum(json_extract(data, '$.tokens.output')) AS output_tokens,
      sum(json_extract(data, '$.tokens.reasoning')) AS reasoning_tokens,
      sum(json_extract(data, '$.tokens.cache.read')) AS cache_read_tokens,
      sum(json_extract(data, '$.tokens.cache.write')) AS cache_write_tokens
    FROM message
    WHERE time_created >= ?
      AND json_extract(data, '$.tokens.total') IS NOT NULL
    GROUP BY provider, model
  `)
  return stmt.all(sinceMs)
}

function querySessions(db, sinceMs) {
  const stmt = db.prepare(`
    SELECT
      m.session_id AS session_id,
      s.title AS title,
      s.directory AS directory,
      count(*) AS assistant_messages,
      sum(json_extract(m.data, '$.tokens.total')) AS total_tokens
    FROM message m
    JOIN session s ON s.id = m.session_id
    WHERE m.time_created >= ?
      AND json_extract(m.data, '$.tokens.total') IS NOT NULL
    GROUP BY m.session_id
  `)
  return stmt.all(sinceMs)
}

function querySessionIds(db, sinceMs) {
  const stmt = db.prepare(`
    SELECT DISTINCT session_id AS session_id
    FROM message
    WHERE time_created >= ?
      AND json_extract(data, '$.tokens.total') IS NOT NULL
  `)
  return stmt.all(sinceMs)
}

function createTable(options) {
  return new Table({
    ...options,
    chars: ASCII_BORDER,
    style: { head: [], border: [] },
  })
}

function buildOverviewTable(totals, sessionCount, avgTokensPerMessage, cacheReadPercent) {
  const table = createTable({ head: ["Metric", "Value"] })
  table.push(["Total tokens", formatNumber(totals.totalTokens)])
  table.push(["Input tokens", formatNumber(totals.inputTokens)])
  table.push(["Output tokens", formatNumber(totals.outputTokens)])
  table.push(["Reasoning tokens", formatNumber(totals.reasoningTokens)])
  table.push(["Cache read", `${formatNumber(totals.cacheReadTokens)} (${cacheReadPercent})`])
  table.push(["Cache write", formatNumber(totals.cacheWriteTokens)])
  table.push(["Sessions", formatNumber(sessionCount)])
  table.push(["Assistant messages", formatNumber(totals.assistantMessages)])
  table.push(["Avg tokens/message", formatNumber(avgTokensPerMessage)])
  return table.toString()
}

function buildModelTable(modelRows) {
  const table = createTable({
    head: [
      "Provider",
      "Model",
      "Messages",
      "Total",
      "Input",
      "Output",
      "Reasoning",
      "Cache read",
    ],
    colAligns: ["left", "left", "right", "right", "right", "right", "right", "right"],
  })

  for (const row of modelRows) {
    table.push([
      truncateText(row.provider, 14),
      truncateText(row.model, 26),
      formatNumber(row.assistantMessages),
      formatNumber(row.totalTokens),
      formatNumber(row.inputTokens),
      formatNumber(row.outputTokens),
      formatNumber(row.reasoningTokens),
      formatNumber(row.cacheReadTokens),
    ])
  }

  return table.toString()
}

function buildSessionTable(topSessions) {
  const table = createTable({
    head: ["Source", "Title", "Directory", "Messages", "Total"],
    colAligns: ["left", "left", "left", "right", "right"],
  })

  for (const row of topSessions) {
    table.push([
      row.source,
      truncateText(row.title, 32),
      truncateText(row.directory, 42),
      formatNumber(row.assistantMessages),
      formatNumber(row.totalTokens),
    ])
  }

  return table.toString()
}

function ensureCommand(config) {
  if (!config || typeof config !== "object") return
  config.command ??= {}
  if (config.command[COMMAND_NAME]) return
  config.command[COMMAND_NAME] = {
    description: "Show token usage dashboard",
    template:
      "Run the token_usage tool and respond with the tool output only. If arguments are provided, interpret them as: days=$1, topSessions=$2. Arguments: $ARGUMENTS",
  }
}

async function renderTokenUsage(args) {
  const sinceMs = Date.now() - args.days * DAY_MS
  const mainPath = normalizePath(process.env.OPENCODE_DB_PATH || DEFAULT_MAIN_DB)
  const localPath = normalizePath(process.env.OPENCODE_LOCAL_DB_PATH || DEFAULT_LOCAL_DB)

  const candidates = [
    { id: "main", path: mainPath, enabled: args.includeMain },
    { id: "local", path: localPath, enabled: args.includeLocal },
  ]

  const sources = []
  const missing = []

  for (const candidate of candidates) {
    if (!candidate.enabled) continue
    const db = openDatabase(candidate.path)
    if (!db) {
      missing.push(`${candidate.id}: ${candidate.path}`)
      continue
    }
    sources.push({ ...candidate, db })
  }

  if (!sources.length) {
    const hint = missing.length ? `\nMissing: ${missing.join(", ")}` : ""
    return `No OpenCode databases available for the last ${args.days} days.${hint}`
  }

  const totals = {
    startMs: null,
    endMs: null,
    assistantMessages: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }

  const sessionIds = new Set()
  const modelMap = new Map()
  const sessionRows = []

  try {
    for (const source of sources) {
      const summary = querySummary(source.db, sinceMs)
      if (summary?.start_time) {
        totals.startMs = totals.startMs === null ? summary.start_time : Math.min(totals.startMs, summary.start_time)
      }
      if (summary?.end_time) {
        totals.endMs = totals.endMs === null ? summary.end_time : Math.max(totals.endMs, summary.end_time)
      }

      totals.assistantMessages += toNumber(summary?.assistant_messages)
      totals.totalTokens += toNumber(summary?.total_tokens)
      totals.inputTokens += toNumber(summary?.input_tokens)
      totals.outputTokens += toNumber(summary?.output_tokens)
      totals.reasoningTokens += toNumber(summary?.reasoning_tokens)
      totals.cacheReadTokens += toNumber(summary?.cache_read_tokens)
      totals.cacheWriteTokens += toNumber(summary?.cache_write_tokens)

      for (const row of querySessionIds(source.db, sinceMs)) {
        if (row?.session_id) sessionIds.add(`${source.id}:${row.session_id}`)
      }

      for (const row of queryModels(source.db, sinceMs)) {
        const provider = row.provider || "unknown"
        const model = row.model || "unknown"
        const key = `${provider}:${model}`
        const current = modelMap.get(key) || {
          provider,
          model,
          assistantMessages: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        }

        current.assistantMessages += toNumber(row.assistant_messages)
        current.totalTokens += toNumber(row.total_tokens)
        current.inputTokens += toNumber(row.input_tokens)
        current.outputTokens += toNumber(row.output_tokens)
        current.reasoningTokens += toNumber(row.reasoning_tokens)
        current.cacheReadTokens += toNumber(row.cache_read_tokens)
        current.cacheWriteTokens += toNumber(row.cache_write_tokens)

        modelMap.set(key, current)
      }

      for (const row of querySessions(source.db, sinceMs)) {
        sessionRows.push({
          source: source.id,
          title: row.title || "(untitled)",
          directory: row.directory || "(unknown)",
          assistantMessages: toNumber(row.assistant_messages),
          totalTokens: toNumber(row.total_tokens),
        })
      }
    }
  } finally {
    for (const source of sources) {
      source.db.close()
    }
  }

  if (totals.assistantMessages === 0) {
    const hint = missing.length ? `\nMissing: ${missing.join(", ")}` : ""
    return `No token data found in the last ${args.days} days.${hint}`
  }

  const cacheReadPercent = totals.totalTokens
    ? formatPercent((totals.cacheReadTokens / totals.totalTokens) * 100)
    : "0.0%"

  const avgTokensPerMessage = totals.assistantMessages
    ? Math.round(totals.totalTokens / totals.assistantMessages)
    : 0

  const sourceSummary = sources.map((source) => `${source.id} (${source.path})`).join(", ")
  const missingSummary = missing.length ? `Missing: ${missing.join(", ")}` : null

  const modelRows = Array.from(modelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens)
  const topSessions = sessionRows.sort((a, b) => b.totalTokens - a.totalTokens).slice(0, args.topSessions)

  const sections = []
  sections.push(`TOKEN USAGE (last ${args.days} days)`)
  sections.push(`Window: ${formatTime(totals.startMs)} -> ${formatTime(totals.endMs)}`)
  sections.push(`Sources: ${sourceSummary}`)
  if (missingSummary) sections.push(missingSummary)

  sections.push("")
  sections.push("OVERVIEW")
  sections.push(buildOverviewTable(totals, sessionIds.size, avgTokensPerMessage, cacheReadPercent))

  sections.push("")
  sections.push("MODEL USAGE")
  sections.push(buildModelTable(modelRows))

  sections.push("")
  sections.push(`TOP SESSIONS (top ${args.topSessions})`)
  sections.push(buildSessionTable(topSessions))

  return sections.join("\n")
}

export const TokenDashboardPlugin = async () => {
  return {
    config: async (config) => {
      ensureCommand(config)
    },
    tool: {
      token_usage: tool({
        description: "Show token usage dashboard (styled table).",
        args: {
          days: z.number().int().min(1).max(365).default(7),
          topSessions: z.number().int().min(1).max(20).default(5),
          includeMain: z.boolean().default(true),
          includeLocal: z.boolean().default(true),
        },
        async execute(args) {
          return renderTokenUsage(args)
        },
      }),
      token_dashboard: tool({
        description: "Alias for token_usage.",
        args: {
          days: z.number().int().min(1).max(365).default(7),
          topSessions: z.number().int().min(1).max(20).default(5),
          includeMain: z.boolean().default(true),
          includeLocal: z.boolean().default(true),
        },
        async execute(args) {
          return renderTokenUsage(args)
        },
      }),
    },
  }
}

export default TokenDashboardPlugin
