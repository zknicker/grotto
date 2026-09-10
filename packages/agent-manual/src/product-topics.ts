import type { ManualNavigationTopic } from './types.ts';

export const productTopics: readonly ManualNavigationTopic[] = [
    {
        body: `# Asks

An Ask is a Message that asks one named human for a decision and stays in that human's Inbox until someone answers. It is the record that says a specific person must act.

Use an Ask when a decision is genuinely theirs — an irreversible act, a spend, a release, a choice between paths you cannot rank on your own. An ordinary question in the conversation is enough when you only need information or when any participant can answer. One Ask carries one decision.

\`grotto ask --target <target> --to @<handle> --title <text> --summary <text> --step <text>\`

The question text arrives on stdin and becomes the Message content, so write it in your own words. \`--title\` names the decision, \`--summary\` gives the human what they need to decide, and \`--step\` is the single step you recommend. The addressee must be an active human Server member with access to that Chat; an unknown or ineligible handle fails and creates nothing.

A top-level Ask gets its Thread immediately, and an Ask posted inside a Thread stays there. The first reply in that Thread from anyone other than you settles the Ask, and it reaches you as an ordinary Thread delivery. Read the answer and judge what it means; a reply that does not resolve the question is a reason to post a new Ask, not to reopen the old one.

Ask Messages read back with an \`[ask status=open|answered to=@handle]\` suffix wherever messages are shown, so history tells you which decisions are still owed and by whom without a second command.

An Ask changes nothing on its own. It never advances a task, commits a proposal, or performs the act it describes. Answering it is a human deciding, and doing the work is still your next command.`,
        id: 'asks',
        kind: 'overview',
        related: ['agent', 'grotto-cli-overview'],
        summary: 'Ask one named human for a decision and act on their answer.',
        title: 'Asks',
    },
    {
        body: `# Cloud agents

A Cloud Agent is a provider-hosted agent you hand bounded development work to. You start it, it works in a repository without you, and its result reaches your inbox when the run settles.

Use one when the work is a real coding change in a repository someone else's machine can build — reproduce a failure, make the change, open a pull request — and you would otherwise sit and wait. Keep work you can finish in this turn, and anything needing conversation, for yourself.

\`grotto cloud-agent start --target <target> --repo <owner/name> --ref <ref> --title <text> --say <text>\`

The instructions for the cloud agent arrive on stdin. Write them as a complete brief: the cloud agent cannot ask you a question, so name the repository paths, the reproduction, and what a finished result looks like. \`--say\` is your own message to the chat and becomes the Message content, so say what you delegated and why in your own words. \`--title\` names the work for humans, and \`--ref\` is the starting branch, tag, or commit.

Launch fails before anything is created when the input is wrong, the Computer has no Cloud Agent provider, or the target is unreachable. Once the work is recorded it stays recorded: a provider that refuses the launch settles that same work as failed rather than erasing it.

A top-level work Message gets its thread immediately, and work started inside a thread stays there. That thread is where humans steer and where you post what you learn.

For revisions, corrections, or another step in the same assignment, send instructions on stdin with \`grotto cloud-agent send --work <workId>\`. Reuse the Work ID from the start receipt. This continues the same hosted agent and work thread, preserving its repository context and earlier results. If it is busy, Grotto queues the prompt. Add \`--interrupt\` when the new instructions replace active work and any older queued prompts. Start another cloud agent only for a separate assignment.

\`grotto cloud-agent inspect\` lists work you delegated. Add \`--work <workId>\` to read that work's status and recorded results. Completion reaches your inbox automatically and wakes you, or arrives in a later turn if you are busy. You do not need to set a reminder or poll to learn when it finishes; inspect when you need evidence.

\`grotto cloud-agent stop --work <workId>\` asks the provider to stop work you started and discards its queued prompts. Owners and Admins can cancel it too. Cancellation is recorded immediately and the active run settles as cancelled when the provider stops. The earlier \`cancel\` command remains an alias for existing callers. A later \`send\` continues the same work with a new run.

When the run settles you receive one inbox attention carrying its status, summary, branches, and any pull-request URL, and the report names that pull request's number, state, and diff counts when Grotto could read them, so you can judge the size of the change before opening it. Cloud Agent work produces no automatic message: read the result, judge it, and post what is worth saying as an ordinary reply in the work's thread. A pull request is a reference anyone can post — a lone pull-request reply is often the whole report.`,
        id: 'cloud-agents',
        kind: 'overview',
        related: ['agent', 'asks', 'grotto-cli-overview'],
        summary:
            'Delegate bounded repository work to a provider-hosted agent and report the result.',
        title: 'Cloud agents',
    },
    {
        body: `# Agents

An Agent is a persistent collaborator with its own identity, private workspace, memory, execution settings, and one ongoing session across the Chats where it participates.

You can create one yourself:

\`grotto agent create --target <target> --name <name> --description <text> [--brief <text>] [--channel "#name"] [--avatar-concept <text>] --say <text>\`

Create an Agent only when a human in the Chat you are working in has asked for one. Their request is the whole consent; there is no card to prepare, no approval to wait for, and no separate Ask. Never create an Agent on your own initiative, and never create one to split work you could do yourself — a new Agent earns its place by owning a lasting lane, not by absorbing one task.

The new Agent inherits your runtime, model, reasoning effort, and Computer, and joins as an ordinary Agent with its own Owner DM and workspace. Grotto derives the handle from \`--name\` — lowercased, with spaces as hyphens — so \`--name "Orbit"\` is \`@orbit\`. If that handle was already taken the creation is refused, nothing is created, and the refusal names the handle the Server minted instead; run the same command again with that one.

**Announce it in #all.** Target \`#all\` for the creation unless the human asked for it privately. Your \`--say\` is the team's first impression of the new teammate, so write it like introducing a new hire to the room: warm and specific, not a changelog and not corporate. Name them by \`@handle\` — that mention is how humans reach the profile, and there is no other control on the Message — say what they own in one sentence, add one detail that makes them feel like a person, and say who to ask about the lane. For example: \`Everyone, meet @orbit, our new competitor-intel teammate. Orbit watches launches and pricing moves and drops a weekly digest in #product every Friday. Say hi, and send lane questions to @zach-knickerbocker.\` Avoid "please join me in welcoming."

**Put it where the work is.** Pass \`--channel\` for every channel the request names or the lane clearly implies. It always joins \`#all\`, so you never pass that. Do not add it anywhere else on a guess; a channel you named that does not exist refuses the whole creation, and you can adjust membership later with \`grotto channel add --target "#name" --agent @handle\`.

**Give it a brief.** \`--brief\` is the standing instruction it reads on every startup: its lane, its outputs, its cadence, where to post, who reviews, and what to ask about before guessing. It is not a message, and you do not DM the new Agent — DMs are between a human and an Agent. Write it every time; an Agent that wakes without one has nothing to own.

\`--avatar-concept\` generates the avatar during creation. If the Server has no avatar generation provisioned, the Agent is created without one and the receipt says so — state that plainly rather than sending the human to Settings; no App setting controls it. A transient generation failure refuses the whole request and creates nothing, so retry once.

The receipt returns the new \`@handle\` and the channels it landed in.

**Re-running it is safe.** The identical command returns the teammate the first run created and creates nothing new; the receipt says it repeated an earlier request. So when a create times out, or you cannot tell whether it landed, run it again exactly as you wrote it rather than checking first. Change any flag — a word in \`--say\`, one more \`--channel\` — and you are asking for a different Agent, and you get a second one.

\`grotto agent update --agent @handle --description <text>\` rewrites an Agent's description, and \`grotto agent avatar --agent @handle --concept <text>\` replaces its avatar. Cove's identity is protected: both refuse on Cove.

The Agent profile pane in Grotto App is where a human owns these values, along with runtime, model, and reasoning effort, which are theirs alone to change. Editing from Chat is a convenience for the human standing in front of you, not the record.`,
        id: 'agent',
        kind: 'overview',
        related: ['asks', 'grotto-cli-overview'],
        summary: 'Create and maintain persistent Agents from the Chat a human asked in.',
        title: 'Agents',
    },
];
