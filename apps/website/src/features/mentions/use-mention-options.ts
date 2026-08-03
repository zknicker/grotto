import { formatAgentReferenceTarget } from '@tavern/api/rich-references';
import * as React from 'react';
import { queryPolicy } from '../../lib/query-policy.ts';
import type { MentionInventoryOutput, MentionPathOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import type { MentionOption, MentionTrigger } from './mention-types.ts';

export function useMentionOptions({
    agentId,
    agentIds = [],
    query,
    agents,
    mentionableAgentIds = [],
    trigger,
}: {
    agentId: string;
    agentIds?: readonly string[];
    agents: MentionAgent[];
    mentionableAgentIds?: readonly string[];
    query: string;
    trigger: MentionTrigger | null;
}) {
    const debouncedPathQuery = useDebouncedValue(query, 150);
    const shouldQueryInventory = trigger === '$';
    const inventory = trpc.mention.inventory.useQuery(
        {
            ...(agentIds.length > 0 ? { agentIds: [...agentIds] } : {}),
        },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: shouldQueryInventory && agentIds.length > 0,
        }
    );
    const shouldSearchPaths = shouldQueryInventory && shouldSearchPathMentions(debouncedPathQuery);
    const paths = trpc.mention.paths.useQuery(
        {
            agentId: agentId || undefined,
            query: debouncedPathQuery,
        },
        {
            ...queryPolicy.agentRuntimeSnapshot,
            enabled: Boolean(agentId) && shouldSearchPaths,
        }
    );

    const options = React.useMemo(() => {
        return selectMentionOptionsForQuery({
            agents,
            inventoryData: inventory.data,
            mentionableAgentIds,
            pathData: paths.data,
            query,
        });
    }, [agents, inventory.data, mentionableAgentIds, paths.data, query]);

    return {
        isPathSearchLoading:
            shouldQueryInventory &&
            shouldSearchPathMentions(query) &&
            (debouncedPathQuery !== query || paths.isLoading || paths.isFetching),
        isPathSearchActive: shouldQueryInventory && shouldSearchPathMentions(query),
        options,
    };
}

export function selectMentionOptionsForQuery({
    agents = [],
    inventoryData,
    mentionableAgentIds = [],
    pathData,
    query,
}: {
    agents?: MentionAgent[];
    inventoryData?: MentionInventoryOutput;
    mentionableAgentIds?: readonly string[];
    pathData?: MentionPathOutput;
    query: string;
}) {
    const agentOptions = filterMentionOptionsForQuery(
        mentionableAgentIds.map((agentId) => buildAgentMentionOption({ agentId, agents })),
        query
    );
    const inventoryOptions = inventoryData
        ? filterMentionOptionsForQuery(inventoryData.options, query)
        : [];
    const pathOptions =
        pathData && normalizeQuery(pathData.query) === normalizeQuery(query)
            ? pathData.options
            : [];

    return [...agentOptions, ...inventoryOptions, ...pathOptions];
}

export function buildAgentMentionOption({
    agentId,
    agents,
}: {
    agentId: string;
    agents: MentionAgent[];
}): MentionOption {
    const agent = agents.find((entry) => entry.id === agentId);
    const label = agent?.name ?? agentId;
    const avatarUrl = agent?.avatarUrl ?? null;
    const primaryColor = agent?.effectivePrimaryColor ?? null;

    return {
        description: 'Agent in this chat',
        id: formatAgentReferenceTarget(agentId),
        insertText: label.startsWith('@') ? label : `@${label}`,
        kind: 'agent',
        label,
        // Appearance rides in metadata so mention chips can render the
        // agent's avatar without a live agent-list lookup (the composer
        // chip mounts in its own React root, outside app providers).
        metadata:
            avatarUrl || primaryColor
                ? { agentAvatarUrl: avatarUrl, agentColor: primaryColor }
                : undefined,
        projection: 'agent-reference',
        sourceLabel: 'Agents',
    };
}

export interface MentionAgent {
    avatarUrl?: string | null;
    effectivePrimaryColor?: string | null;
    id: string;
    name: string;
}

export function filterMentionOptionsForQuery(options: MentionOption[], query: string) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return options;
    }

    return options.filter((option) =>
        normalizeQuery(
            [option.label, option.insertText, option.id, option.description, option.sourceLabel]
                .filter(Boolean)
                .join(' ')
        ).includes(normalizedQuery)
    );
}

function normalizeQuery(value: string) {
    return value.trim().toLowerCase();
}

function shouldSearchPathMentions(query: string) {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
        return false;
    }

    return (
        normalizedQuery.includes('/') ||
        normalizedQuery.startsWith('.') ||
        normalizedQuery.startsWith('~') ||
        /\.[a-z0-9]+$/u.test(normalizedQuery) ||
        normalizedQuery.length >= 3
    );
}

function useDebouncedValue(value: string, delayMs: number) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [delayMs, value]);

    return debouncedValue;
}
