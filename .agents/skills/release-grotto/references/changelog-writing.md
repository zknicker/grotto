# Grotto changelog writing

Write the release entry from the target-scoped evidence produced by
`bun run release:collect-changelog-context`. The changelog records what users receive, not the work
performed to produce it.

## Select the material

Include concrete outcomes that matter to a user or operator:

- new product capabilities;
- fixed incorrect, missing, unreliable, or slow behavior;
- breaking changes, removals, deprecations, security fixes, or required updates;
- release reliability changes when they materially change what can ship or run safely.

Omit tests, refactors, formatting, documentation maintenance, dependency churn, and release-process
mechanics unless they change an observable capability or operational guarantee. Group commits that
deliver one outcome. Do not turn every commit into a bullet.

Use SemVer as judgment, not commit-prefix transcription:

- major for an incompatible product or API change;
- minor for a backwards-compatible capability;
- patch for fixes and backwards-compatible improvements.

Apply that judgment independently to Server/App, Computer, iOS, and Grotto Agent versions. Use the
next unused iOS build number whenever iOS publishes. When Grotto Agent publishes, name its version
in the release entry alongside the observable behavior change.

## Write the entry

Keep Grotto's existing dated heading and compact bullet style. Lead each bullet with the affected
product noun and the user-visible result. Prefer exact behavior over adjectives.

Good:

```markdown
- Grotto Computer keeps task claims in their canonical Threads and reports every claimed task.
- Grotto for iPhone keeps the composer visible while the keyboard opens.
```

Weak:

```markdown
- Enhanced task handling with various improvements.
- We're excited to announce a better mobile experience.
```

Use verified measurements only. Keep internal filenames, commit hashes, implementation layers, and
PR mechanics out of user-facing prose. Mention migration or compatibility details only when the
reader must act on them.

## Deslop pass

Compare the draft with recent entries, then review only the new entry against its target evidence.
Preserve factual meaning while removing:

- canned introductions, marketing filler, and self-congratulation;
- vague claims such as “improved,” “enhanced,” or “streamlined” without the observable effect;
- repeated outcomes copied from earlier releases;
- unnecessary caveats, parentheticals, jargon, and implementation detail;
- multiple bullets that describe one user outcome.

Every remaining bullet should name what changed and why the reader cares. If the evidence contains
no notable user-facing change, write the narrow operational guarantee that actually changed rather
than inventing a feature.

This repo-owned guide adapts the useful writing principles from the MIT-licensed
[Claude Office Changelog Generator](https://github.com/claude-office-skills/skills/blob/main/changelog-generator/SKILL.md)
and the focused diff-cleanup discipline of Cursor Team Kit's `deslop` skill. Release agents use this
file directly; the external skills are not runtime dependencies.
