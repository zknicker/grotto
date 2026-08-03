import { Spinner } from '@heroui/react';
import { ChainOfThought, ChatTool, type ToolPartState } from '@heroui-pro/react';
import * as React from 'react';
import { useChatTool } from '../../hooks/chats/use-chat-tool.ts';
import { useSessionTool } from '../../hooks/sessions/use-session-tool.ts';
import { SessionLinkButton } from '../sessions/session-link-button.tsx';
import { getSessionRelationshipName } from '../sessions/session-relationship.ts';
import { formatToolDuration, hasErrorStatus } from '../sessions/tools/tool-ui.ts';
import { workerKindConfig } from '../workers/config.ts';
import type { ActivityItem } from './chat-transcript-activity-utils.ts';
import { getSystemBody, getSystemSummary } from './chat-transcript-system-step.tsx';
import { ToolStep } from './chat-transcript-tool-step.tsx';
import { getToolTarget } from './tool-steps/tool-summary.tsx';
import type { ToolStepRow } from './tool-steps/types.ts';

/**
 * One activity group inside the turn drawer, rendered with the stock Pro AI
 * components: tool calls as ChatTool cards (args/result fetched on expand),
 * everything else — thinking, system evidence, workers — as ChainOfThought
 * timelines. Clarifications and changed-files chips keep their interactive
 * renderers.
 */
export function DrawerActivityGroup({
    chatId,
    items,
    turnActive = false,
}: {
    chatId?: string;
    items: ActivityItem[];
    turnActive?: boolean;
}) {
    const blocks = buildDrawerBlocks(items);

    return blocks.map((block, index) => {
        const lastBlock = index === blocks.length - 1;

        if (block.kind === 'tool') {
            return <DrawerToolCall chatId={chatId} key={block.row.id} row={block.row} />;
        }

        if (block.kind === 'passthrough') {
            return (
                <ToolStep
                    chatId={chatId}
                    index={0}
                    isLast
                    key={block.item.row.id}
                    row={block.item.row as ToolStepRow}
                />
            );
        }

        return (
            <DrawerSteps
                items={block.items}
                key={block.items[0]?.row.id ?? `steps:${String(index)}`}
                streaming={turnActive && lastBlock}
            />
        );
    });
}

type DrawerBlock =
    | { kind: 'passthrough'; item: ActivityItem }
    | { kind: 'steps'; items: ActivityItem[] }
    | { kind: 'tool'; row: ToolStepRow };

function buildDrawerBlocks(items: ActivityItem[]) {
    const blocks: DrawerBlock[] = [];

    for (const item of items) {
        if (item.row.kind === 'tool') {
            if (item.row.clarification || item.row.toolCall.name === 'workspace_changes') {
                blocks.push({ item, kind: 'passthrough' });
            } else {
                blocks.push({ kind: 'tool', row: item.row });
            }
            continue;
        }

        const last = blocks.at(-1);

        if (last?.kind === 'steps') {
            last.items.push(item);
        } else {
            blocks.push({ items: [item], kind: 'steps' });
        }
    }

    return blocks;
}

function DrawerSteps({ items, streaming }: { items: ActivityItem[]; streaming: boolean }) {
    const thinkingOnly = items.every(
        (item) => item.row.kind === 'system' && item.row.systemKind === 'thinking'
    );

    return (
        <ChainOfThought defaultExpanded isStreaming={streaming}>
            <ChainOfThought.Trigger>
                {thinkingOnly ? 'Thinking' : 'Working notes'}
            </ChainOfThought.Trigger>
            <ChainOfThought.Content>
                <ChainOfThought.Steps>
                    {items.map((item) => (
                        <DrawerStep item={item} key={item.row.id} />
                    ))}
                </ChainOfThought.Steps>
            </ChainOfThought.Content>
        </ChainOfThought>
    );
}

function DrawerStep({ item }: { item: ActivityItem }) {
    if (item.row.kind === 'system') {
        const summary = getSystemSummary(item.row);
        const body = getSystemBody({ row: item.row });

        return (
            <ChainOfThought.Step label={summary.label}>
                {summary.description ? (
                    <p className="whitespace-pre-wrap break-words">{summary.description}</p>
                ) : null}
                {body}
            </ChainOfThought.Step>
        );
    }

    if (item.row.kind === 'worker') {
        const config = workerKindConfig[item.row.worker.kind];

        return (
            <ChainOfThought.Step label={`${config.label} — ${item.row.worker.title}`}>
                {item.row.worker.detail}
            </ChainOfThought.Step>
        );
    }

    return null;
}

function DrawerToolCall({ chatId, row }: { chatId?: string; row: ToolStepRow }) {
    const [expanded, setExpanded] = React.useState(false);
    // The row only carries the tool summary; args and result load once the
    // card is first expanded and stay cached after that.
    const [inspected, setInspected] = React.useState(false);
    const chatSource = Boolean(chatId);
    const sessionSource = !chatSource && Boolean(row.sessionKey && row.toolCall.callId);
    const chatQuery = useChatTool(
        { activityId: row.id, chatId: chatId ?? '' },
        { enabled: inspected && chatSource }
    );
    const sessionQuery = useSessionTool(
        { sessionKey: row.sessionKey ?? '', toolCallId: row.toolCall.callId ?? '' },
        { enabled: inspected && sessionSource }
    );
    const detail = chatSource ? chatQuery.data : sessionSource ? sessionQuery.data : null;
    const detailPending =
        inspected && (chatSource ? chatQuery.isPending : sessionSource && sessionQuery.isPending);
    const duration = formatToolDuration(row.startedAt, row.completedAt);

    return (
        <ChatTool
            isExpanded={expanded}
            onExpandedChange={(next) => {
                setExpanded(next);

                if (next) {
                    setInspected(true);
                }
            }}
            state={resolveToolPartState(row)}
            toolName={row.toolCall.name}
        >
            <ChatTool.Trigger>
                <span className="flex min-w-0 items-center gap-2">
                    <ChatTool.StatusIcon />
                    <span className="min-w-0 truncate">{getToolTarget(row)}</span>
                </span>
                {duration ? (
                    <span className="shrink-0 font-mono text-muted tabular-nums">{duration}</span>
                ) : null}
            </ChatTool.Trigger>
            <ChatTool.Content>
                {detailPending ? (
                    <div className="flex items-center gap-2 p-2 text-muted text-xs">
                        <Spinner color="current" size="sm" />
                        Loading tool detail
                    </div>
                ) : (
                    <>
                        <ChatTool.Args input={detail?.arguments ?? undefined} label="Input" />
                        <ChatTool.Result label="Result" value={detail?.result ?? undefined} />
                    </>
                )}
                {hasErrorStatus(row.toolCall.status) ? (
                    <ChatTool.Error errorText={row.toolCall.status ?? 'Failed'} />
                ) : null}
                {row.spawnedRelationships.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-1">
                        {row.spawnedRelationships.map((relationship) => (
                            <SessionLinkButton
                                className="max-w-full px-2.5 py-1.5"
                                key={relationship.id}
                                label="Spawned Session"
                                sessionKey={relationship.relatedSession.key}
                                subtitle="Open related session"
                                title={getSessionRelationshipName(relationship)}
                                tone="sky"
                            />
                        ))}
                    </div>
                ) : null}
            </ChatTool.Content>
        </ChatTool>
    );
}

function resolveToolPartState(row: ToolStepRow): ToolPartState {
    if (hasErrorStatus(row.toolCall.status)) {
        return 'output-error';
    }

    if (!row.completedAt) {
        return 'input-available';
    }

    return 'output-available';
}
