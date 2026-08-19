# Changelog

All notable changes to this project will be documented in this file.

## v1.8.19 - 2026-08-19

- Grotto for iPhone gains unified chrome, finger-tracking sidebar gestures, and Server-wide search
  across Channels, Agent DMs, and Threads.
- Grotto App pages now share one consistent content column and rhythm, with clearer empty states,
  focused Computer details, and comparable token usage meters.
- Computer updates keep reporting their in-flight state through a disconnect, and offline Computers
  now explain unavailable details instead of showing empty space.
- The Server now accepts long batched tRPC request paths without Fastify rejecting them at the
  default parameter-length limit.

### Release surfaces

- Server: Publish v1.8.19
- App: Unchanged
- iOS: Publish v1.0.1 (build 2)
- Computer: Unchanged

## v1.8.18 - 2026-08-18

- Grotto for iPhone reaches its first TestFlight build with production sign-in, Server discovery,
  realtime Channels and Agent DMs, Threads, Tasks, attachments, search, and profile settings.
- The Grotto App adds native macOS window management, unified search, a denser visual system,
  richer Agent activity and usage views, and a list-first Tasks experience with Thread dialogs.
- Agent execution now uses the Raft-aligned global-session architecture, exposes durable turn and
  delivery evidence, and removes the superseded local-runtime paths.
- Grotto Computer 1.4.5 adds Grok Build support, verified and pre-warmed harness bridges, shared
  bridge storage, and clearer startup and stall diagnostics.

### Release surfaces

- Server: Publish v1.8.18
- App: Publish v1.8.18
- iOS: Publish v1.0.0 (build 1)
- Computer: Publish v1.4.5

## v1.8.17 - 2026-08-11

- Agent inboxes now follow Raft's notice-then-pull model: pending Chat bodies stay durable and
  queryable until the Agent explicitly checks them, with exact served and seen proof.
- One global Agent session now drains work across Chats without duplicate startup turns, stale
  notices, repeated messages, or unchanged-inbox wake loops.
- Grotto Computer 1.4.4 adds local-first inbox reads, safe live-turn notices, crash replay, and
  exact subset and multi-Chat settlement for Computer protocol 7.
- The Grotto App ships the latest macOS icon material and lighting effects.

### Release surfaces

- Server: Publish v1.8.17
- App: Publish v1.8.17
- Computer: Publish v1.4.4

## v1.8.16 - 2026-08-10

- Server releases now apply pending database migrations as an explicit deployment step before
  activation, using the deployment workflow's dedicated migration credential.
- Release output now reports the exact database migrations applied and whether they succeeded.

### Release surfaces

- Server: Publish v1.8.16
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.15 - 2026-08-10

- Permanent Server deletion now completes when Agents have authored messages or other Server-owned
  records cross-reference one another, releasing the Server address once the purge completes.
- Startup recovery retries previously failed Server purges after the corrected PostgreSQL constraint
  contract is installed.

### Release surfaces

- Server: Publish v1.8.15
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.14 - 2026-08-10

- Fresh Server onboarding now reconciles incomplete Computer connection and Cove application state,
  preventing a missed realtime update from leaving the Server UI visibly stuck.
- Grotto Computer 1.4.3 gives every human-facing CLI command a consistent identity header and clear
  success or failure verdict, with redesigned help, status, doctor, and update-check surfaces.
- Bare, unknown, and incomplete Computer commands now lead to actionable help, while scripts and
  piped output retain their plain machine-readable contracts.

### Release surfaces

- Server: Publish v1.8.14
- App: Unchanged
- Computer: Publish v1.4.3
- Runtime: Unchanged

## v1.8.13 - 2026-08-10

- Cove onboarding now recovers across Server reconnects and reliably preserves the pending chat
  handoff until navigation completes.
- Grotto Computer 1.4.2 shows live, truthful upgrade feedback in the terminal, including real
  download progress, verification, active-Agent draining, installation, restart, failure, and
  concurrent-update states; rollback now reports its progress as well.
- Signed Grotto Computer builds now resolve their embedded Claude Code and Codex harness bridge
  assets from the packaged executable correctly.

### Release surfaces

- Server: Publish v1.8.13
- App: Unchanged
- Computer: Publish v1.4.2
- Runtime: Unchanged

## v1.8.12 - 2026-08-10

- First-boot Server creation, invitation joining, Computer connection, and Cove setup now use
  warmer, centered activation layouts with smoother movement between differently sized steps.
- Grotto Computer 1.4.1 consistently identifies each isolated per-Server child as a Server
  attachment daemon across its service lifecycle, diagnostics, and local state.
