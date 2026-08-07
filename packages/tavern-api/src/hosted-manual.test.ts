import { expect, test } from 'bun:test';
import {
    hostedAgentManualGetResponseSchema,
    hostedAgentManualSearchResponseSchema,
    hostedAgentManualSearchResultSchema,
    hostedAgentManualTopicSchema,
} from './hosted-manual.ts';

const recipeTopic = {
    body: '# Claim the task\n',
    class: 'technique' as const,
    evidence: 'verified' as const,
    id: 'recipes/technique/task-claim-lock',
    industries: ['universal'],
    kind: 'recipe' as const,
    prereqs: ['task board or message id'],
    related: ['recipes/index'],
    summary: 'Claim canonical work before acting.',
    tier: 'seeded' as const,
    title: 'Claim the task before work',
    triggers: ['should I claim this before starting'],
};

const navigationTopic = {
    body: 'The shared Manual index.',
    id: 'index',
    kind: 'index' as const,
    related: ['grotto-cli-overview'],
    summary: 'Navigate the Manual.',
    title: 'Grotto Manual',
};

test('Manual topic schemas require recipe metadata and reject it on navigation topics', () => {
    expect(hostedAgentManualTopicSchema.safeParse(recipeTopic).success).toBe(true);
    expect(hostedAgentManualTopicSchema.safeParse(navigationTopic).success).toBe(true);
    expect(
        hostedAgentManualTopicSchema.safeParse({ ...recipeTopic, triggers: undefined }).success
    ).toBe(false);
    expect(
        hostedAgentManualTopicSchema.safeParse({ ...navigationTopic, class: 'technique' }).success
    ).toBe(false);
});

test('Manual get and search schemas preserve the same discriminated contract', () => {
    const { body: _recipeBody, related: _recipeRelated, ...recipeResult } = recipeTopic;
    const {
        body: _navigationBody,
        related: _navigationRelated,
        ...navigationResult
    } = navigationTopic;

    expect(hostedAgentManualGetResponseSchema.safeParse({ topic: recipeTopic }).success).toBe(true);
    expect(hostedAgentManualGetResponseSchema.safeParse({ topic: navigationTopic }).success).toBe(
        true
    );
    expect(hostedAgentManualSearchResultSchema.safeParse(recipeResult).success).toBe(true);
    expect(hostedAgentManualSearchResultSchema.safeParse(navigationResult).success).toBe(true);
    expect(
        hostedAgentManualSearchResultSchema.safeParse({ ...recipeResult, class: undefined }).success
    ).toBe(false);
    expect(
        hostedAgentManualSearchResultSchema.safeParse({ ...navigationResult, tier: 'seeded' })
            .success
    ).toBe(false);
    expect(
        hostedAgentManualSearchResponseSchema.safeParse({
            query: 'claim',
            results: [recipeResult, navigationResult],
            scope: 'all',
        }).success
    ).toBe(true);
});
