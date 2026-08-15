---
summary: Usage surfaces for Agent token volume, Computer plan capacity, spend signals, and runtime health.
read_when:
  - changing Agent usage, plan capacity, spend, provider activity, or runtime health views
  - changing where operational usage appears in the App
---

# Usage

Usage turns Agent, runtime, and provider activity into contextual product views. It is not a
Settings destination: configuration stays in Settings, while operational usage appears beside the
Agent or Computer that owns its meaning.

## Product surfaces

* **Agents Overview.** The Members index shows 7-, 30-, or 90-day processed-token volume across
  all Grotto Agents. Agent KPI cards scope the chart and configuration grid. URL-backed Computer
  and runtime filters keep contextual drill-downs visible and removable.
* **Agent Overview.** Each Agent profile shows the same token view already scoped to that Agent,
  above runtime, model, and session configuration.
* **Computer detail.** Owners and Admins see equal-size capacity cards for detected Codex, Claude
  Code, Grok Build, and Pi runtimes. Supported runtimes that are absent sit in compact,
  low-contrast **Not Detected** Chips in the section header instead of occupying card-sized space.
  Pi is shown as the provider-agnostic, API-backed runtime rather than as an OpenRouter account; its
  **View usage** action opens Agents Overview scoped to that Computer and Pi. Computer-local token
  ledgers are not shown on this surface.

The atomic Grotto token reporting unit is Agent × runtime × model, with input, output, cache-read,
and cache-write counts. Computer-local Claude Code and Grok Build ledgers are runtime × model
because those runtime transcripts do not carry a Grotto Agent id.

## Hosted data flow

Each compatible Computer refreshes provider usage at most once every 15 minutes and stores the
sanitized snapshot atomically in its data root. Reconnects and restarts therefore reuse fresh data
without calling provider APIs. Refreshes are coalesced, retry schedules survive Computer restarts,
and transient request or authentication failures retain the affected provider's last successful
snapshot. The Computer reports only sources it can actually read. The Server stores the latest
timestamped snapshot for each Computer. Disconnecting a Computer changes freshness and health; it
does not erase its last report.

Codex usage uses the Computer's native Codex session. Claude Code plan usage comes primarily from
the structured usage data exposed by an already-running managed Claude Code SDK session. Computer
leases that collection once per 15-minute interval and persists the result; the App never polls
Anthropic. Before the first managed Claude turn, Computer may make one guarded OAuth usage request,
then applies durable exponential backoff on failure. On macOS, that fallback prefers Claude Code's
current Keychain session and rejects expired credential-file tokens. Grok Build plan usage uses its
local login and the same credits billing request as the official Grok Build client. Computer cards
use the provider's all-model weekly allowance as their shared primary metric. A compact header
indicator conditionally shows an enforced 5-hour window; model-specific windows stay out of this
comparative surface. Authentication and raw provider responses remain Computer-local.

Claude Code and Grok Build token totals follow ccusage's source rules: Claude assistant usage rows
under `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/**/*.jsonl`, including subagents and replay
deduplication; and completed Grok turns under `${GROK_HOME:-~/.grok}/sessions/**/updates.jsonl`,
expanded by model without counting reasoning twice. Computer scans only files modified inside the
30-day window, caches parsed rows by path, size, and modification time, and reuses the aggregate
while the file fingerprint and UTC day are unchanged. The one-minute report therefore checks file
metadata without repeatedly parsing or aggregating an unchanged ledger. Raw logs never leave the
Computer.

Computer also records normalized token counts from each completed Grotto Agent turn. The compact
turn summary carries the Agent, runtime, model, input, output, and cache counts to Server; prompts,
transcripts, and raw provider events remain Computer-local. Codex exposes session-cumulative
counters, so Computer stores a per-session baseline and reports only each turn's delta.

Server maintains a daily UTC rollup keyed by Server, date, Agent, runtime, and model. PostgreSQL
updates that cube transactionally when a compact turn summary is inserted, corrected, or deleted.
Usage reads therefore scan a bounded set of active configurations instead of every historical
turn. The per-turn summaries remain the audit and recovery source; Agent names and avatars stay
normalized and are joined when usage is read.

## Upstream methodology

The local-ledger adapters track [ccusage](https://github.com/ccusage/ccusage), specifically its
Claude transcript and Grok `turn_completed` accounting rules. Those reconstructed ledgers own token
volume, not authoritative subscription allowance. Claude allowance comes from Claude Code's
structured SDK usage response, with the OAuth usage endpoint retained only as a guarded bootstrap
fallback. Grok allowance follows the [official Grok Build billing
implementation](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/extensions/billing.rs).
