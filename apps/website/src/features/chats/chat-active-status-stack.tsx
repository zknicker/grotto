import type { AgentCharacter } from '@tavern/api/agent-appearance';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import type { ChatActiveReply, ChatTimelineState } from '../../hooks/chats/chat-timeline-state.ts';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { getAgentStatusLabel, resolveAgentStatusExpression } from './agent-status-expression.ts';
import { AgentStatusIndicator } from './agent-status-indicator.tsx';
import {
    findActiveTurnEntry,
    findLastAgentTurnEntry,
    formatTurnWorkSummary,
} from './chat-active-turn.ts';
import {
    StatusRiseRow,
    StatusSwap,
    statusRiseOut,
    statusSwapKeyFor,
    useMinimumDwell,
} from './chat-status-motion.tsx';
import { getWorkGroupIcon, isActivityItem } from './chat-transcript-activity-utils.ts';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { ChatTurnDrawer } from './chat-turn-drawer.tsx';
import { useStableWorkGroupLabel, WorkGroupHeaderText } from './work-group-header-text.tsx';

interface ChatActiveStatusStackProps {
    activeReplies: readonly ChatActiveReply[];
    agents: AgentListOutput['agents'];
    chatId?: string;
    className?: string;
    rows: TranscriptRow[];
    // Live execution evidence keyed by run — work summaries and the live
    // drawer read from it, since execution rows never ride the timeline
    // (specs/chat-timeline.md).
    turnEvidence?: ChatTimelineState['turnEvidence'];
    variant?: 'compact' | 'detail';
}

