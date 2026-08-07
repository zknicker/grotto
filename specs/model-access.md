---
summary: Runtime-owned model provider credentials — Claude sign-in (code-paste OAuth), Kimi Code sign-in (device-code OAuth), API keys, refresh, and the capability contract.
read_when:
  - changing model provider authentication, credential storage, or refresh
  - adding a provider connect flow to Model access
  - changing Claude/Codex/Kimi sign-in behavior or the claudeAuth capability
---

# Model Access

Model provider credentials are **Runtime-owned**. They live in the runtime
vault (`tavern_vault_secrets`), never in OS keychains or engine-side stores —
a headless Runtime cannot answer keychain prompts, and engine credential
stores do not survive upgrades. The app configures access through Model
access in Settings; agents never see raw credentials in prompts or tools.

## Claude Code and Anthropic

Two providers, one per credential — the same split as Codex (sign-in)
versus OpenAI (API key). Both execute through the Claude Code harness and
expose the same curated Claude models under their own provider ids.

- **Claude Code (`claude`) — sign-in.** Stored under `model-access:claude`.
  The runtime executes a code-paste PKCE OAuth flow against the public
  Claude Code client: `start` returns an authorize URL
  (`claude.ai/oauth/authorize`, `code=true`), the user approves in any
  browser and pastes the displayed `code#state` back, and the runtime
  exchanges it at `platform.claude.com/v1/oauth/token`. Code-paste is
  deliberate: the approving browser can be anywhere, so the flow works for
  remote Runtimes (a Mac mini reached over Tailscale) exactly like local
  ones. Uses the account's Claude subscription.
- **Anthropic (`anthropic`) — API key.** Stored under
  `model-access:anthropic` (`ANTHROPIC_API_KEY` option in Model access).
  Pay-per-token API billing.

## Kimi Code

**Kimi Code (`kimi`) — sign-in.** Stored under `model-access:kimi`. The
runtime executes the standard OAuth device-code flow against the public
Kimi Code client at `auth.kimi.com`: `start` requests a device
authorization and returns the user code + verification URL, the user
approves at kimi.com in any browser, and the runtime polls the token
endpoint until approval. Device-code fits remote Runtimes the same way
Claude's code-paste does. Uses the account's Kimi Code subscription; the
metered Moonshot platform API is deliberately not a Grotto provider.

Turns execute through the pi harness: the runtime refreshes the access
token within five minutes of expiry (rotated refresh tokens written back),
then registers pi's `kimi-coding` provider per turn with the token as the
bearer plus Grotto-owned model definitions
(`models/provider-sources/kimi.ts`, mirrored from pi's upstream registry —
our pinned pi predates K3; the definitions ride a patched
`KIMI_CODING_MODELS_JSON` custom-env extension). The curated catalog is
`kimi/k3`, `kimi/kimi-for-coding`, and `kimi/kimi-k2-thinking`. Auth turn
failures name the fix: "Kimi Code is not connected. Connect Kimi in
Settings → Connections → Model access."

Thinking on K3 is binary — upstream pi exposes only its `max` level
(earendil-works/pi#6737), delivered as Anthropic adaptive thinking with
`effort: max` and no token budgets. The executor clamps accordingly: any
requested thinking level engages max (Grotto `max`/`xhigh` → pi `xhigh` →
K3 `max`; intermediates clamp up rather than leaking unsupported efforts),
and `off` stays off. Other Kimi models keep pi's generic effort ladder.

### Detected host Claude Code login

The `claude` provider also rides a **detected host Claude Code login**:
when the machine's operator is already signed in to Claude Code — keychain
item on macOS, `~/.claude/.credentials.json` elsewhere — the provider reads
`live` ("Using your Claude Code login.") with zero setup and the engine
discovers that credential itself. Detection verifies the credential is
actually readable (an unreadable keychain item counts as not signed in);
the value stays in-process and is never logged.
`TAVERN_AGENT_CLAUDE_CODE_HOST_LOGIN=0` disables detection. Runtime-owned
sign-in always wins when both exist.

**Why host login works on a desktop but not a server.** macOS keychain
items carry an ACL naming which binaries may read them. A read from an
unlisted binary triggers a user-consent prompt — fine in a GUI session,
where the prompt appears and gets approved. A headless Runtime (launchd
service on a Mac mini, SSH session) has no screen to show the prompt on,
so the same read silently returns nothing. Upgrades make this worse: the
Runtime re-stages its bundled engine, changing the binary identity the ACL
was granted to, and with no GUI to re-approve, reads fail permanently
(this was the v1.5.0 mini outage). So:

- **Desktop Mac** — host login just works; Connect is optional.
- **Headless / deployed host** — use Connect (runtime-owned sign-in) or an
  Anthropic API key. The vault does not care about keychain ACLs or binary
  identity, so it survives upgrades and headless sessions.

Turn-time contract: before every `claude`-provider turn the runtime
refreshes the access token when it is within five minutes of expiry
(refresh grant, rotated refresh tokens written back). Each turn injects
its provider's credential into the Claude Code harness (`authToken` for
`claude`, `apiKey` for `anthropic`). The engine's own credential discovery
(keychain, `~/.claude`) is never relied on. Environment overrides
(`TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN`, `ANTHROPIC_AUTH_TOKEN`, base URL
variants) remain operator-level escape hatches and lose to stored
credentials.

Provider catalog: both providers' access states are credential-driven —
`needs-auth` until connected, regardless of CLI presence on the host. The
`claudeAuth` capability tracks sign-in only (healthy with account metadata
when connected, unauthorized with a connect pointer otherwise). Turn
failures caused by auth name the fix: "Claude is not connected. Connect
Claude in Settings → Connections → Model access." for sign-in, the
API-key equivalent for `anthropic` — never CLI instructions.

## Codex, OpenAI, OpenRouter

Codex OAuth credentials are vault-backed with runtime refresh (see
`codex-oauth-refresh`); OpenAI and OpenRouter are API-key providers. New
providers follow the same rule: the runtime owns the credential, Model
access owns the setup UX, a capability owns the health story.
