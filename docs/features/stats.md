---
summary: Stats feature for model/provider usage, spend signals, runtime health, and slow, failed, or expensive work clues.
read_when:
  - changing usage, spend, provider activity, or runtime health views
  - changing operational stats surfaced to users
---

# Stats

Stats turn runtime and provider activity into something users can scan.

## In the box

* **Connected sources.** Show stats only for providers that are connected
  and have a Grotto-supported stats source.
* **Usage.** Show Codex limits and OpenRouter account activity when those
  providers are connected.
* **Spend.** Surface cost signals where providers expose them. OpenRouter spend
  requires an account management key because the inference API key is not enough
  to read account activity.
* **Runtime health.** Show whether the agent runtime is connected and working.
* **Operational clues.** Help users understand slow, failed, or expensive work.

## Hosted data flow

Each compatible Computer reads its local provider usage once after attaching
and every minute while connected. It reports only sources it can actually read.
The Server stores the latest timestamped snapshot for each Computer and serves
all of them to every Server member. Disconnecting a Computer changes its
freshness and health; it does not erase the last reported Stats.

Codex usage uses the Computer's native Codex session. Configure OpenRouter
account activity by piping its management key to
`grotto-computer configure-openrouter`. Grotto Computer stores the key in a
mode-`0600` local file; the key and provider request never pass through the
Server or an Agent process.
