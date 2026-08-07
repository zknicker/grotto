import type { ManualDeliveryTier, ManualRecipeClass, ManualRecipeTopic } from './types.ts';

export interface ManualRecipeSource {
    body: string;
    class: ManualRecipeClass;
    industries: string[];
    prereqs: string[];
    related: string[];
    slug: string;
    summary: string;
    tier: ManualDeliveryTier;
    title: string;
    triggers: string[];
}

export function createManualRecipe(source: ManualRecipeSource): ManualRecipeTopic {
    return {
        body: source.body.trim(),
        class: source.class,
        evidence: 'verified',
        id: `recipes/${source.class}/${source.slug}`,
        industries: source.industries,
        kind: 'recipe',
        prereqs: source.prereqs,
        related: source.related.map((id) => `recipes/${id}`),
        summary: source.summary,
        tier: source.tier,
        title: source.title,
        triggers: source.triggers,
    };
}
