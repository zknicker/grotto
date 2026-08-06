---
summary: User-facing rich reference behavior for mentions, skills, apps, plugins, files, and future product cards.
read_when:
  - changing chat mentions, rich reference rendering, autocomplete references, or explicit typed links in messages
  - adding a new reference type such as agent, skill, app, plugin, file, directory, product, ASIN, memory, chat, or session
---

# Rich References

Tavern messages can include explicit rich references. A rich reference is a
normal markdown link whose target tells Tavern what the link points at. Settled
chat messages render through HeroUI Markdown; the stored markdown remains the
portable fallback.

Examples:

- `[@Tavern](agent://agt_primary)` addresses an Agent in a channel.
- `[$ui](skill://ui)` references a skill for the turn.
- `[@Chrome](app://computer-use/com.google.Chrome)` references a Mac app.
- `[README.md](/repo/README.md)` references a file.

Bare text is not a rich reference. `@Tavern`, `$ui`, and ASIN-looking text stay
plain text unless the user selects or types explicit link syntax.

## Product Rules

- Markdown content is the source of truth.
- Saved messages do not need `metadata.tavern.mentions` to render, route, or
  project references.
- The composer may keep local metadata for live chip appearance while the user
  edits a draft.
- A channel message reaches every joined agent's inbox regardless of mentions
  (see [Agent Inbox](../../specs/inbox.md)). A personal @mention — rich
  `agent://` reference or plain `@handle` — pierces a channel mute or an
  unfollowed thread as a single delivery; it does not gate who else sees the
  message.
- DMs still address their single Agent participant implicitly.
- Skill references use stable `skill://<skill-id>` targets. They nudge the
  addressed Agent to use that skill only when the skill is already assigned to
  that Agent.
- Skill references do not mutate `enabledSkillIds`, install skills, or inject
  `SKILL.md` bodies. Runtime loads assigned skills through the normal
  HarnessAgent skills path.
- Skill autocomplete is scoped by addressed Agents in the draft. If the draft
  has linked Agent mentions, `$` shows the union of skills assigned to those
  Agents. If the draft has no linked Agent mentions, `$` shows the union of
  skills assigned to the Agents in the current chat or DM.
- Removing an Agent mention after inserting a skill mention does not delete or
  invalidate the skill link. The filter is autocomplete assistance; Runtime
  still decides per addressed Agent whether the referenced skill is assigned.
- Capability references never install, enable, connect, or authorize a tool by
  themselves.
- One shared reference-chip registry owns icons, labels, colors, and fallbacks
  for composer and transcript surfaces. Adding a new chip kind extends that
  registry instead of adding message-renderer conditionals.
- Ordinary web links use the same chip shell with the site's favicon and a
  globe fallback. Activating one opens the original URL.

See [Rich References](../../specs/mentions.md) for the normative implementation
contract.
