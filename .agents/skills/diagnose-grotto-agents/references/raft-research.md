# Raft Research Partner

Use a dedicated read-only subagent early and keep it alive through diagnosis and fix validation.
Its job is to supply independent Raft evidence and challenge local reasoning.

Ask for a compact first checkpoint within roughly ten minutes: contract, exact local symbols, three
falsifiable questions, strongest challenge, and gaps. Deepen research only after the local evidence
path identifies a subsystem. If research stalls, return partial evidence rather than blocking the
primary diagnosis.

## Evidence Order

Prefer:

1. local Raft Computer and daemon source plus the installed implementation and exact runtime
   symbols;
2. current public Raft documentation;
3. current Raft blog posts describing product intent;
4. Tavern's checked-in Raft-alignment notes and captured recipes;
5. inference, labeled explicitly.

Public starting points:

- `https://raft.build/`
- `https://docs.raft.build/features/agents/external/`
- `https://docs.raft.build/features/messaging/messages/`
- `https://docs.raft.build/features/agents/lifecycle/`
- `https://docs.raft.build/features/agents/troubleshooting/`
- Raft's blog under `https://raft.build/resources/blog/`

Search the public sites for the exact concept under investigation. Use primary pages, preserve page
titles and URLs, and distinguish current documentation from older narrative posts.

## Inspect The Local Runtime Safely

The operator may have Raft Computer and its daemon source checked out and running locally. Perform
read-only discovery:

- search likely development roots such as `~/Programming` for Raft Computer and daemon repositories;
- locate executables with `which`, process inspection, and `launchctl`;
- inspect source checkouts, package metadata, and installed runtime package roots;
- search readable source and bundles for exact domain symbols and diagnostic strings;
- use `strings` on a bundled executable only when source is unavailable;
- correlate discovered symbols with process behavior and public contracts.

Likely locations can include `~/.local/bin/raft-computer` and `~/.slock/runtime-pkg/`, but discover
rather than assume. Never print environment values, tokens, cookies, keychains, configuration
secrets, or unrelated message contents. Do not stop processes, mutate installed files, send test
messages, or alter daemon state.

Useful symbols previously observed include:

- `AgentVisibleDeliveryLedger.recordConsumed`
- `AgentVisibleDeliveryLedger.isModelSeen`
- `AgentProcessManager.consumeVisibleMessages`
- `RuntimeNotificationState`
- `sendStdinNotification`
- `deliverMessagesViaStdin`

Treat these as search leads, not guaranteed current APIs. Record the installed version and quote
only the smallest relevant implementation fragment.

## Initial Subagent Prompt

Adapt this without inserting a favored diagnosis:

> Act as the Raft research partner for a Grotto Agent bug investigation. Work read-only and do not
> edit the Tavern repository. Here is the raw symptom and topology: [SYMPTOM]. Research current
> primary sources on raft.build, docs.raft.build, and the Raft blog; read Tavern's
> specs/raft-alignment material; and inspect the local Raft Computer/daemon source and installed
> implementation read-only. Do not expose credentials or unrelated message contents. Return:
> (1) a source-backed behavioral model, (2) exact local symbols or paths supporting it,
> (3) Raft/Grotto parity and deliberate divergence, (4) three to five falsifiable diagnostic
> questions, (5) the strongest challenge to the most tempting explanation, and (6) evidence gaps.
> Stay available for follow-up hypothesis and fix review.

## Hypothesis Review

After the deterministic repro exists, send the partner:

- the smallest evidence table;
- ranked hypotheses with falsifiers;
- the proposed regression oracle.

Ask:

> Which hypothesis conflicts with Raft's implementation or published contract? What single
> observation best distinguishes the top two? Does the regression preserve a global Agent session
> while proving current-target grounding? Challenge any assumption that is not direct evidence.

Do not accept “Raft does it this way” as sufficient proof. Translate the answer into a local,
observable invariant and test it in Grotto.

## Fix Review

Send the behavioral diff or smallest relevant code diff and ask:

> Does this preserve Raft's one-Agent/one-session semantics and delivery accounting? Identify any
> intentional divergence that should be documented. Name the strongest remaining failure mode and
> the focused test that would expose it.

Resolve material objections through repository source and tests. If Grotto intentionally diverges,
name the owning product contract and update it rather than disguising the difference as parity.

## Failure Modes Of The Research Process

- One-shot summaries that never see the actual hypotheses or fix.
- Blog interpretation overriding local executable evidence.
- Searching only Tavern's captured notes while claiming current public parity.
- Dumping broad binary strings or configs instead of targeted symbols.
- Letting the research partner implement the fix and thereby lose independence.
- Substituting architectural confidence for a deterministic local regression.
