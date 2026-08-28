# Agent Workspace

Grotto Computer owns one isolated local root for each assigned Agent:

```text
agents/<agent-id>/
  workspace/
  home/
  skills/
  runtime/
```

The Server owns the Agent's identity, desired configuration, membership, and
immutable Computer assignment. It never owns or synchronizes the Agent's local
workspace. The workspace is the Agent's durable working environment and the
default working directory for its execution harness. It is organization, not a
security boundary.

## Durable knowledge

The Agent controls the structure of its workspace. The ordinary factory seed provides:

- `MEMORY.md`, a concise recovery index containing identity, role, empty
  knowledge, and initial active context.

The seed establishes only that minimal starting point and never overwrites an
existing workspace. The Agent may add, rename, organize, and remove
task-specific files as its work requires.

Cove is the one distinct factory kind. Its fresh workspace inventory is exactly
`MEMORY.md`, `onboarding_playbook.md`, `onboarding_knowledge_faq.md`, and
`onboarding_objectives.md`. Objectives contain 12 separately authored short
summaries linked to the 12 seeded-tier Manual topics; no full Manual card,
query-tier summary, archetype note, `save-as-a-skill`, or `grotto-agent` skill
is copied. Computer records the four-file manifest in the durable Cove
application receipt and validates it before replaying success. Cove still gets
the normal isolated skill library and release-owned `visuals` skill.

After creation, `MEMORY.md` and `onboarding_objectives.md` are Cove-owned state and are never
factory-refreshed. `onboarding_playbook.md` and `onboarding_knowledge_faq.md` are versioned factory
guidance: before a Cove turn, Computer may replace them only when their bytes exactly match a known
prior factory release. Missing or edited files are preserved as conflicts. Both successful refreshes
and conflicts appear in Agent Activity History. A successful refresh adds a one-turn private notice
that tells the existing model session to re-read the two files; it does not rotate the session.

Factory guidance participates in the public Grotto Agent version. A successful compatible refresh
may advance that version; a missing or edited Cove file blocks the receipt from advancing and leaves
the conflict visible as a failed update.

There is no managed `NOTES.md`, `SOUL.md`, injected core-memory section,
automatic extraction or dreaming pipeline, or separate Wiki primitive.
Personality comes from the Server-owned Agent description. Durable learned
role and context live in the Agent-owned workspace.

## Skills and credentials

Installed skills live in the Agent's sibling `skills/` directory. That
directory is the assignment: the selected harness reads it directly, and
imports create independent copies there. Harness credentials and CLI state live
under the Agent-specific `home/`; Computer must not copy broad host
configuration into the Agent root or commit local state.

Owners and Admins may read, edit, or delete an Agent copy through the
authenticated Server-to-Computer relay. The Server never persists `SKILL.md`
bytes; edits and deletes are guarded by the Computer-reported bundle hash.

## Lifecycle

The local root survives ordinary idle periods, Computer restarts, model or
runtime changes, and session reset. Session reset creates fresh model context
without erasing the workspace or skills. Full reset restores the workspace for
the Agent's persisted factory kind: minimal `MEMORY.md` for an ordinary Agent,
or the exact four-file Cove onboarding seed. It deletes all existing skills
and restores only current factory-managed skills, presently `visuals`.
Retirement removes the local execution host after Server retirement has
completed.

Canonical chat history remains on the Server. Agents recover older
conversation context through the Grotto CLI rather than treating the workspace
as a transcript mirror.

## Browsing

The App browses the real workspace through the owning Computer. Hidden files
are excluded by default and appear only while the user enables the hidden-files
toggle. Sensitive files and credential directories, symlinks, and skipped
heavy directories remain unavailable regardless of that toggle.
