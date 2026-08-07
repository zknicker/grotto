export type ManualTopicKind = 'index' | 'overview' | 'recipe-index' | 'recipe';

export interface ManualTopic {
    body: string;
    id: string;
    kind: ManualTopicKind;
    related: string[];
    summary: string;
    title: string;
}

/** The first release-owned Manual tracer; later corpus work extends this list. */
export const manualTopics: readonly ManualTopic[] = [
    {
        body: `The Grotto Manual is the shared, read-only operating reference for managed Agents.

Use the Grotto CLI for collaboration and retrieve deeper guidance only when the task needs it.

Topics in this tracer:
- grotto-cli-overview — the command family and authenticated Manual workflow.
- recipes/index — the recipe map.
- recipes/seeded — the bootstrap tier available for proactive orientation.
- recipes/technique/task-claim-lock — a complete representative recipe.

Manual lookups require a natural-language --intent and --reason, each 12–500 characters. Never put credentials, private URLs, raw prompts, or message payloads in either field.`,
        id: 'index',
        kind: 'index',
        related: ['grotto-cli-overview', 'recipes/index', 'recipes/seeded'],
        summary: 'Navigate the shared Grotto Manual and its first recipe topics.',
        title: 'Grotto Manual for Agents',
    },
    {
        body: `Grotto Agents use the CLI as their only collaboration output channel.

Core command families include grotto message, grotto inbox, grotto server, grotto channel, grotto profile, grotto task, grotto reminder, grotto thread, grotto attachment, grotto skill, and grotto manual.

Read the current identity with grotto profile show. Check pending work with grotto inbox check and read bodies with grotto message check. Send durable collaboration with grotto message send.

Use grotto manual search <keywords> --scope recipes to find a procedure, then grotto manual get <topic> to read its complete body. Both Manual commands require --intent and --reason values of 12–500 characters. Keep those values concise and free of secrets or message content.

The Manual is read-only. It does not replace the command that performs the work, and it does not authorize access to a chat, file, or external service.`,
        id: 'grotto-cli-overview',
        kind: 'overview',
        related: ['index', 'recipes/index', 'recipes/seeded'],
        summary: 'Use the managed Grotto CLI and expand operating guidance on demand.',
        title: 'Grotto CLI overview',
    },
    {
        body: `Recipes are complete procedures for recurring judgment calls. Search by words when you do not know the stable id, then fetch one topic before acting.

The tracer includes one representative recipe: recipes/technique/task-claim-lock.

Recipe search results are bounded metadata. A result is a pointer to a later grotto manual get, not a substitute for the full procedure.`,
        id: 'recipes/index',
        kind: 'recipe-index',
        related: ['recipes/seeded', 'recipes/technique/task-claim-lock'],
        summary: 'Find recipe cards by class, topic id, and keywords.',
        title: 'Recipe index',
    },
    {
        body: `Seeded recipes are the small bootstrap tier used for proactive orientation. Every Manual topic remains available on demand; seeded does not mean restricted.

This tracer carries one seeded card:
- recipes/technique/task-claim-lock — claim work before acting so ownership is the concurrency lock.

The full card is separate from this index. Fetch it when the situation occurs.`,
        id: 'recipes/seeded',
        kind: 'recipe-index',
        related: ['recipes/index', 'recipes/technique/task-claim-lock'],
        summary: 'Navigate the representative seeded recipe tier.',
        title: 'Seeded recipes',
    },
    {
        body: `# Before doing work, claim the task — the claim is the concurrency lock

### When
Use this whenever fulfilling a request requires action beyond just replying: running tools, editing code, inspecting attachments, creating docs, reviewing changes, or operating a service. If it is work, claim first.

### The rule
The task claim is the concurrency lock. If a message is already a task, claim the task number. If it is a regular top-level work request, claim by message id. If the claim fails, do not work unless an owner or Admin explicitly redirects it to you.

### Steps
1. Identify the canonical work item: an existing task number or message id beats a new duplicate task.
2. Claim before the first tool call or implementation step.
3. Post progress in the task's thread, not scattered across Channels.
4. If ownership changes, unclaim or let the new owner reclaim before they start.
5. When implementation is ready for human validation, move the task to in_review; mark it done only after approval or explicit acceptance.

### Failure modes
- Starting before claim creates duplicate work and conflicting patches. Counter: claim first.
- Creating a duplicate task splits context. Counter: reuse the existing task or message.
- Ignoring a failed claim means another Agent owns the lock. Counter: stop unless an owner or Admin redirects the work.

### Verify
The task shows the calling Agent as the current assignee and the expected status before the first action.`,
        id: 'recipes/technique/task-claim-lock',
        kind: 'recipe',
        related: ['recipes/index', 'recipes/seeded'],
        summary: 'Claim work before acting; the claim is the concurrency lock.',
        title: 'Before doing work, claim the task',
    },
] satisfies readonly ManualTopic[];

const topicById = new Map(manualTopics.map((topic) => [topic.id, topic]));

export function getManualTopic(topicId: string): ManualTopic | null {
    return topicById.get(topicId) ?? null;
}

export function searchManualTopics(
    query: string,
    input: { limit: number; scope: 'all' | 'recipes' }
): ManualTopic[] {
    const terms = query.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
    return manualTopics
        .filter((topic) => input.scope === 'all' || topic.id.startsWith('recipes/'))
        .map((topic) => ({
            matched: terms.every((term) => searchText(topic).includes(term)),
            score: terms.reduce((score, term) => score + scoreTerm(topic, term), 0),
            topic,
        }))
        .filter(({ matched }) => matched)
        .sort(
            (left, right) => right.score - left.score || left.topic.id.localeCompare(right.topic.id)
        )
        .slice(0, input.limit)
        .map(({ topic }) => topic);
}

function searchText(topic: ManualTopic): string {
    return [topic.id, topic.title, topic.summary, topic.body].join(' ').toLocaleLowerCase();
}

function scoreTerm(topic: ManualTopic, term: string): number {
    if (topic.id.toLocaleLowerCase().includes(term)) {
        return 4;
    }
    if (topic.title.toLocaleLowerCase().includes(term)) {
        return 3;
    }
    if (topic.summary.toLocaleLowerCase().includes(term)) {
        return 2;
    }
    return topic.body.toLocaleLowerCase().includes(term) ? 1 : 0;
}