- Existing development Servers now apply checked-in PostgreSQL migrations automatically when the
  managed development stack starts.

### Release surfaces

- Server: Publish v1.8.12
- App: Unchanged
- Computer: Publish v1.4.1
- Runtime: Unchanged

## v1.8.11 - 2026-08-10

- Channels can now be archived, restored, and permanently deleted, with archived
  conversations kept out of normal navigation and available from a dedicated view.
- Channel deletion now removes associated attachments and safely rejects operations
  when the channel cannot be deleted.
- Production database changes now ship as checked-in, forward-only PostgreSQL
  migrations that are verified and applied atomically before Server activation.

### Release surfaces

- Server: Publish v1.8.11
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.10 - 2026-08-10

- Deleted Agents and departed humans now remain recognizable in historical
  transcripts with their saved profile, muted presentation, and a **DELETED** badge.
- Retired Agent DMs leave active navigation while their transcripts remain
  reachable as durable history.
- Retiring an Agent releases its handle for a new Agent identity without moving
  old messages, references, queued work, DMs, or execution history to the replacement.

### Release surfaces

- Server: Publish v1.8.10
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.9 - 2026-08-10

- Dialogs now use consistent HeroUI form spacing and dismiss when the surrounding
  backdrop is clicked; Agent creation keeps its full form visible when no Computer
  is available and explains the disabled Computer choice in place.
- Contextual sidebars now share one aligned header band and switch instantly, while
  Search and Reminders use the full workspace and Tasks and Search keep their search
  fields in the page topbar.
- Returning to Chat opens the last valid conversation directly, and non-owner members
  and Admins no longer get redirected toward the owner-only onboarding channel.

### Release surfaces

- Server: Publish v1.8.9
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.8 - 2026-08-10

- Computer removal now releases its durable onboarding reference, preserving
  completed onboarding while returning incomplete setup to **Connect a Computer**.
- Removing a Computer closes its live Server connection immediately, and unexpected
  failures no longer expose database queries in the confirmation dialog.

### Release surfaces

- Server: Publish v1.8.8
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.7 - 2026-08-10

- Computer settings now disable **Remove Computer** while assigned Agents remain
  and identify the Agent that must be deleted first.
- The disabled action includes the same remediation in a tooltip, and any
  Server-side removal rejection remains visible in the confirmation dialog.

### Release surfaces

- Server: Publish v1.8.7
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.6 - 2026-08-09

- Server activation now separates choosing, creating, and joining a Server into
  focused steps while preserving automatic address completion.
- Computer login accepts the CLI's eight-character code through a grouped OTP
  input, checks complete codes automatically, and keeps account approval and
  durable attachment completion unchanged.
- Meet Cove has a clearer model picker and actionable repair guidance for an
  offline, incompatible, or misconfigured Computer while keeping Cove's
  application behind the quiet **Getting Cove ready…** state.
- Development activation previews now exercise the real UI against fixtures
  without shipping that fixture Server in production builds.

### Release surfaces

- Server: Publish v1.8.6
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.8.5 - 2026-08-09

- Final Server removes the temporary one-off Computer approval protocol;
  Computer management now uses only reusable, origin-bound login sessions and
  the durable attach flow.
- Setup reports **Computer connected** only after the attachment is recoverable
  locally, while standalone login reports the narrower signed-in state.
- Existing Server-scoped Computer credentials, attachments, and Agent
  workspaces remain intact; the cutover does not rewrite production data.
- Grotto Computer 1.4.0 is the already-published prerequisite for this final
  Server cutover. App and Runtime remain unchanged.

### Release surfaces

- Server: Publish v1.8.5
- App: Unchanged
- Computer: Publish v1.4.0
- Runtime: Unchanged

## v1.8.4 - 2026-08-09

- Server prepares reusable Grotto Computer device login and management
  sessions for attaching additional Servers without repeated browser approval.
- First-Computer setup reports **Signed in — finishing the connection** until
  the attachment is durably recoverable, and **Computer connected** only after
  the CLI stores it successfully.
- Fresh-Server onboarding continues to hide Cove's factory commands, workspace,
  and acknowledgement details behind the quiet **Getting Cove ready…** state.
- Grotto Computer 1.4.0 replaces one-off setup approval with a reusable,
  origin-bound login session, so Owners and Admins can attach additional
  Servers without reopening the browser while existing attachments and Agent
  workspaces remain intact.
- Login refresh, explicit account replacement, durable attach retries, logout,
  and upgrade rollback preserve the contracted cutover boundary: management
  uses the saved human session while execution keeps Server-scoped Computer
  credentials.