// One status row per agent seat. A seat can briefly hold two live runs — a
// mention queues the next turn while the current one finishes — but its turns
// execute serially, so the oldest run represents the seat and the queued run
// takes over the same row when it starts.
export function ChatActiveStatusStack({
    activeReplies,
    agents,
    chatId,
    className,
    rows,
    turnEvidence = {},
    variant = 'compact',
}: ChatActiveStatusStackProps) {
    const [drawerRunId, setDrawerRunId] = React.useState<string | null>(null);
    const liveSeatReplies = React.useMemo(
        () => coalesceRepliesByAgent(activeReplies),
        [activeReplies]
    );
    // Hold each seat row for a minimum dwell so its enter animation always
    // completes and near-instant turns never flash in and out.
    const seatReplies = useMinimumDwell(liveSeatReplies, seatReplyKey);
    const rowsWithEvidence = React.useMemo(() => {
        const evidence = Object.values(turnEvidence).flat();

        return evidence.length > 0 ? [...rows, ...evidence] : rows;
    }, [rows, turnEvidence]);
    const drawerReply = drawerRunId
        ? (activeReplies.find((reply) => reply.runId === drawerRunId) ?? null)
        : null;
    const drawerAgent = drawerReply
        ? (agents.find((entry) => entry.id === drawerReply.agentId) ?? null)
        : null;
    // The turn drawer must outlive the status row: if it is open when its
    // turn completes, it keeps showing the same turn (and the same agent
    // identity) from its durable rows instead of vanishing mid-read.
    const lastAgentRef = React.useRef<{
        character: AgentCharacter | null;
        color: string | null;
        name: string;
    }>({ character: null, color: null, name: 'Agent' });

    if (drawerAgent) {
        lastAgentRef.current = {
            character: drawerAgent.effectiveCharacter ?? null,
            color: drawerAgent.effectivePrimaryColor ?? null,
            name: drawerAgent.name,
        };
    }

    const drawerEntry = React.useMemo(() => {
        if (!drawerRunId) {
            return null;
        }

        return (
            findActiveTurnEntry({ activeReplies, rows: rowsWithEvidence, runId: drawerRunId }) ??
            findLastAgentTurnEntry({ rows: rowsWithEvidence, runId: drawerRunId })
        );
    }, [activeReplies, drawerRunId, rowsWithEvidence]);
    const drawerAgentName = drawerAgent?.name ?? lastAgentRef.current.name;
    const drawerAgentCharacter = drawerAgent?.effectiveCharacter ?? lastAgentRef.current.character;
    const drawerAgentColor = drawerAgent?.effectivePrimaryColor ?? lastAgentRef.current.color;

    // The detail surface floats this stack over the transcript's reserved
    // bottom padding (ChatDetailFooter), so appearing and disappearing rows
    // never resize the scroller viewport or move the reader.
    const hasActiveReplies = seatReplies.length > 0;

    return (
        <>
            <AnimatePresence>
                {hasActiveReplies ? (
                    <motion.section
                        animate={{ opacity: 1 }}
                        aria-label="Active agent status"
                        className={cn(
                            variant === 'compact'
                                ? 'border-r-[3px] border-r-border-subtle bg-card px-5 pt-1.5 pb-0.5'
                                : // Fades toward the transcript so scrolled content
                                  // slides under it without a hard seam above the
                                  // composer.
                                  'bg-gradient-to-t from-background via-background/85 to-transparent px-5 pt-2.5 pb-0.5',
                            className
                        )}
                        // Fade only: the last row's own exit carries the
                        // direction; a drifting section would fight it.
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        key="active-status"
                        transition={statusRiseOut}
                    >
                        <div className="flex w-full flex-col">
                            <AnimatePresence initial={false}>
                                {seatReplies.map((reply, index) => (
                                    // The clip wrapper hangs left of the row
                                    // (with matching inner padding) so the
                                    // agent face — which overflows its box
                                    // and sits at -ms-1 — never loses its
                                    // left edge to the clip. Keyed by seat so
                                    // a queued follow-up run takes over the
                                    // row in place instead of exit/enter
                                    // animating a duplicate indicator.
                                    <StatusRiseRow
                                        className="-ms-2"
                                        // Simultaneous dispatches cascade one
                                        // beat apart instead of landing as a
                                        // block.
                                        enterDelaySeconds={index * 0.05}
                                        innerClassName="py-0.5 ps-2"
                                        key={reply.agentId}
                                    >
                                        <ChatActiveStatusRow
                                            activeReplies={activeReplies}
                                            agents={agents}
                                            onViewDetails={() => setDrawerRunId(reply.runId)}
                                            reply={reply}
                                            rows={rowsWithEvidence}
                                        />
                                    </StatusRiseRow>
                                ))}
                            </AnimatePresence>
                        </div>
                    </motion.section>
                ) : null}
            </AnimatePresence>
            <ChatTurnDrawer
                agentCharacter={drawerAgentCharacter}
                agentColor={drawerAgentColor}
                agentName={drawerAgentName}
                chatId={chatId}
                entry={drawerEntry}
                onOpenChange={(open) => {
                    if (!open) {
                        setDrawerRunId(null);
                    }
                }}
                open={drawerRunId !== null}
                turnActive={drawerReply !== null}
            />
        </>
    );
}

function ChatActiveStatusRow({
    activeReplies,
    agents,
    onViewDetails,
    reply,
    rows,
}: {
    activeReplies: readonly ChatActiveReply[];
    agents: AgentListOutput['agents'];
    onViewDetails: () => void;
    reply: ChatActiveReply;
    rows: TranscriptRow[];
}) {
    const agent = agents.find((entry) => entry.id === reply.agentId) ?? null;
    const turnEntry = React.useMemo(
        () => findActiveTurnEntry({ activeReplies, rows, runId: reply.runId }),
        [activeReplies, reply.runId, rows]
    );

    return (
        <ChatActiveStatusItem
            activeReply={reply}
            agentCharacter={agent?.effectiveCharacter ?? null}
            agentName={agent?.name ?? 'Agent'}
            agentPrimaryColor={agent?.effectivePrimaryColor ?? null}
            onViewDetails={onViewDetails}
            rows={rows}
            workIcon={getWorkGroupIcon(turnEntry?.items.filter(isActivityItem) ?? [])}
            workSummary={formatTurnWorkSummary(turnEntry)}
        />
    );
}

