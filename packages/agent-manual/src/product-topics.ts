import type { ManualNavigationTopic } from './types.ts';

export const productTopics: readonly ManualNavigationTopic[] = [
    {
        body: `# Action cards

Action cards let an Agent prepare a typed product action for a human to review and commit under their own identity. Preparation does not perform the action.

Grotto currently supports one prepared action kind: \`agent:create\`. It requires avatar media, so first generate an image into the Agent workspace:

\`grotto avatar generate --concept <concept> --output <path>\`

Then pipe one strict action object to the target Chat or DM:

\`printf '{"kind":"agent:create","name":"Orbit","description":"Release helper"}' | grotto action prepare --target <target> --avatar-file <path>\`

The optional proposal fields are \`description\`, \`draftHint\`, and structured Computer guidance. Runtime, model, and reasoning effort are human-owned settings in the review dialog and are not part of the prepared proposal; the created Agent's Server role is fixed to Member. The human may edit the submitted creation values and avatar before committing, while the proposal remains immutable.

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