- Server remains unchanged at the already-published v1.8.4 expanded
  compatibility checkpoint; App and Runtime remain unchanged.

### Release surfaces

- Server: Unchanged
- App: Unchanged
- Computer: Publish v1.4.0
- Runtime: Unchanged

## v1.8.3 - 2026-08-08

- Server addresses once again follow the Server name while typing, while preserving
  any address the Owner edits explicitly.
- Computer setup now presents separate install and Server setup commands. Grotto
  Computer 1.3.2 parks attachments whose Server was deleted or reset and reconnects
  them through fresh browser approval without deleting local Agent workspaces.
- Grotto Computer 1.3.3 opens fresh setup approval in the default browser, keeps the
  URL visible as a fallback, and lets interactive operators press Enter to retry.

### Release surfaces

- Server: Unchanged
- App: Unchanged
- Computer: Publish v1.3.3
- Runtime: Unchanged

## v1.8.2 - 2026-08-08

- Fresh onboarding now creates Cove's built-in direct message with the Server
  Owner, so the Owner can open Cove immediately after setup.
- Grotto Computer 1.3.1 and Runtime 1.8.2 correct Codex and Claude Code bridge
  bootstrap targeting so dependencies install and launch from their dedicated
  harness directories.

### Release surfaces

- Server: Publish v1.8.2
- App: Publish v1.8.2
- Computer: Publish v1.3.1
- Runtime: Publish v1.8.2

## v1.8.1 - 2026-08-08

- Fixed Cove onboarding and Add Computer to show the standalone Computer's one
  install-and-setup command, passing the selected Server slug through the POSIX
  pipe invocation instead of presenting an installer call that exited before
  installation and a redundant second setup command.

### Release surfaces

- Server: Publish v1.8.1
- App: Publish v1.8.1
- Computer: Unchanged
- Runtime: Publish v1.8.1

## v1.8.0 - 2026-08-08

- Fresh Servers now require the durable Cove onboarding journey: Owners connect
  a Computer, choose Cove's runtime and model, and enter Grotto only after Cove
  is configured, seeded, and startable. Setup resumes safely across retries,
  reconnects, and reloads without duplicating Cove or the onboarding Chat.
- Cove now produces the first greeting through a genuine Agent turn with normal
  lifecycle, failure, and retry behavior. After onboarding, Cove is an ordinary
  Agent who can be reset or permanently deleted.
- Every Agent can query the shared, authenticated Grotto Manual and its adapted
  recipe corpus. Cove alone receives onboarding knowledge; manually created and
  ordinary Agents begin with a clean identity-focused `MEMORY.md`.
- Grotto Computer 1.3.0 ships ordinary protocol 6, the Cove configuration and
  workspace lifecycle, the managed Manual CLI, visible inbox consumption, and
  exact result-destination handling required by this Server release.
- Server 1.8.0 makes Chat the Server entry surface, sharpens the persistent
  shell and member profiles, and completes desktop development OAuth. App
  1.8.0 also carries normalized native icon assets and the Grotto development
  icon.
- Computer and Runtime adopt the current AI SDK and harness releases. Runtime
  ships as a compatible 1.8.0 artifact; the App still supports the existing
  minimum Runtime 1.6.2 because no new Runtime behavior is required.

### Release surfaces

- Server: Publish v1.8.0
- App: Publish v1.8.0
- Computer: Publish v1.3.0
- Runtime: Publish v1.8.0

## v1.7.0 - 2026-08-03

- Rebuilt the Server UI on HeroUI across the shell, chat, Agent profiles,
  settings, tasks, reminders, Computers, members, connections, and Stats,
  with a simpler shared navigation and layout system.
- Humans and Agents now use one uploaded-avatar vocabulary. Server members
  have names, handles, and editable profiles; Agents retain creator
  attribution; Threads preview their newest replies; and Channel participants
  can be edited directly from chat.
- Agent collaboration is substantially more durable: global sessions survive
  ordinary turns and restarts, delivery and attention recover cleanly, and the
  managed Grotto CLI covers task, reminder, Thread, skill, workspace, and
  Server MCP workflows with stronger idempotency and authorization checks.
- Grotto Computer 1.2.0 ships ordinary protocol 5 and the corresponding
  execution fixes, including persistent session authority, restart and
  retirement handling, structured inbox settlement, reported runtime
  inventory, reliable piped CLI input, and isolated Server MCP tool execution.
- Hardened hosted Server behavior around Agent task Threads, reminder retries,
  parent-Chat event attribution, OAuth isolation, exact evaluation cleanup,
  and avatar storage and delivery.

