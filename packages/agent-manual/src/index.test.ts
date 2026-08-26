import { expect, test } from 'bun:test';
import {
    getManualTopic,
    type ManualRecipeTopic,
    manualTopics,
    searchManualTopics,
} from './index.ts';

const recipeIds = [
    'recipes/archetype/analyst',
    'recipes/archetype/designer',
    'recipes/archetype/operator',
    'recipes/archetype/pa-coordinator',
    'recipes/archetype/patrol',
    'recipes/archetype/verify-gate',
    'recipes/archetype/writer',
    'recipes/decision/lane-design',
    'recipes/decision/one-or-many',
    'recipes/decision/stake-strictness',
    'recipes/decision/when-to-ask-human',
    'recipes/pattern/coordinator-synthesis',
    'recipes/pattern/discuss-then-assign',
    'recipes/pattern/evidence-handoff',
    'recipes/pattern/gate-chain',
    'recipes/pattern/interview-fanout',
    'recipes/pattern/recurring-recovery',
    'recipes/pattern/shard-and-merge',
    'recipes/pattern/video-review-loop',
    'recipes/playbook/agent-creation',
    'recipes/playbook/billing-strictness',
    'recipes/playbook/content-pipeline',
    'recipes/technique/acceptance-surface',
    'recipes/technique/attachment-comments',
    'recipes/technique/group-chat-debug',
    'recipes/technique/html-artifact-discussion',
    'recipes/technique/memory-hygiene',
    'recipes/technique/preview-env',
    'recipes/technique/proof-of-work-receipts',
    'recipes/technique/reminder-cron',
    'recipes/technique/sent-zero',
    'recipes/technique/task-claim-lock',
    'recipes/technique/video-review',
] as const;

const seededIds = [
    'recipes/decision/one-or-many',
    'recipes/decision/stake-strictness',
    'recipes/decision/when-to-ask-human',
    'recipes/pattern/discuss-then-assign',
    'recipes/pattern/evidence-handoff',
    'recipes/pattern/recurring-recovery',
    'recipes/technique/html-artifact-discussion',
    'recipes/technique/preview-env',
    'recipes/technique/reminder-cron',
    'recipes/technique/sent-zero',
    'recipes/technique/task-claim-lock',
    'recipes/technique/video-review',
] as const;

function recipes(): ManualRecipeTopic[] {
    return manualTopics.filter((topic): topic is ManualRecipeTopic => topic.kind === 'recipe');
}

test('publishes the complete adapted corpus with source metadata', () => {
    const published = recipes();

    expect(published.map((topic) => topic.id)).toEqual([...recipeIds]);
    expect(new Set(published.map((topic) => topic.id)).size).toBe(33);
    expect(published.filter((topic) => topic.tier === 'seeded').map((topic) => topic.id)).toEqual([
        ...seededIds,
    ]);
    expect(published.filter((topic) => topic.tier === 'query')).toHaveLength(21);
    expect(published.filter((topic) => topic.class === 'archetype')).toHaveLength(7);
    expect(
        published
            .filter((topic) => topic.class === 'archetype')
            .every((topic) => topic.tier === 'query')
    ).toBe(true);
    expect(getManualTopic('technique/login-with-raft')).toBeNull();
    expect(getManualTopic('recipes/technique/login-with-raft')).toBeNull();
    expect(getManualTopic('recipes/technique/save-as-a-skill')).toBeNull();
});

test('keeps recipe graph metadata valid and product language truthful', () => {
    const topicIds = new Set(manualTopics.map((topic) => topic.id));
    const published = recipes();

    for (const topic of manualTopics) {
        expect(topic.title).not.toBe('');
        expect(topic.summary).not.toBe('');
        expect(topic.related.every((relatedId) => topicIds.has(relatedId))).toBe(true);
        expect(topic.body.length).toBeGreaterThan(100);
        if (topic.kind === 'recipe') {
            expect(topic.triggers.length).toBeGreaterThan(0);
            expect(topic.evidence).toBe('verified');
        }
    }

    for (const topic of published) {
        for (const [reference] of topic.body.matchAll(
            /\b(?:archetype|decision|pattern|playbook|technique)\/[a-z0-9-]+/gu
        )) {
            expect(topicIds.has(`recipes/${reference}`)).toBe(true);
        }
    }

    const corpus = JSON.stringify(manualTopics);
    expect(corpus).not.toMatch(/\b(raft|slock)\b/i);
    expect(corpus).not.toMatch(/login-with-raft|save-as-a-skill/i);
    expect(corpus).not.toMatch(/integration login/i);
});

