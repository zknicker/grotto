---
summary: Local-owner trust model for Grotto App, Runtime credentials, model-provider credentials, external clients, and secret storage.
read_when:
  - changing local app auth, runtime trust, secrets, or operator identity
  - exposing Grotto API access to external clients
---

# Auth

Grotto is a local-owner app. The owner controls the App process, Runtime host,
workspace files, and model-provider credentials.

Hosted Grotto servers do not use that model: they own their own Users,
memberships, and roles in PostgreSQL, and Clerk only authenticates the human.
See [Grotto Server](../internals/grotto-server.md). The rest of this page
describes the local-owner surfaces that still exist.

## Trust Boundaries

| Boundary | Trust |
| --- | --- |
| Electron shell and local Node app | One Grotto App product boundary |
| Grotto Computer management to Server | Revocable Computer login session with no Chat or execution authority |
| Grotto App to Grotto Runtime | Paired local transport with runtime credentials |
| Runtime to model providers | Provider-specific local OAuth or API-key credentials |
| External client to Grotto API | Explicit Grotto-issued credentials when exposed |
| Agent/tool access to Grotto data | Narrow tool/API capability, not raw database access |

## Secrets

Model provider credentials belong to their provider integration:

- Claude Code sign-in is a Runtime-owned OAuth credential created from
  Model access (code-paste flow) and stored in the runtime vault. When no
  sign-in exists, a detected host Claude Code login is used instead — this
  works on desktop Macs (a GUI session can grant keychain reads) but not on
  headless hosts, where keychain prompts cannot be answered; see
  [specs/model-access.md](../../specs/model-access.md).
  `TAVERN_AGENT_CLAUDE_CODE_AUTH_TOKEN` (`claude setup-token`) remains an
  operator env escape hatch.
- Codex uses vault-backed OAuth credentials refreshed by the Runtime.
- Anthropic, OpenAI, and OpenRouter API-key routes use Runtime-stored
  provider secrets or explicit environment overrides such as
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `TAVERN_AGENT_API_KEY`.
- MCP connection credentials live in the Runtime vault. Runtime uses them only
  at the upstream MCP boundary; they never enter agent prompts, tool arguments,
  or audit records.

Do not put secrets in:

- Chat messages
- response activity metadata
- e2e scripts
- checked-in config
- checked-in env files

Telemetry-only credentials belong to the feature that reads telemetry. For
example, OpenRouter account activity uses a management key stored as Stats
source settings, not as an inference credential.

## Runtime Access

The Runtime HTTP and event websocket APIs accept either the configured Grotto
Runtime token or a verified Clerk session. The Runtime generates its token on
first start and keeps it in its host config file (`<runtime-root>/grotto.json`,
`token` key, mode `0600`). Override with `TAVERN_RUNTIME_TOKEN`. The health route
is unauthenticated.

The agent CLI surface uses a separate per-agent bearer credential. Runtime
stores one `grta_` token file per agent under
`<runtime-root>/agent-tokens/<agentId>` with mode `0600` and rotates it on an
agent session reset. An agent token authorizes only `/api/agent/*`. Runtime
tokens and Clerk sessions do not authorize that surface, and agent tokens do
not authorize operator, chat, admin, or event surfaces.

When the Runtime host is remote, run `grotto token` on the host to display the
pairing token, then save that token in the App settings.

Owners may pair with the Runtime token. Invited members connect with the Runtime
URL only: Grotto App forwards their current Clerk session without persisting the
session token in the connection record. The app refreshes the server's ephemeral
session transport while signed in; reconnecting HTTP clients and event sockets
use the newest session.

Runtime-token and owner sessions have full Runtime access. Member sessions may
use the Grotto `/api/*` chat surface and read app-facing identity, capabilities,
events, agents, models, and Mac app inventory. Runtime administration remains
owner-only, including model access, agent environment, MCP connections,
Browser settings, updates, development routes, and timezone settings.
Verified non-members remain limited
to identity introspection and invite redemption.

Clients use Grotto API or TypeScript SDK surfaces instead of reading local
SQLite files, runtime stores, or executor state directly.

## Identity And Sign-In

