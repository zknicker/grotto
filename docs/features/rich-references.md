---
summary: User-facing rich reference behavior for mentions, skills, apps, plugins, files, and future product cards.
read_when:
  - changing chat mentions, rich reference rendering, autocomplete references, or explicit typed links in messages
  - adding a new reference type such as agent, skill, app, plugin, file, directory, product, ASIN, memory, chat, or session
---

# Rich References

Grotto messages can include typed rich references. A rich reference is a normal
Markdown link whose target tells Grotto what the link points at. Settled chat
messages render through HeroUI Markdown; the stored Markdown remains the
portable fallback.

Examples:

- `[@Grotto](agent://agt_primary)` addresses an Agent in a channel.
- `[@Ada Lovelace](user://usr_ada)` references a human by immutable user id.
- `[$ui](skill://ui)` references a skill for the turn.
- `[@Chrome](app://computer-use/com.google.Chrome)` references a Mac app.
- `[#product](chat://cht_product)` opens a channel by immutable chat id.
- `[README.md](/repo/README.md)` references a file.

The human composer persists selected references as explicit typed links. Agent
output may use bare `@handle` and `#channel` tokens; the Server resolves known
tokens once at send time and persists immutable typed links. Unknown or protected
tokens stay plain text. For example, `@blippy` becomes
`[@blippy](agent://agt_blippy)` and `#product` becomes
`[#product](chat://cht_product)`.

## Product Rules

- Markdown content is the source of truth.
- Agent references bind to immutable Agent ids, not reusable handles. A reference
  to a deleted Agent stays attached to that historical identity even if a new
  Agent later reuses the same visible handle.
- Agent reference chips resolve the current Agent display name and avatar. The
  persisted label remains the fallback when that Agent is unavailable.
- Agent-authored bare `@handle` and `#channel` tokens are canonicalized once at
  send time. Human-authored composer references remain explicit typed links.
- Unknown or protected bare tokens remain unchanged. Protected text includes
  code spans and Markdown constructs whose leading sigil is presentation syntax.
- Agent chips open the referenced Agent profile. Chat chips open the referenced
  channel; both actions use the immutable target id.
- Human references bind to immutable user ids. Their visible chip label and
  avatar resolve from the live profile; departed or unknown humans keep the
  persisted label and never rebind when a handle is reused.
- Saved messages do not need `metadata.grotto.mentions` to render, route, or
  project references.
- The composer may keep local metadata for live chip appearance while the user
  edits a draft.
- A channel message reaches every joined agent's inbox regardless of mentions
  (see [Agent Inbox](../../specs/inbox.md)). A personal @mention — an explicit rich
  `agent://` reference or a human-authored plain `@handle` — pierces a Channel mute without unmuting it and restores
  an explicitly unfollowed Thread; it does not gate who else sees the
  message. Followed Threads keep their ordinary delivery when their parent
  Channel is muted.
- DMs still address their single Agent participant implicitly.
- Human references are visual references only; they do not notify or wake anyone.
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
  Inline references use the transparent tertiary shell, inherit the surrounding
  paragraph's type size, and carry an 18px identity mark—16px for the compact
  three-sparkle Skill mark—plus a bold label with a dotted underline in the
  reference's identity color.
  Their internal line box stays tight so the paragraph alone owns leading. They
  add no outer padding, so ordinary text spaces own paragraph rhythm; one theme
  spacing step separates the mark from its label. The label and fixed-size mark
  receive optical alignment so they sit with the surrounding paragraph text. The
  underline is painted inside reserved label space so truncation cannot clip it,
  and its dot size and spacing scale with the paragraph type. Agent
  labels use the accent (blue) foreground, Skill labels use a dedicated purple
  identity color, and
  Channel labels use the Channel's configured color; a Channel without a
  configured color reads as foreground ink with a neutral translucent mark
  rather than muted caption gray. A Channel identity mark
  retains the Channel's own colored box. Chat references resolve that mark and
  label color from the Channel's live appearance, while the persisted Chat id
  remains the appearance-independent source of identity.
  Adding a new chip kind extends that registry instead of adding
  message-renderer conditionals or another chip primitive.
- Agent, Channel, and Skill references in transcript/read surfaces are
  keyboard-focusable preview controls. Composer chips remain editor content,
  not nested controls.
  Hover or focus opens a HeroUI hover card immediately and leaving closes it
  immediately. A fine mouse pointer moves that card directly with the reference
  while keyboard, touch, and reduced-motion use stock anchored placement. Agent previews show identity, availability,
  compact runtime/model/reasoning configuration, and newest durable
  activity. Channel and Skill previews share one compact identity-header
  grammar: a compact mark, a bold title, and one muted `·` clause baseline-aligned
  to that title, over a tighter shared inset and one optical content edge. Both
  cards size to their content up to one shared maximum measure. A Channel's clause
  is its last-activity status; a Skill's clause is its kind. Channel previews show
  live participant faces below the title as a compact overlapping stack, each face
  ringed in the card's own surface, with any remainder as a trailing count. Skill
  previews place the full current description
  directly below their title, resolving it from the current chat's available
  Skills while the card is open and falling back to reference metadata when
  available.
  Interactive references strengthen slightly on hover or focus — deepening in
  the light theme and brightening in the dark theme, so the gesture never
  washes the reference toward its ground.
- Ordinary web links use the same chip shell with the site's favicon and a
  globe fallback. Activating one opens the original URL. Agent and chat chips
  are interactive: they open the referenced Agent profile or channel.

See [Rich References](../../specs/mentions.md) for the normative implementation
contract.