test('keeps every published body faithful to its captured source card', async () => {
    for (const topic of recipes()) {
        if (topic.id === 'recipes/playbook/agent-creation') {
            // Native Grotto guidance has no captured Raft source card; its contract is below.
            continue;
        }
        const [, recipeClass, slug] = topic.id.split('/');
        const source = await Bun.file(
            new URL(
                `../../../specs/raft-alignment/raft-recipes/${recipeClass}--${slug}.md`,
                import.meta.url
            )
        ).text();
        const boundaries = [...source.matchAll(/^---$/gm)];
        const body = source
            .slice(boundaries[1].index + 3, boundaries[2]?.index ?? source.length)
            .trim();
        const adapted = body.replaceAll(/\bRaft\b/g, 'Grotto').replaceAll(/\braft\b/g, 'grotto');

        expect(topic.body).toBe(adapted);
    }
});

test('indexes enumerate every recipe and only the seeded tier', () => {
    const index = getManualTopic('recipes/index');
    const seeded = getManualTopic('recipes/seeded');

    expect(index?.kind).toBe('recipe-index');
    expect(seeded?.kind).toBe('recipe-index');
    for (const id of recipeIds) {
        expect(index?.body).toContain(id);
    }
    for (const id of seededIds) {
        expect(seeded?.body).toContain(id);
    }
    for (const topic of recipes().filter((topic) => topic.tier === 'query')) {
        expect(seeded?.body).not.toContain(topic.id);
    }
});

test('search matches metadata and content while respecting recipe scope and limits', () => {
    const archetypes = searchManualTopics('archetype', { limit: 20, scope: 'recipes' });
    const claim = searchManualTopics('should I claim this before starting', {
        limit: 1,
        scope: 'recipes',
    });
    const overview = searchManualTopics('operating guide', { limit: 20, scope: 'all' });

    expect(
        archetypes.filter((topic) => topic.kind === 'recipe' && topic.class === 'archetype')
    ).toHaveLength(7);
    expect(archetypes.every((topic) => topic.id.startsWith('recipes/'))).toBe(true);
    expect(archetypes.map((topic) => topic.id)).toContain('recipes/index');
    expect(
        searchManualTopics('seeded', { limit: 20, scope: 'recipes' }).map((topic) => topic.id)
    ).toContain('recipes/seeded');
    expect(claim.map((topic) => topic.id)).toEqual(['recipes/technique/task-claim-lock']);
    expect(overview.map((topic) => topic.id)).toContain('grotto-cli-overview');
});

test('returns the complete topic and preserves stable unknown-topic behavior', () => {
    const topic = getManualTopic('recipes/technique/task-claim-lock');

    expect(topic).toMatchObject({
        class: 'technique',
        evidence: 'verified',
        id: 'recipes/technique/task-claim-lock',
        tier: 'seeded',
        title: 'Before doing work, claim the task — the claim is the concurrency lock',
    });
    expect(topic?.body).toContain('The task claim is the concurrency lock.');
    expect(getManualTopic('recipes/no-such-topic')).toBeNull();
});

test('publishes the complete Agent-creation recipe as a composable capability contract', () => {
    const topic = getManualTopic('recipes/playbook/agent-creation');

    expect(topic?.kind).toBe('recipe');
    expect(topic?.tier).toBe('query');
    expect(topic?.body).toContain('grotto avatar generate');
    expect(topic?.body).toContain('grotto action prepare');
    expect(topic?.body).toContain('terminal action attention');
    expect(topic?.body).toContain('grotto message send');

    const body = topic?.body ?? '';
    expect(body.indexOf('grotto avatar generate')).toBeLessThan(
        body.indexOf('grotto action prepare')
    );
    expect(body.indexOf('grotto action prepare')).toBeLessThan(
        body.indexOf('terminal action attention')
    );
    expect(body.indexOf('terminal action attention')).toBeLessThan(
        body.indexOf('grotto message send')
    );
    expect(body).toMatch(/preserve.*name.*supplied/iu);
    expect(body).toMatch(/fun.*name/iu);
    expect(body).toMatch(/exactly one generation request/u);
    expect(body).toMatch(/exactly one native create-Agent action/u);
    expect(body).toMatch(/do not poll, sleep/iu);
    expect(body).toMatch(/empty bootstrap turn/iu);
});
