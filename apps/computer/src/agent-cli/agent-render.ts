import type { TavernAgentSendResponse } from '@tavern/api';
import type { z } from 'zod';
import type {
    AgentCliMessage,
    agentChannelMembersSchema,
    agentChannelSchema,
    agentHistoryResponseSchema,
    agentServerInfoSchema,
} from './agent-api-schemas.ts';
import { AgentCliError } from './agent-error.ts';
import {
    formatDeliveryEnvelope,
    formatHistoryLine,
    formatLocalTime,
    formatSender,
    shortMessageId,
} from './agent-format.ts';

type AgentSendResponse = TavernAgentSendResponse;
type AgentHistoryResponse = z.infer<typeof agentHistoryResponseSchema>;
type AgentServerInfo = z.infer<typeof agentServerInfoSchema>;
type AgentChannel = z.infer<typeof agentChannelSchema>;
type AgentChannelMembers = z.infer<typeof agentChannelMembersSchema>;

export function renderSendResponse(target: string, response: AgentSendResponse): string {
    return response.state === 'sent'
        ? renderSent(target, response.message, response.recentUnread)
        : renderHeld(target, response);
}

export function renderHistory(response: AgentHistoryResponse): string {
    const lines = [
        `## Message History for ${response.target} (${response.messages.length} messages)`,
        `Last read through seq ${response.last_read.after}; use --after ${response.last_read.unread_after} to see only unread messages.`,
        '',
        ...response.messages.map(formatHistoryLine),
    ];
    const footer = historyFooter(response);
    if (footer) {
        lines.push('', footer);
    }
    return `${lines.join('\n')}\n`;
}

export function renderSearchResult(
    source: string,
    message: AgentCliMessage,
    query: string
): string {
    return [
        `<result ref="msg:${message.id}">`,
        `Source: ${source}`,
        `Sender: ${formatSender(message)}`,
        `Time: ${formatLocalTime(message.created_at)}`,
        '<preview>',
        preview(message.content, query),
        '</preview>',
        '</result>',
    ].join('\n');
}

export function renderSearchFooter(): string {
    return 'Use grotto message read --target <target> --around <id> to read surrounding context.';
}

export function renderServerInfo(
    response: AgentServerInfo,
    filters: { joined?: boolean; query?: string } = {}
): string {
    const lines = [
        '## Server summary',
        `${response.total.channels} channels · ${response.total.agents} agents · ${response.total.humans} humans`,
        'Use --channels, --agents, --humans, --joined, or --query <text> to narrow this view.',
    ];
    if (response.channels.length > 0) {
        lines.push(
            '',
            '## Server Channels',
            ...response.channels.map(
                (channel) =>
                    `#${channel.handle} [${channel.joined ? 'joined' : 'not joined'}]${descriptionSuffix(channel.description)}`
            )
        );
    }
    if (response.agents.length > 0) {
        lines.push('', '## Server Agents', ...response.agents.map(renderPerson));
    }
    if (response.humans.length > 0) {
        lines.push('', '## Server Humans', ...response.humans.map(renderPerson));
    }
    const nextCommands = serverInfoNextCommands(response, filters);
    if (nextCommands.length > 0) {
        lines.push('', ...nextCommands);
    }
    return `${lines.join('\n')}\n`;
}

export function renderChannelInfo(channel: AgentChannel): string {
    return [
        `## Channel #${channel.handle}`,
        `Joined: ${channel.joined ? 'yes' : 'no'}`,
        `Description: ${channel.description ?? 'No description.'}`,
        `Members: ${channel.memberCount}`,
        '',
        `Use grotto channel members "#${channel.handle}" to list members.`,
        '',
    ].join('\n');
}

export function renderChannelMembers(response: AgentChannelMembers): string {
    const members = response.members.map((member) => {
        if (!member.handle) {
            throw new AgentCliError('INVALID_JSON_RESPONSE', 'Channel member handle is missing.');
        }
        const handle = member.handle;
        return `@${handle} [${member.role}]${descriptionSuffix(member.description)}`;
    });
    return [
        `## Channel Members for ${response.target} (${members.length} members)`,
        ...members,
        '',
    ].join('\n');
}