Normative model: [specs/identity.md](../../specs/identity.md). Summary of the
implemented surface:

- Grotto App requires Clerk sign-in when `VITE_CLERK_PUBLISHABLE_KEY` is set
  (dev: `apps/website/.env.local`, pulled with `clerk env pull`). Keyless
  builds run a signed-out dev mode with no gate; e2e forces keyless. If
  clerk-js cannot load (offline), the app renders local data on the cached
  identity instead of locking the user out. The Electron shell loads the same
  hosted App but uses Clerk's native header authentication, keeps the encrypted
  client token in Electron storage, and completes Google sign-in in the system
  browser. Packaged builds return through the `grotto://sso-callback` protocol;
  development uses a process-owned loopback callback because unbundled Electron
  apps share a generic macOS protocol-handler identity. Electron removes the
  hosted renderer's automatic `Origin` header only from Clerk requests explicitly
  marked as native, because Clerk accepts either native `Authorization` or a
  browser `Origin`, never both. The shell permits only the configured hosted App
  origin to read those native Clerk responses; it does not disable Chromium web
  security or widen CORS for other traffic.
- Dev builds automatically sign in as the configured dev user when
  `CLERK_SECRET_KEY` and `DEV_CLERK_SIGN_IN_USER_ID` are set in the
  machine-local root `.env`. The dev stack forwards those values to the Server,
  which mints a short-lived Clerk ticket only for localhost App requests. E2e
  remains keyless and does not use this flow.
- The app attaches the Clerk session token to server requests
  (`Authorization: Bearer`, websocket `connectionParams.clerkSessionToken`);
  the server exposes it as `ctx.clerkSessionToken`.
- The Runtime verifies forwarded Clerk tokens against the instance JWKS when
  `TAVERN_CLERK_PUBLISHABLE_KEY` (or `clerkPublishableKey` in `grotto.json`)
  is set. Verified users are minted `identity_users` rows keyed by tavern
  user id; the first verified user to connect claims an unclaimed runtime as
  `owner`. Non-members can only introspect `/identity/me` and redeem
  invites. The `identity` capability reports this state.
- The runtime token remains the owner transport credential and bypasses
  membership. `CLERK_SECRET_KEY` is CLI/dev-only and must never ship in
  client code or version control.
- Production runs on the Clerk instance at `clerk.grotto.sh` (Google OAuth
  via the Grotto Clerk client in the technical `tavern-499717` Google Cloud
  project). The hosted App build carries the production publishable key; the
  desktop shell contains no separate React or Clerk build. Before release,
  both Clerk instances must whitelist the canonical
  `grotto://sso-callback` redirect.

## Computer Login Sessions

The human-operated Grotto Computer CLI uses one active, machine-local Computer login session per
Computer data root, bound to one Grotto origin. Its short-lived access token and rotating refresh
token authorize identity, Server/role discovery, Computer attachment and recovery, and Computer
lifecycle records.
They do not authorize Chats, Agent actions, Runtime execution, or provider access. The session is
stored atomically at `<computer-data-root>/login.json` with directory mode `0700` and file mode
`0600`; Server attachment credentials remain independent and continue to authenticate runners
without the human session.

Clerk authenticates the User in the browser but does not implement Grotto's device grant. Grotto
Server owns the short human-readable code, complete and manual verification URLs, expiry, polling,
one-time exchange, refresh rotation, and revocation. Phase one exposes this as
`grotto-computer login`, `POST /computer/login`, `POST /computer/login/poll`,
`POST /computer/login/complete`, and the public
`computer.login.status` plus Clerk-authenticated `computer.login.approve` and
`computer.login.deny` procedures. The code alone grants nothing: a signed-in User must approve it
explicitly, and the returned session is bound to the origin the CLI contacted. After atomically
storing the returned session, the CLI proves persistence with its access token; the browser does
not report completion before that acknowledgement. The existing
one-off `computer/setup` approval remains available for compatibility while attachment migration
lands in later phases. Account switching stays in the Clerk-backed browser flow. Logout, refresh
rotation, and attachment migration are subsequent contracts; phase one does not expose them.