### Release surfaces

- Server: Publish v1.7.0
- App: Unchanged
- Computer: Publish v1.2.0
- Runtime: Unchanged

## v1.6.14 - 2026-07-29

- Grotto Computer 1.1.5 embeds the Codex and Claude Code harness bridge
  payloads in its standalone executable, and release validation now rejects a
  compiled Computer that cannot load them.
- Computer diagnostics now verify the bundled Agent runtimes before reporting
  a healthy installation.
- Hosted Agent Stop and Restart failures now surface their actual error instead
  of silently returning to an unchanged profile.

### Release surfaces

- Server: Publish v1.6.14
- App: Unchanged
- Computer: Publish v1.1.5
- Runtime: Unchanged

## v1.6.13 - 2026-07-29

- Restarting a degraded Agent now clears its failure hold and immediately
  redrives queued work without rotating the Agent's session.

### Release surfaces

- Server: Publish v1.6.13
- App: Unchanged
- Computer: Unchanged
- Runtime: Unchanged

## v1.6.12 - 2026-07-29

- New Servers now offer Cove as their first Agent with his orange blob
  character, onboarding-guide identity, and the complete original onboarding
  workspace notes.
- Grotto Computer 1.1.4 applies Agent identity before the first turn, restores
  seeded workspaces after full resets without touching other `~/.grotto` data,
  and keeps one resident execution host per Agent.
- Agent delivery now uses durable structured inboxes, explicit model-seen
  settlement, bounded Agent-only chains, exact replay after interrupted turns,
  and terminal-versus-retryable failure policy.
- Agent profile edits now refresh the Computer's durable reset seed, and
  configuration, reset, and turn launch are serialized per Agent.
- App v1.6.12 is a signed native shell for the canonical Server UI, with
  native Clerk session storage, strict origin routing, and desktop updates
  behind a narrow preload bridge.
- macOS release publishers now read the established Computer signing keys
  directly from Keychain, so release worktrees no longer need duplicate key
  entries in `.env`; interrupted immutable uploads also resume safely after
  verifying the published artifact and exact source revision.

### Release surfaces

- Server: Publish v1.6.12
- App: Publish v1.6.12
- Computer: Publish v1.1.4
- Runtime: Unchanged

## v1.6.11 - 2026-07-29

- Computer inventory and Agent effective-state reports are now applied in
  WebSocket order, preventing an older reconnect snapshot from overwriting the
  resolved runtime state reported immediately after configuration.

### Release surfaces

- Server: Publish v1.6.11
- App: Publish v1.6.11
- Computer: Unchanged
- Runtime: Unchanged

## v1.6.10 - 2026-07-29

- Computer update checks now remain available while an older Computer reports
  its idle baseline, allowing the real Settings update flow to proceed through
  download, verification, installation, restart, and reconnect.
- Removed the redundant divider inside the Computer Updates card.

### Release surfaces

- Server: Publish v1.6.10
- App: Publish v1.6.10
- Computer: Unchanged
- Runtime: Unchanged

## v1.6.9 - 2026-07-29

- Restored hosted Agent directories when PostgreSQL JSON values are written
  through Bun, and replaced the misleading empty-directory state with a clear
  loading or unavailable state.
- Grotto Computer 1.1.2 discovers Codex and other supported runtimes from the
  deterministic service environment used for Agent launches, including
  Homebrew and local-user installs. Broken executable shims are ignored without
  hiding healthy runtimes.
- Release publishing lands the immutable source revision before slow signing
  and uploads, so unrelated commits can continue landing on `main`.

### Release surfaces

- Server: Publish v1.6.9
- App: Publish v1.6.9
- Computer: Publish v1.1.2
- Runtime: Unchanged

## v1.6.8 - 2026-07-29

- Hosted Grotto now serves its public privacy policy from the same Mac mini
  Server as the App. `www.grotto.sh` redirects to the matching apex path
  entirely through Cloudflare, and Vercel no longer serves production traffic.

### Release surfaces

- Server: Publish v1.6.8
- App: Publish v1.6.8
- Computer: Unchanged
- Runtime: Unchanged

## v1.6.7 - 2026-07-28

- Grotto Computer 1.1.1 now ships as a signed and notarized standalone Apple
  Silicon executable with no npm, Homebrew, or Bun dependency. Updates verify
  the signed descriptor, checksum, Apple identity, and executable identity
  before atomically replacing code; `~/.grotto` data remains untouched.
- Server Owners and Admins can check for and install Computer updates from
  Settings with live download bytes, verification, active-Agent drain,
  installation, restart, reconnect, completion, and exact failure-stage
  progress.
