# Changelog

All notable changes to this project will be documented in this file.

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
  desktop and web Apps connect directly through exact-versioned HTTP and
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
  scheduled wakes at the canonical web App origin.
- Published Grotto versions now promote the hosted App and Server atomically by
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
- Server/App: archived chats are listable, read-only, and restorable.
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
- App/Server: fixes settings catch-all redirects, app-root command menu
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