function ChatActiveStatusItem({
    activeReply,
    agentCharacter,
    agentName,
    agentPrimaryColor,
    onViewDetails,
    rows,
    workIcon,
    workSummary,
}: {
    activeReply: ChatActiveReply;
    agentCharacter: AgentCharacter | null;
    agentName: string;
    agentPrimaryColor: string | null;
    onViewDetails: () => void;
    rows: TranscriptRow[];
    workIcon: React.ComponentProps<typeof Icon>['icon'] | null;
    workSummary: string | null;
}) {
    // Dwell between summary changes so fast tool bursts read as discrete
    // updates; label changes roll in with the drawers' slot-text treatment.
    const stableSummary = useStableWorkGroupLabel(workSummary, true);
    const statusText = formatActiveStatusText({ activeReply, agentName, rows });

    return (
        <button
            className="group/status flex h-8 min-w-0 cursor-pointer items-center gap-2 text-left text-foreground-tertiary text-sm leading-5 transition-colors hover:text-muted-foreground"
            onClick={onViewDetails}
            title="View turn details"
            type="button"
        >
            <AgentStatusIndicator
                activeReply={activeReply}
                character={agentCharacter ?? 'none'}
                className="-ms-1"
                primaryColor={agentPrimaryColor}
                rows={rows}
                size={24}
            />
            <StatusSwap className="min-w-0 shrink-0 leading-5" swapKey={statusText}>
                <span className="thinking-indicator-text whitespace-nowrap">{statusText}</span>
            </StatusSwap>
            {stableSummary ? (
                <span className="flex h-5 min-w-0 items-center gap-1.5 text-foreground-quaternary leading-5 transition-colors group-hover/status:text-muted-foreground">
                    {workIcon ? (
                        <StatusSwap
                            className="size-3.5 shrink-0"
                            swapKey={statusSwapKeyFor(workIcon)}
                        >
                            <Icon className="size-3.5" icon={workIcon} strokeWidth={1.5} />
                        </StatusSwap>
                    ) : null}
                    <WorkGroupHeaderText isActive label={stableSummary} />
                </span>
            ) : null}
        </button>
    );
}

// activeReplies is startedAt-ordered, so the first reply per agent is the run
export function isQuietEvaluationReply(reply: ChatActiveReply) {
    return reply.trigger === 'evaluation' && (reply.text ?? '').trim().length === 0;
}

// Seat rows are keyed (and dwell-held) per agent.
function seatReplyKey(reply: ChatActiveReply) {
    return reply.agentId;
}

// executing now; later ones are queued behind it and inherit the row when the
// current run settles.
function coalesceRepliesByAgent(replies: readonly ChatActiveReply[]) {
    const seen = new Set<string>();

    return replies.filter((reply) => {
        // Peer-evaluation turns stay quiet until they stream reply text —
        // most end in NO_REPLY, and a thinking row would promise an answer
        // (specs/addressing.md). Presence still shows the agent as busy.
        if (isQuietEvaluationReply(reply)) {
            return false;
        }
        if (seen.has(reply.agentId)) {
            return false;
        }

        seen.add(reply.agentId);
        return true;
    });
}

export function formatActiveStatusText({
    activeReply,
    agentName,
    rows,
}: {
    activeReply: ChatActiveReply;
    agentName: string;
    rows: TranscriptRow[];
}) {
    const emotion = resolveAgentStatusExpression({
        activeReply,
        rows,
    });
    const label = getAgentStatusLabel(emotion).replace(/^Agent\b/, agentName);

    return label.endsWith('working') || label.endsWith('thinking') || label.endsWith('typing')
        ? `${label}...`
        : label;
}