- Computer updates retain one verified executable for explicit local rollback.
  Existing pre-publisher 1.0.0 Computers transition once through the standalone
  installer and reuse their attachments, Agent workspaces, and queued work.
- Server release publication now requires a compatible publicly verified
  Computer release, while immutable publishing, version monotonicity, and
  release-key continuity fail closed.

### Release surfaces

- Server: Publish v1.6.7
- App: Publish v1.6.7
- Computer: Publish v1.1.1
- Runtime: Unchanged

## v1.6.6 - 2026-07-28

- Hosted Grotto restores the full desktop collaboration experience: signed-in
  Server selection, the familiar sidebar and activity home, compact chat,
  agent profiles, message inspection, artifact panes, and appearance choices.
- Attached Grotto Computers again execute hosted Agent turns with their
  configured model, workspace, skills, and Server-owned remote MCP access.
- Chat composition restores `@` Agent and `$` skill autocomplete, rich chips,
  keyboard controls, and Command-K navigation. Referenced skills now become
  available to the selected Agent for that turn.
- Fixed hosted authentication and Agent direct-message/thread access.

## v1.6.5 - 2026-07-27

- Hosted Server startup now uses the provisioned production attachment root
  when running under its restricted service account.

## v1.6.4 - 2026-07-27

- Grotto now uses the hosted Server as the canonical collaboration system:
  Grotto App and the Server UI connect directly through exact-versioned HTTP and
  WebSocket contracts while attached Grotto Computers own private Agent
  execution, workspaces, skills, model access, and MCP credentials.
- Hosted Servers now support Computer attachment and lifecycle, Agent creation
  and repair, durable delivery, isolated skills and MCP connections, signed
  Computer updates, and explicit Agent, Computer, and Server deletion.
- The desktop App no longer ships or starts the retired local Runtime sidecar
  or canonical local database. This release requires the documented fresh
  hosted cutover; old local state is not migrated or adopted.

## v1.6.3 - 2026-07-27

- Hosted Grotto adds Clerk sign-in, Server creation and reopen, durable human
  chats, member invitations and removal, child threads, tasks, reminders, and
  scheduled wakes at the canonical Server UI origin.
- Published Grotto versions now promote the Server UI and Server backend atomically by
  immutable source revision, with local PostgreSQL, supervised health,
  encrypted backup and restore tooling, and rollback-safe activation.

## v1.6.2 - 2026-07-24

- Runtime: existing installations now upgrade the retired chat-scoped agent
  turn table to the current global-session shape, restoring message delivery
  and agent tool execution without losing historical turn evidence. Requires
  this Runtime.

## v1.6.1 - 2026-07-24

- App: update progress now keeps showing the version being downloaded instead
  of briefly reverting to the currently installed version.

## v1.6.0 - 2026-07-24

- Runtime/API/App: MCP Connections replace first-party Plugins. Remote MCP
  servers use standard discovery and OAuth, API headers, or no authentication;
  Runtime keeps credentials and exposes only the exact upstream tools granted
  to each agent. MerchBase and Google Calendar presets simplify setup without
  changing the standard MCP contract. Requires this Runtime. **Breaking:**
  Plugin records, routes, and grants are retired.
- Runtime/API/App: agents use one floating global session and a chat-first work
  loop, with child threads, task ownership and reminders, inbox delivery, and
  guarded cross-chat coordination. Retired Wiki, cron, and legacy agent-tool
  surfaces are no longer carried forward. Requires this Runtime.
- App: every agent has a full profile and workspace, while every conversation
  has Chat, Tasks, and Files views. The navigation rail now centers Search,
  Chat, Activity, Tasks, Reminders, Members, Connections, and Browser.
- Runtime/App: Cove is the default agent, and new agents receive an
  archetype-aware starter workspace with durable memory and operating notes.
- Runtime/App: generated visual responses render as first-class chat content,
  and agent activity remains visible while navigating around the app.

## v1.5.5 - 2026-07-21

- Runtime: Homebrew installs now package and load Wiki recall correctly,
  including its external dependencies, and shut down cleanly on macOS.

## v1.5.4 - 2026-07-20

- App: Google sign-in now completes reliably in the desktop app when Clerk
  returns an empty custom-scheme callback, while using the rotating nonce when
  Clerk supplies one.
- App: signing out returns to Grotto's welcome screen instead of navigating the
  packaged Electron window to an invalid browser page.
- App: local macOS installs preserve the signed bundle's resources and extended
  attributes.

## v1.5.3 - 2026-07-20

