---
summary: User-facing rich reference behavior for mentions, skills, apps, plugins, files, and future product cards.
read_when:
  - changing chat mentions, rich reference rendering, autocomplete references, or explicit typed links in messages
  - adding a new reference type such as agent, skill, app, plugin, file, directory, product, ASIN, memory, chat, or session
---

# Rich References

Grotto messages can include explicit rich references. A rich reference is a
normal markdown link whose target tells Grotto what the link points at. Settled
chat messages render through HeroUI Markdown; the stored markdown remains the
portable fallback.

Examples:

- `[@Grotto](agent://agt_primary)` addresses an Agent in a channel.
- `[$ui](skill://ui)` references a skill for the turn.
- `[@Chrome](app://computer-use/com.google.Chrome)` references a Mac app.
- `[README.md](/repo/README.md)` references a file.

Bare text is not a rich reference. `@Grotto`, `$ui`, and ASIN-looking text stay
plain text unless the user selects or types explicit link syntax.

## Product Rules

- Markdown content is the source of truth.
- Agent references bind to immutable Agent ids, not reusable handles. A reference
  to a deleted Agent stays attached to that historical identity even if a new
  Agent later reuses the same visible handle.
- Saved messages do not need `metadata.grotto.mentions` to render, route, or
  project references.
- The composer may keep local metadata for live chip appearance while the user
  edits a draft.
- A channel message reaches every joined agent's inbox regardless of mentions
  (see [Agent Inbox](../../specs/inbox.md)). A personal @mention — rich
  `agent://` reference or plain `@handle` — pierces a Channel mute without unmuting it and restores
  an explicitly unfollowed Thread; it does not gate who else sees the
  message. Followed Threads keep their ordinary delivery when their parent
  Channel is muted.
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
  for composer and transcript surfaces. The renderer uses the stock HeroUI
  `Chip` shell; the registry supplies only reference-specific appearance.
  Inline reference chips use the default shell spacing with chat-sized label text.
  That spacing keeps nested avatars and icons concentric with the shell's token-derived
  radius, while content-independent optical alignment keeps the chip on the text line.
  Skill references use one neutral treatment and the shared sparkles mark across
  composer, transcript, and Skill surfaces.
  Adding a new chip kind extends that registry instead of adding
  message-renderer conditionals or another chip primitive.
- Ordinary web links use the same chip shell with the site's favicon and a
  globe fallback. Activating one opens the original URL.

See [Rich References](../../specs/mentions.md) for the normative implementation
contract.
