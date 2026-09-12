import {
    formatAgentReferenceTarget,
    formatChatReferenceTarget,
    parseAgentReferenceTarget,
    parseChatReferenceTarget,
    parseHausRichReferences,
} from '@haus/api';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { HausDatabase } from '../postgres/connection.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';
import { readBareReferenceTokens } from './bare-reference-tokens.ts';

export interface AgentReferenceTarget {
    handle: string;
    id: string;
}

export interface ChatReferenceTarget {
    id: string;
    name: string;
}

/**
 * Resolves the live Server directory once, then stores only immutable targets
 * in the Agent-authored message. Retired Agents and deleted Channels are not
 * eligible. Channel lookup is Server-wide label resolution; target routing and
 * delivery still enforce the Agent's Chat access separately.
 *
 * `additionalAgents` names an Agent the directory cannot know yet — the one
 * being created in this same transaction, whose announcement is the Message
 * being written.
 */
export async function canonicalizeAgentMessageContentForPersistence(
    db: HausDatabase,
    input: {
        additionalAgents?: AgentReferenceTarget[];
        content: string;
        existingContent?: string;
        serverId: string;
    }
): Promise<string> {
    const preferred = readExistingReferenceTargets(input.existingContent);
    if (input.existingContent !== undefined) {
        return canonicalizeAgentMessageContent(input.content, {
            agents: preferred.agents,
            channels: preferred.channels,
        });
    }

    const [agents, channels] = await Promise.all([
        db
            .select({ handle: agentsTable.handle, id: agentsTable.id })
            .from(agentsTable)
            .where(and(eq(agentsTable.serverId, input.serverId), isNull(agentsTable.retiredAt))),
        db
            .select({ id: chatsTable.id, name: chatsTable.name })
            .from(chatsTable)
            .where(
                and(
                    eq(chatsTable.serverId, input.serverId),
                    eq(chatsTable.kind, 'channel'),
                    isNull(chatsTable.deletedAt),
                    isNotNull(chatsTable.name)
                )
            )
            .then((rows) =>
                rows.flatMap((row) => (row.name ? [{ id: row.id, name: row.name }] : []))
            ),
    ]);

    return canonicalizeAgentMessageContent(input.content, {
        agents: [...agents, ...(input.additionalAgents ?? [])],
        channels,
    });
}

/** Rewrites only known bare Agent/channel references outside protected Markdown. */
export function canonicalizeAgentMessageContent(
    content: string,
    input: {
        agents: AgentReferenceTarget[];
        channels: ChatReferenceTarget[];
    }
): string {
    const agentIds = uniqueTargetMap(input.agents, (agent) => agent.handle);
    const channelIds = uniqueTargetMap(input.channels, (channel) => channel.name);
    const replacements: Array<{ end: number; start: number; text: string }> = [];

    for (const token of readBareReferenceTokens(content)) {
        const id = token.sigil === '@' ? agentIds.get(token.key) : channelIds.get(token.key);
        if (!id) {
            continue;
        }

        const target =
            token.sigil === '@' ? formatAgentReferenceTarget(id) : formatChatReferenceTarget(id);
        replacements.push({
            end: token.end,
            start: token.start,
            text: `[${token.text}](${target})`,
        });
    }

    if (replacements.length === 0) {
        return content;
    }

    let result = '';
    let cursor = 0;
    for (const replacement of replacements) {
        result += content.slice(cursor, replacement.start);
        result += replacement.text;
        cursor = replacement.end;
    }
    return result + content.slice(cursor);
}

function readExistingReferenceTargets(content: string | undefined) {
    const agents: AgentReferenceTarget[] = [];
    const channels: ChatReferenceTarget[] = [];
    if (!content) {
        return { agents, channels };
    }

    for (const reference of parseHausRichReferences(content)) {
        if (reference.kind === 'agent') {
            const id = parseAgentReferenceTarget(reference.id);
            if (id) {
                agents.push({ handle: reference.label, id });
            }
        } else if (reference.kind === 'chat') {
            const id = parseChatReferenceTarget(reference.id);
            if (id) {
                channels.push({ id, name: reference.label });
            }
        }
    }
    return { agents, channels };
}

/**
 * One label to one target, `null` when the label is genuinely ambiguous.
 *
 * A stored Message that names the same teammate twice yields the same target
 * twice, and a repeat of one target is not ambiguity: only two different ids
 * under one label disqualify it.
 */
function uniqueTargetMap<T extends { id: string }>(targets: T[], keyOf: (target: T) => string) {
    const result = new Map<string, string | null>();
    for (const target of targets) {
        const key = keyOf(target).toLocaleLowerCase('en-US');
        const seen = result.get(key);
        if (seen !== undefined && seen !== target.id) {
            result.set(key, null);
            continue;
        }
        result.set(key, target.id);
    }
    return result;
}