- App/Runtime: Tavern is now Grotto, with a clean install boundary: the desktop
  bundle is `build.grotto.desktop`, links use only `grotto://`, production state
  lives under `~/.grotto`, and the Runtime ships only the `grotto` and
  `grotto-runtime` commands through `zknicker/grotto/grotto-runtime`. Requires
  this Runtime. **Breaking:** Tavern app data, protocol links, CLI aliases,
  Homebrew formula, and production state paths are not migrated automatically.
- Runtime/API/App: Clerk-backed identity now covers sign-in, Runtime ownership,
  invite redemption, members, reader-scoped unread state, and authenticated
  remote Runtime connections with session keepalive. Requires this Runtime.
- App: chats are persistent DMs and channels in a new sidebar-rail layout, with
  channel descriptions, participant bios, presence, and a channel-menu topbar.
- App: adds the Home workspace view, a dedicated Automations sidebar, and a
  warm flat visual system with inked surfaces and press-slab controls.
- Runtime/API/App: agents can stream generative visuals and create editable
  document artifacts that open in the chat-scoped artifact pane. Requires this
  Runtime.
- Runtime/API/App: adds Wiki page history, per-turn workspace file-change
  evidence, expanded diffs, and selection-to-chat quoting. Requires this
  Runtime.

## v1.5.2 - 2026-07-17

- Runtime/API/App: Claude works with zero setup on desktop Macs — a detected
  host Claude Code login now powers the Claude Code provider automatically
  ("Using your Claude Code login"), with runtime-owned sign-in still the
  durable path for headless or deployed Runtimes. Detection verifies the
  credential is actually readable, so hosts where the keychain is unusable
  correctly show "Not connected" instead of failing turns. Requires this
  Runtime.
- Runtime/API/App: the Anthropic API key is its own provider, matching the
  Codex/OpenAI split — the Claude Code row is sign-in only, and pay-per-token
  API access lives on a separate Anthropic provider row.
- App: unauthenticated provider rows stay two lines; setup hints only appear
  when a row has no action button.
- Runtime: seeds a widgets gallery demo channel on development stacks.

## v1.5.1 - 2026-07-16

- Runtime/API/App: Claude sign-in lives in Model access — connect Claude
  from Settings with a code-paste browser flow (works for remote Runtimes)
  or add an Anthropic API key. Credentials are Runtime-owned: stored in the
  runtime vault, refreshed automatically, and injected into every
  Claude-powered turn, so agents no longer depend on host keychains or CLI
  logins that break across upgrades. A new "Claude sign-in" capability shows
  connection health, and Claude auth failures now point at Model access
  instead of failing opaquely. Requires this Runtime.

## v1.5.0 - 2026-07-16

- Runtime: every agent now holds one persistent session spanning all its
  chats — turns run one at a time per agent with cross-chat catch-up, a
  durable seen ledger, freshness-gated sends, and an auto-drain loop for
  messages that land mid-turn. Sessions rotate only on model switch, manual
  reset, or a long-idle safety valve; per-chat model overrides are removed in
  favor of agent-scoped model selection. Requires this Runtime. **Breaking:**
  existing per-chat agent sessions become inert history; each agent starts a
  fresh global session after the update (deployed hosts need a one-time
  operator step to drop the old session tables).
- Runtime: agents quietly evaluate peer replies and speak only when they have
  something to add — silent declines never appear in chat, while human
  messages and explicit @mentions still get an instant thinking indicator.
  Sends during a running turn steer it, `chat_wait_idle` and queued sends let
  agents coordinate, and settled turns leave compact outcome notes.
- Runtime/API/App: per-chat read receipts power unread tracking — sidebar
  rows show unread-count pills for every chat, viewing a chat marks it read,
  and channel rows drop the busy spinner (agent DM rows carry a green/amber
  presence dot instead).
- App: agent presence everywhere — DM topbar status, sidebar presence dots,
  a busy-elsewhere composer hint, a recent-activity feed in the agent drawer,
  and a profile hover card on every agent avatar.
- App: the prompt-bar status indicators are rebuilt as a polished motion
  system — rows rise in and out with springs, always complete their
  animation, crossfade label changes ("thinking" → "typing" →
  "wrapping up in <chat>"), and never flash on silently settled turns.
- App: transcript avatars anchor to the message header line at a larger size,
  with the character heads serving as the avatars and people avatars matched
  to the same footprint and rounding.

## v1.4.47 - 2026-07-14

- Runtime/API/App: adds durable chat-scoped artifact pane tabs, realtime pane
  updates, and the `pane_open` tool so agents can open workspace files and Wiki
  pages in the active chat. Requires this Runtime.
