---
summary: Rich reference model for explicit markdown mentions, chip rendering, agent addressing, and runtime skill projection.
read_when:
  - changing composer @ or $ autocomplete, rich reference rendering, runtime mention projection, transcript mention rendering, or agent addressing
  - adding new rich reference kinds such as skills, plugins, apps, files, directories, agents, chats, sessions, memories, or product cards
---

# Rich References

Rich references are explicit typed links in message text. The visible markdown is
the durable source of truth:

```md
[@Tavern](agent://agt_primary)
[$ui](skill://ui)
[@Computer Use](plugin://computer-use@openai-bundled)
[@Chrome](app://computer-use/com.google.Chrome)
[mentions.md](/Users/zknicker/.codex/worktrees/1b41/tavern/specs/mentions.md)
```

Autocomplete inserts friendly text while editing, then the composer serializes
the selected reference into markdown. Tavern does not persist a parallel
`metadata.tavern.mentions` index for user-authored messages. Metadata may carry
local picker or chip appearance while editing, but saved messages must render
and route from content alone.

Bare mention-looking text is plain text. `@Tavern`, `$ui`, and an ASIN-looking
token do nothing unless the user selected or typed explicit link syntax.

## Triggers

- `@` after start-of-input or whitespace opens Agent references for agents in
  the current chat.
- `$` after start-of-input or whitespace opens skill references. Skill options
  use stable `skill://<skill-id>` targets and are scoped to the Agents addressed
  by linked Agent mentions in the current draft. If the draft has no linked
  Agent mentions, skill options are scoped to the current chat or DM's Agent
  participants.
- `/` at the very start of the composer opens commands. Commands are not rich
  references.

## Reference Kinds

| Kind | Target | Projection | Behavior |
| --- | --- | --- | --- |
| `agent` | `agent://<encoded-agent-id>` | `agent-reference` | Channel sends start one turn per linked agent participant. Agent DMs address their one agent participant without a link. Agent-authored final replies dispatch the same way, bounded by chain limits ([agent-mentions](agent-mentions.md)). |
| `skill` | `skill://<encoded-skill-id>` | `skill-activation` | Runtime adds a compact turn hint only if the addressed Agent already has that skill enabled. |
| `plugin` | `plugin://<name>@<marketplace>` | `capability-reference` | Preserve the link. Do not enable, install, connect, or authorize the plugin from the reference alone. |
| `app` | `app://computer-use/<encoded-app-id>` | `capability-reference` | Preserve the link with the selected app label. Computer Use resolves the app when tools are invoked. |
| `file` | absolute file path | `path-reference` | Preserve the path. Do not attach file contents automatically. |
| `directory` | absolute directory path | `path-reference` | Preserve the path. Do not recursively attach contents automatically. |

Images can still travel through attachment/image-input paths, but image
attachments are not part of this typed-link contract.

## Rendering

Tavern renders recognized links as compact chips in the composer, transcript,
prompt inspector, and other message surfaces. Rendering is presentation only:
the markdown remains readable without Tavern.

Known skills, plugins, apps, and agents may receive richer icons or labels from
their kind and target. Transcript rendering reconstructs chips by parsing the
message content, not by reading message metadata.

All surfaces render one shared mention chip component. Agent chips show the
agent's avatar tinted with its configured color — the same color the user picks
from the agent color presets in Settings. Transcript surfaces resolve that
appearance live from the agent record by decoding the `agent://...` target;
the composer embeds the same appearance in local option metadata at pick time
because composer chips mount outside app providers. An agent with no uploaded
avatar shows its initials and keeps its configured color as the chip tint;
unknown agents fall back to the generic agent icon.

## Autocomplete Options

Autocomplete options use one common shape:

- `kind`: reference kind.
- `label`: user-facing chip label.
- `id`: markdown link target.
- `insertText`: editable text inserted before serialization.
- `projection`: runtime projection.
- `metadata`: optional local presentation facts such as app icon data or agent
  face data.

Examples:

| Source | Option identity | Serialized markdown |
| --- | --- | --- |
| Agent | `kind: "agent"`, `id: "agent://agt_primary"`, `insertText: "@Tavern"` | `[@Tavern](agent://agt_primary)` |
| Skill | `kind: "skill"`, `id: "skill://ui"`, `insertText: "ui"` | `[$ui](skill://ui)` |
| Plugin | `kind: "plugin"`, `id: "plugin://computer-use@openai-bundled"`, `insertText: "Computer Use"` | `[@Computer Use](plugin://computer-use@openai-bundled)` |
| App | `kind: "app"`, `id: "app://computer-use/net.imput.helium"`, `insertText: "Helium"` | `[@Helium](app://computer-use/net.imput.helium)` |
| File | `kind: "file"`, `id: "/repo/specs/mentions.md"`, `insertText: "specs/mentions.md"` | `[specs/mentions.md](/repo/specs/mentions.md)` |

## Runtime Behavior

Runtime projection parses the content with Tavern's shared rich-reference
parser:

- Agent references decode `agent://...` targets and are validated against the
  current chat's agent participants before turn startup.
- Skill references decode `skill://...` targets and intersect them with the
  addressed Agent's `enabledSkillIds`. They do not grant the skill, mutate
  `enabledSkillIds`, or read linked files from message text.
- Referenced enabled skills are projected as a compact activation hint:

```xml
<skill_reference_context>
The user explicitly referenced these enabled skills for this turn. Use the normal runtime skill-loading mechanism for them:

- ui
</skill_reference_context>
```

- Runtime still loads assigned skill instructions through HarnessAgent's
  `skills` setting during turn startup. It does not inline `SKILL.md` content
  into the user message or system instructions for a skill reference.
- If the addressed Agent does not have a referenced skill enabled, Runtime adds
  no hidden warning or prompt context for that reference.
- Composer skill filtering is advisory. If the user removes a linked Agent
  mention after inserting a skill reference, the skill reference remains valid
  markdown and Runtime silently ignores it for addressed Agents that do not have
  that skill enabled.
- Capability and path references remain visible markdown in the prompt.
- Unknown markdown links render as normal markdown, not chips.

## Future Reference Types

New rich references should follow the same rules:

- Require explicit syntax.
- Use a durable, typed target.
- Keep message content readable without Tavern.
- Do not rely on persisted mention metadata for identity.
- Add parser, rendering, routing, and projection tests before exposing the
  reference in autocomplete.