function renderSent(
    target: string,
    message: AgentCliMessage,
    unread: Array<{ message: AgentCliMessage; target: string }>
): string {
    const lines = [`Message sent to ${target}. Message ID: ${message.id}`];
    if (!isThreadTarget(target)) {
        lines.push(
            `(to reply in this message's thread, use target "${target}:${shortMessageId(message.id)}")`
        );
    }
    if (unread.length > 0) {
        lines.push(
            '',
            '--- New messages you may have missed ---',
            ...unread.map((row) => formatDeliveryEnvelope(row.target, row.message))
        );
    }
    return `${lines.join('\n')}\n`;
}

function renderHeld(
    target: string,
    response: Extract<AgentSendResponse, { state: 'held' }>
): string {
    const shown = response.shownMessages.length;
    const lines = [
        `Freshness hold: showing latest ${shown} of ${response.newMessageCount} newer messages.`,
    ];
    if (response.omittedMessageCount > 0) {
        lines.push(
            `${response.omittedMessageCount} earlier newer messages were omitted. Use grotto message read --target "${target}" to review them.`
        );
    }
    lines.push(
        'Your message has been saved as a draft. Review the bounded context shown here, then choose one path.'
    );
    if (response.formalMentionCount > 0) {
        lines.push(
            `You were formally mentioned in ${response.formalMentionCount} of these newer messages.`
        );
    }
    lines.push('', ...response.shownMessages.map(formatHistoryLine), '', 'Choose one path:');
    lines.push(
        `- Revise: send a new plain message to ${target}; it replaces the saved draft.`,
        `- Send unchanged: grotto message send --send-draft --target "${target}"`,
        '- Stay silent: do nothing.'
    );
    if (response.continueAnywaySuggested) {
        lines.push(
            `- After repeated holds, send unchanged anyway: grotto message send --send-draft --anyway --target "${target}"`
        );
    }
    return `${lines.join('\n')}\n`;
}

function historyFooter(response: AgentHistoryResponse): string | null {
    if (!response.has_more) {
        return null;
    }
    const minimum = response.messages[0]?.sequence;
    const maximum = response.messages.at(-1)?.sequence;
    const teachings = [
        ...(response.has_older && minimum !== undefined
            ? [`Use --before ${minimum} to see older messages.`]
            : []),
        ...(response.has_newer && maximum !== undefined
            ? [`Use --after ${maximum} to see newer messages.`]
            : []),
    ];
    return `--- ${response.messages.length} messages shown. ${teachings.join(' ')} ---`;
}

function preview(content: string, query: string): string {
    const matchAt = content.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    if (matchAt < 0 || query.length === 0) {
        const end = Math.min(content.length, 200);
        return `${escapeXml(content.slice(0, end))}${end < content.length ? '<omit />' : ''}`;
    }
    const start = Math.max(0, matchAt - 80);
    const end = Math.min(content.length, matchAt + query.length + 120);
    return [
        start > 0 ? '<omit />' : '',
        escapeXml(content.slice(start, matchAt)),
        `<match>${escapeXml(content.slice(matchAt, matchAt + query.length))}</match>`,
        escapeXml(content.slice(matchAt + query.length, end)),
        end < content.length ? '<omit />' : '',
    ].join('');
}

function renderPerson(person: { description: string | null; handle: string }): string {
    return `@${person.handle}${descriptionSuffix(person.description)}`;
}

function descriptionSuffix(description: string | null): string {
    return description ? ` — ${description}` : '';
}

function serverInfoNextCommands(
    response: AgentServerInfo,
    filters: { joined?: boolean; query?: string }
): string[] {
    const sectionFlags = [
        ['channels', '--channels'],
        ['agents', '--agents'],
        ['humans', '--humans'],
    ] as const;
    return sectionFlags.flatMap(([section, flag]) => {
        if (!response.hasMore[section]) {
            return [];
        }
        const command = [
            'grotto server info',
            flag,
            ...(filters.joined ? ['--joined'] : []),
            ...(filters.query ? ['--query', quoteCommandValue(filters.query)] : []),
            `--offset ${response.offset + response.limit}`,
            `--limit ${response.limit}`,
        ];
        return [`Next: ${command.join(' ')}`];
    });
}

function quoteCommandValue(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function escapeXml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function isThreadTarget(target: string): boolean {
    return /^#[^:]+:[^:]+$/u.test(target) || /^dm:@[^:]+:[^:]+$/u.test(target);
}