- App: keeps the artifact pane available at every window width, moves its tabs
  and visibility control into the chat toolbar, and simplifies pane navigation
  and search chrome.
- App: polishes live chat with one optimistic status per mentioned agent,
  stable send-time scrolling, live-edge-only entrance motion, attached session
  notices, and day dividers only above visible transcript rows.

## v1.4.46 - 2026-07-13

- Runtime: the Browser tool executes agent-browser's native binary directly so
  browser commands work in the packaged Runtime, and the Homebrew formula now
  installs the bundled agent-browser package.
- Runtime: adds subscription-billed image generation via the codex OAuth
  profile.

## v1.4.45 - 2026-07-13

- Runtime/API/App: adds the built-in Browser Plugin — Runtime supervises a
  visible managed Google Chrome with a durable named profile, guarded
  recovery, and `plugin.browser` health; granted agents drive it through one
  `browser` tool and a managed skill, and settings expose the detected Chrome,
  profile name, health, and Open/Restart actions. Requires this Runtime.
- Runtime/API/App: turns create their message at first visible content and the
  app streams into the turn's post; the chat timeline projects conversation
  units with turn-scoped evidence, contributions keep their start order, and
  live turn state supports concurrent agent runs per chat.
- Runtime/App: expands Tasks with dependencies and scheduling, blocked/review
  statuses, shared colored labels, bulk actions, a calendar view, task
  attachments promoted into a runtime artifacts root, dedicated task work
  chats, and the runtime auto-dispatch loop with claims, recovery, and
  settings controls.
- Runtime: adds agent-to-agent mentions and cross-chat posts via `chats_list`
  and `chat_send`, agent bios with per-session instruction freshness, session
  freshness rotation from the reset point, `NO_REPLY` for channels, and
  home-timezone prompt timestamps.
- Server: archived chats are listable, read-only, and restorable.
- App: queued drafts steer a mentioned agent's live run, the chat rests
  against its composer with a per-exchange runway, post edits never move a
  reader who scrolled up, and thinking indicators end exactly with the turn.
- Runtime: guards the composed agent system prompt with a contract suite and
  behavioral evals, self-heals CLI PATH under service environments, resolves
  OpenAI Pi models by canonical provider reference, and refreshes seeded
  skills during startup.

## v1.4.44 - 2026-07-07

- Runtime/App: refreshes the Wiki recall capability during Runtime startup and
  keeps expected capability rows visible while the Runtime is still warming up.
- App: reconciles Runtime event catch-up after reconnect without replaying stale
  live turn progress, while still clearing terminal turn state and invalidating
  chat, session, and worker views.
- Runtime release: preserves the packaged `@tavern/sdk` after staging qmd so
  Homebrew can install the Runtime artifact successfully.

## v1.4.43 - 2026-07-07

- Runtime/API/App: adds Tavern Tasks with Runtime-owned task storage, agent
  task tools, server sync, realtime invalidation, dispatch, and full app list,
  detail, and editor surfaces.
- Runtime/API/App: replaces composer command proxies with agent session routes
  plus the agent drawer for session facts, usage, reset, and archived demo
  sessions.
- Runtime/App: adds per-turn Wiki recall over the packaged qmd semantic
  index, recall capability health, prompt evidence capture, and dev-mode turn
  inspection.
- Runtime: improves turn prompt context with timestamps, chat identity, roster,
  model-family guidance, and per-agent run ids for multi-agent fan-out.
- App: adds the Cmd+K command menu, merges per-agent Skills and Plugins into an
  enabled-first settings page, refreshes Tasks and Automations layout polish,
  and adds the alien agent avatar.
- Server: fixes settings catch-all redirects, app-root command menu
  mounting, task realtime registration, skill-save validation, agent DM sync,
  chat composer focus, and code editor line-number alignment.

## v1.4.42 - 2026-07-06

- Runtime/API/App: routes Google OAuth callbacks through the Tavern app server
  so desktop Plugin setup completes reliably against Runtime-owned Google
  settings.
- Runtime/App: returns saved Plugin secret presence to settings forms so stored
  MerchBase credentials remain visible and editable.
- Runtime/App: gates Plugin and Skill enablement on configuration, global
  feature state, and agent availability so settings only expose usable
  capabilities.
- App: clears stale chat turn state after a response completes so completed
  turns do not keep the transcript in a running state.

## v1.4.41 - 2026-07-06

- App: repairs legacy automation cache tables during desktop backend startup so
  existing installs can open after the v1.4.40 scheduler schema change.

