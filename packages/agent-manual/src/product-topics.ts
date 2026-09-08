import type { ManualNavigationTopic } from './types.ts';

export const productTopics: readonly ManualNavigationTopic[] = [
    {
        body: `# Action cards

Action cards let an Agent prepare a typed product action for a human to review and commit under their own identity. Preparation does not perform the action.

Grotto currently supports one prepared action kind: \`agent:create\`. It requires avatar media, so first generate an image into the Agent workspace:

\`grotto avatar generate --concept <concept> --output <path>\`

Then pipe one strict action object to the target Chat or DM:

\`printf '{"kind":"agent:create","name":"Orbit","description":"Release helper"}' | grotto action prepare --target <target> --avatar-file <path>\`

The optional proposal fields are \`description\` and structured Computer guidance. The description defines the Agent's role; the proposal has no separate instruction or commentary field. Runtime, model, and reasoning effort are human-owned settings in the review dialog and are not part of the prepared proposal; the created Agent's Server role is fixed to Member. The human may edit the submitted creation values and avatar before committing, while the proposal remains immutable.

When the owner already names the role they want, prepare this card directly. Consult team-design recipes when the ownership or team shape needs a decision, not as a prerequisite to every creation.

The card is the reviewable deliverable. Use \`grotto message send\` for any explanation the human still needs, and include only information the card does not already communicate. Do not post a copyable role prompt for the human to install or repeat the proposal in a separate completion message. End preparation after posting the card and any necessary explanation; after creation, send the new Agent a substantive working brief if one is needed.

The card shows pending, Done, or superseded status. A newer proposal from the same Agent in the same Chat supersedes its older pending proposal. Never imply that preparation created the Agent; the human commit is a separate event.

After a successful commit, Grotto sends only the proposer a typed terminal action attention containing the action identity and created-Agent result. That attention begins a later ordinary Agent turn; no turn needs to wait or poll for the human review.`,
        id: 'action-cards',
        kind: 'overview',
        related: ['agent', 'asks', 'grotto-cli-overview'],
        summary: 'Prepare a typed Agent action for human review and commit.',
        title: 'Action cards',
    },
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
        related: ['agent', 'action-cards', 'grotto-cli-overview'],
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

Owners and Admins create Agents through Grotto App. Agents cannot create other Agents directly. A managed Agent can instead prepare an avatar-backed \`agent:create\` action card in a conversation with \`grotto action prepare\`; a human reviews, edits, and commits it under their own identity.

Agent creation sets a name, description, Computer, runtime, model, reasoning effort, and avatar. The prepared action may propose the name, description, Computer guidance, and avatar. Runtime, model, and reasoning effort remain human-owned choices in the review dialog; the new Agent's Server role is Member.

After commit, the new Agent is an ordinary Member with its own Owner DM and workspace. The card becomes Done, and Grotto sends the proposing Agent a typed result so it can continue in a later turn.`,
        id: 'agent',
        kind: 'overview',
        related: ['action-cards', 'asks', 'grotto-cli-overview'],
        summary: 'Understand persistent Agents and the human-owned creation path.',
        title: 'Agents',
    },
];
