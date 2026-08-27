import {
    formatAgentReferenceTarget,
    formatChatReferenceTarget,
    parseAgentReferenceTarget,
    parseChatReferenceTarget,
    parseGrottoRichReferences,
} from '@grotto/api';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { agentsTable, chatsTable } from '../postgres/schema.ts';

export interface AgentReferenceTarget {
    handle: string;
    id: string;
}

export interface ChatReferenceTarget {
    id: string;
    name: string;
}

interface ReferenceRange {
    end: number;
    start: number;
}

/**
 * Resolves the live Server directory once, then stores only immutable targets
 * in the Agent-authored message. Retired Agents and deleted Channels are not
 * eligible. Channel lookup is Server-wide label resolution; target routing and
 * delivery still enforce the Agent's Chat access separately.
 */
export async function canonicalizeAgentMessageContentForPersistence(
    db: GrottoDatabase,
    input: { content: string; existingContent?: string; serverId: string }
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
        agents,
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
    const protectedRanges = readProtectedRanges(content);
    const replacements: Array<{ end: number; start: number; text: string }> = [];
    const tokenPattern = /[@#][A-Za-z0-9][A-Za-z0-9_-]{0,31}/gu;

    for (const match of content.matchAll(tokenPattern)) {
        const token = match[0];
        const start = match.index;
        if (!(token && start !== undefined)) {
            continue;
        }
        const end = start + token.length;
        if (
            isProtectedRange(protectedRanges, start, end) ||
            isInsidePlainUrl(content, start) ||
            !hasTokenBoundary(content[start - 1]) ||
            !hasTokenBoundary(content[end])
        ) {
            continue;
        }

        const key = token.slice(1).toLocaleLowerCase('en-US');
        const id = token.startsWith('@') ? agentIds.get(key) : channelIds.get(key);
        if (!id) {
            continue;
        }

        const target = token.startsWith('@')
            ? formatAgentReferenceTarget(id)
            : formatChatReferenceTarget(id);
        replacements.push({
            end,
            start,
            text: `[${token}](${target})`,
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

    for (const reference of parseGrottoRichReferences(content)) {
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

function uniqueTargetMap<T extends { id: string }>(targets: T[], keyOf: (target: T) => string) {
    const result = new Map<string, string | null>();
    for (const target of targets) {
        const key = keyOf(target).toLocaleLowerCase('en-US');
        if (result.has(key)) {
            result.set(key, null);
            continue;
        }
        result.set(key, target.id);
    }
    return result;
}

function hasTokenBoundary(character: string | undefined) {
    return !(character && /[-A-Za-z0-9_@#]/u.test(character));
}

function isInsidePlainUrl(content: string, start: number) {
    return /(?:https?:\/\/|www\.)[^\s]*$/iu.test(content.slice(0, start));
}

function readProtectedRanges(content: string): ReferenceRange[] {
    const ranges = readMarkdownLinkRanges(content);
    const fences = readFenceRanges(content);
    ranges.push(...fences);
    ranges.push(...readInlineCodeRanges(content, fences));
    return mergeRanges(ranges);
}

function readMarkdownLinkRanges(content: string): ReferenceRange[] {
    const ranges: ReferenceRange[] = [];
    const linkPattern = /!?\[[^\]\n]*\]\([^)\n]*\)/gu;
    for (const match of content.matchAll(linkPattern)) {
        if (match[0] && match.index !== undefined) {
            ranges.push({ end: match.index + match[0].length, start: match.index });
        }
    }
    return ranges;
}

function readFenceRanges(content: string): ReferenceRange[] {
    const ranges: ReferenceRange[] = [];
    let fence: { character: string; length: number; start: number } | null = null;
    let lineStart = 0;

    while (lineStart <= content.length) {
        const newline = content.indexOf('\n', lineStart);
        const lineEnd = newline === -1 ? content.length : newline;
        const line = content.slice(lineStart, lineEnd);
        const marker = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/u)?.[1];

        if (marker) {
            if (!fence) {
                fence = { character: marker[0], length: marker.length, start: lineStart };
            } else if (marker[0] === fence.character && marker.length >= fence.length) {
                ranges.push({
                    end: newline === -1 ? content.length : newline + 1,
                    start: fence.start,
                });
                fence = null;
            }
        }

        if (newline === -1) {
            break;
        }
        lineStart = newline + 1;
    }

    if (fence) {
        ranges.push({ end: content.length, start: fence.start });
    }
    return ranges;
}

function readInlineCodeRanges(content: string, fences: ReferenceRange[]): ReferenceRange[] {
    const ranges: ReferenceRange[] = [];
    let index = 0;
    while (index < content.length) {
        if (isProtectedRange(fences, index, index + 1)) {
            index += 1;
            continue;
        }
        if (content[index] !== '`') {
            index += 1;
            continue;
        }

        const start = index;
        while (content[index] === '`') {
            index += 1;
        }
        const length = index - start;
        const closing = content.indexOf('`'.repeat(length), index);
        const lineEnd = content.indexOf('\n', index);
        if (closing === -1 || (lineEnd !== -1 && closing > lineEnd)) {
            continue;
        }
        const end = closing + length;
        ranges.push({ end, start });
        index = end;
    }
    return ranges;
}

function isProtectedRange(ranges: ReferenceRange[], start: number, end: number) {
    return ranges.some((range) => start >= range.start && end <= range.end);
}

function mergeRanges(ranges: ReferenceRange[]) {
    const sorted = [...ranges].sort((left, right) => left.start - right.start);
    const merged: ReferenceRange[] = [];
    for (const range of sorted) {
        const previous = merged.at(-1);
        if (previous && range.start <= previous.end) {
            previous.end = Math.max(previous.end, range.end);
        } else {
            merged.push({ ...range });
        }
    }
    return merged;
}
