import { parseAgentReferenceTarget, parseTavernRichReferences } from '@tavern/api/rich-references';
import { normalizeMentions } from './mention-text.ts';
import type { Mention } from './mention-types.ts';

export function readMentionsFromMarkdown(content: string) {
    return normalizeMentions(
        content,
        parseTavernRichReferences(content).map((reference) => ({ ...reference }))
    );
}

export interface AgentMentionAppearance {
    avatarUrl: string | null;
    primaryColor: string | null;
}

// Saved messages carry no appearance metadata (content is the source of
// truth), so transcript surfaces resolve each agent mention's avatar and color
// live from the agent record before rendering chips.
export function applyAgentMentionAppearance(
    mentions: readonly Mention[],
    lookupAgentAppearance: (agentId: string | null | undefined) => AgentMentionAppearance
): Mention[] {
    return mentions.map((mention) => {
        if (mention.kind !== 'agent') {
            return mention;
        }

        const agentId = parseAgentReferenceTarget(mention.id);
        const appearance = lookupAgentAppearance(agentId);

        if (appearance.avatarUrl === null && appearance.primaryColor === null) {
            return mention;
        }

        return {
            ...mention,
            metadata: {
                ...mention.metadata,
                agentAvatarUrl: appearance.avatarUrl,
                agentColor: appearance.primaryColor,
            },
        };
    });
}