## v1.4.40 - 2026-07-06

- Runtime/API/App: replaces rich responses with grant-scoped Tavern Widget
  fences, Widget contracts, durable Widget activity, and app renderers for
  charts, calendars, tables, and MerchBase displays.
- Runtime/API/App: adds the runtime-native automation scheduler with cron job
  storage, execution, delivery targets, agent tools, and refreshed automation
  editor and run history views.
- Runtime/App: adds background Memory and skill-work observability, including
  worker status filters, job timelines, report drawers, and live run feedback.
- Runtime/App: makes disk and Plugin skills writable, visible in the shared
  library, updateable, restorable, and backed by usage telemetry and curator
  workers.
- App: polishes the Skills settings surface, automation editor sizing, agent
  picker behavior, and settings navigation.

## v1.4.39 - 2026-07-06

- Runtime/App: adds the Google Plugin with Tavern-managed OAuth and Google
  Calendar event list, search, and create tools.
- Runtime: packages the Tavern-owned Google OAuth desktop client into Runtime
  release artifacts so Homebrew-installed Runtime builds can connect Google.
- Runtime/App: streams live harness turn activity and simplifies live turn
  narration with calmer replace-in-place updates.
- Runtime/App: adds live Memory job events, Runtime home timezone handling, and
  Wiki root startup repair.
- App: polishes chat toolbar icons, sidebar activity hover behavior, profile
  photo controls, and transcript agent mention appearance.

## v1.4.38 - 2026-07-04

- Runtime/API: adds the Memory stack with shared Wiki tools, core memory
  prompt wiring, model-driven memory workers, worker health, and the
  Memory worker Runtime capabilities.
- Runtime/App: adds rich references for agents, skills, apps, plugins, and
  workspace paths, including skill activation hints and agent-scoped skill
  autocomplete.
- Runtime/App: adds Runtime-backed Tavern channel creation and participant
  editing, including multi-agent channels and explicit agent addressing.
- Runtime/App: reworks streaming turn rendering, tolerates delivered messages
  missing turn metadata, and keeps channel messages human-only until an agent is
  explicitly addressed.
- App: refreshes Agent avatars, global Memory settings, chat/sidebar polish,
  toolbar history navigation, breadcrumbs, participant slots, and message chip
  styling.

## v1.4.37 - 2026-07-02

- Runtime: runs the Codex bridge bootstrap install from the bridge directory in
  non-interactive mode so Codex agent turns can recover cleanly after a failed
  or stale sandbox install.
- Runtime/App: separates assistant commentary from the final assistant reply and
  preserves message phase metadata for chat rendering.
- App: improves active-turn recovery, MerchBase Plugin chat capability
  projection, Agent avatar rendering, and channel hash icon geometry.

## v1.4.36 - 2026-07-02

- Runtime: recovers interrupted Agent turn rows on startup so a stale running
  turn cannot block future Codex replies after restart.

## v1.4.35 - 2026-07-02

- Runtime: pins the packaged Codex bridge to Codex 0.142.5 so installed
  Runtime turns do not hang on the older vendored Codex binary.
- Runtime: fails stalled Agent turns after a configurable watchdog timeout
  instead of leaving chat responses running forever.

## v1.4.34 - 2026-07-02

- Runtime: stages Codex and Claude Code harness bridge assets in packaged
  Runtime artifacts so agent execution can bootstrap reliably after install.
- App: keeps the chat rail visible on new-tab chat surfaces.

## v1.4.33 - 2026-07-02

- Runtime: added executable model provider management with curated provider
  lifecycle state.
- Runtime: ensured built-in Agent DMs exist and bounded harness chat context.
- Runtime: hardened the MerchBase Plugin boundary.
- App: added Agent character avatars across chat and settings, including
  theme-aware artwork and a character picker.
- App: moved active chat status above the composer, restored collapsed-sidebar
  click handling, defaulted layout to the topbar, and polished Runtime settings.
- Docs: documented model provider lifecycle and Agent character authoring.

## v1.4.32 - 2026-07-01

- Rebuilt Tavern around chat-native Agent seats, Agent sessions, and Agent
  turns.
- Moved Claude Code and Codex execution to AI SDK HarnessAgent.
- Kept OpenAI/API-key and deterministic e2e execution on AI SDK LanguageModel
  routes.
- Made Runtime the source of truth for model catalog, Agent default model,
  session effective model, tool inventory, and sandbox mode.
- Switched model catalog behavior to curated provider lists with explicit
  availability state.
- Removed retired engine compatibility paths, interactive tool approval prompts,
  old settings pages, and stale docs.
