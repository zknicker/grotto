import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { cn } from '../../lib/utils.ts';
import { hasErrorStatus } from '../sessions/tools/tool-ui.ts';
import { ActivityStep } from './chat-transcript-activity-step.tsx';
import {
    type ActivityItem,
    formatActiveActivitySeconds,
    formatActiveWorkGroupHeader,
    formatActivityHeader,
    formatWorkGroupHeader,
    getActivityItemKey,
    getWorkGroupIcon,
} from './chat-transcript-activity-utils.ts';
import { ThinkingSteps, ThinkingStepsContent, ThinkingStepsHeader } from './thinking-steps.tsx';
import { ToolRowHoverRoot, useToolRowHoverGroup } from './tool-row-hover.ts';
import { useStableWorkGroupLabel, WorkGroupHeaderText } from './work-group-header-text.tsx';

export function WorkingLog({
    animateEnter = false,
    appearance = 'transcript',
    chatId,
    currentSessionKey,
    defaultOpen: defaultOpenOverride,
    end,
    items,
    showDurationHeader = true,
    start,
    status,
}: {
    animateEnter?: boolean;
    // 'card' fills a bordered container (the turn drawer): full-bleed header
    // strip, no transcript alignment offsets.
    appearance?: 'card' | 'transcript';
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpen?: boolean;
    end: string | null;
    items: ActivityItem[];
    showDurationHeader?: boolean;
    start: string | null;
    status: 'active' | 'completed';
}) {
    const isActive = status === 'active';
    // Group mode (no duration header) renders Codex-style: a collapsed
    // drawer that exists from the first step. The header carries the active
    // work summary while the drawer owns exact tool rows; only the text
    // changes, never the structure.
    const groupMode = !showDurationHeader;
    const now = useNow(isActive && start !== null, start);
    const activeSeconds = isActive ? formatActiveActivitySeconds({ now, start }) : null;
    const thinkingOnly = isThinkingOnly(items);
    const firstPendingClarificationId = findFirstPendingClarificationId(items);
    const hasPendingPrompt = Boolean(firstPendingClarificationId);
    const inferredDefaultOpen = groupMode
        ? hasPendingPrompt
        : isActive || (!thinkingOnly && hasNarration(items));
    const defaultOpen = defaultOpenOverride ?? inferredDefaultOpen;
    const [open, setOpen] = React.useState(defaultOpen);
    const disclosureAnchor = useDisclosureScrollAnchor();
    const panelId = React.useId();

    React.useEffect(() => {
        if (groupMode) {
            if (hasPendingPrompt) {
                setOpen(true);
            }
            return;
        }

        if (isActive) {
            setOpen(true);
            return;
        }

        if (thinkingOnly) {
            setOpen(false);
        }
    }, [groupMode, hasPendingPrompt, isActive, thinkingOnly]);

    const rawGroupLabel = groupMode
        ? isActive
            ? formatActiveWorkGroupHeader(items)
            : formatWorkGroupHeader(items)
        : null;
    const groupLabel = useStableWorkGroupLabel(rawGroupLabel, groupMode && isActive);
    const groupIcon = groupMode ? getWorkGroupIcon(items) : null;
    const rowHover = useToolRowHoverGroup({
        enabled: groupMode,
        headerRef: disclosureAnchor.triggerRef,
        measureKey: groupMode ? `${open}:${items.length}:${groupLabel ?? ''}` : '',
    });

    return (
        <ToolRowHoverRoot value={rowHover.contextValue}>
            <ThinkingSteps
                // Group mode keeps the horizontal hover affordance without
                // compressing the surrounding turn rhythm.
                className={cn(
                    'w-full',
                    appearance === 'transcript' && 'max-w-[34rem]',
                    // The hover rail positions against this container.
                    groupMode && 'relative',
                    groupMode && appearance === 'transcript' && '-ml-2 w-[calc(100%+0.5rem)]',
                    groupMode && animateEnter && 'chat-step-enter'
                )}
                onOpenChange={setOpen}
                open={open}
            >
                <ThinkingStepsHeader
                    aria-controls={panelId}
                    className={
                        groupMode
                            ? cn(
                                  'relative z-10 w-full py-1.5 pr-2 pl-3 font-normal text-muted-foreground text-sm outline-none transition-none hover:bg-chat-log-row-hover hover:text-muted-foreground focus-visible:bg-chat-log-row-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                                  // Card appearance: a true header above the
                                  // rows card, hugging its own label. Hover
                                  // lightens the text and icons instead of
                                  // painting a bg behind the tight label.
                                  appearance === 'card' &&
                                      'h-7 w-auto items-center rounded-md py-0 pr-2 pl-1.5 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:bg-transparent hover:[&_svg]:text-foreground'
                              )
                            : undefined
                    }
                    onFocus={groupMode ? rowHover.clearActiveItem : undefined}
                    onKeyDown={disclosureAnchor.captureFromKeyboard}
                    onMouseEnter={groupMode ? rowHover.clearActiveItem : undefined}
                    onPointerDown={disclosureAnchor.capture}
                    ref={groupMode ? rowHover.registerHeader : disclosureAnchor.triggerRef}
                    wrapperClassName={
                        groupMode
                            ? cn('relative z-10 w-full', appearance === 'card' && 'w-fit')
                            : undefined
                    }
                >
                    {groupMode ? (
                        <span className="flex min-w-0 items-center gap-2">
                            {groupIcon ? (
                                <span className="-ml-1 flex size-4 shrink-0 items-center justify-center">
                                    <Icon
                                        className="size-4 text-muted-foreground"
                                        icon={groupIcon}
                                        strokeWidth={1.5}
                                    />
                                </span>
                            ) : null}
                            <WorkGroupHeaderText isActive={isActive} label={groupLabel} />
                        </span>
                    ) : isActive && activeSeconds ? (
                        <span>
                            Working for{' '}
                            <span className="inline-block min-w-[2.2ch] text-left tabular-nums">
                                {activeSeconds}
                            </span>
                        </span>
                    ) : (
                        formatActivityHeader({ end, isActive, now, start })
                    )}
                </ThinkingStepsHeader>
                <ThinkingStepsContent
                    className={showDurationHeader ? undefined : cn('relative z-10 pt-1')}
                    id={panelId}
                    ref={groupMode && appearance !== 'card' ? rowHover.contentRef : undefined}
                >
                    {groupMode && appearance === 'card' ? (
                        // The rows sit on their own card surface below the
                        // header; it owns the hover rail so the moving bg
                        // clips to the card's rounded corners.
                        <Elevated
                            className="relative overflow-hidden rounded-xl p-1 [--tool-row-min-h:2.25rem]"
                            offset={1}
                            ref={rowHover.contentRef}
                            shadowLevel={1}
                        >
                            {rowHover.hoverLayer}
                            <WorkingLogSteps
                                chatId={chatId}
                                currentSessionKey={currentSessionKey}
                                isActive={isActive}
                                items={items}
                            />
                        </Elevated>
                    ) : (
                        <>
                            {rowHover.hoverLayer}
                            <WorkingLogSteps
                                chatId={chatId}
                                currentSessionKey={currentSessionKey}
                                isActive={isActive}
                                items={items}
                            />
                        </>
                    )}
                </ThinkingStepsContent>
            </ThinkingSteps>
        </ToolRowHoverRoot>
    );
}

function WorkingLogSteps({
    chatId,
    currentSessionKey,
    isActive,
    items,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    isActive: boolean;
    items: ActivityItem[];
}) {
    return items.map((item, index) => (
        <ActivityStep
            animateEnter={isActive}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            index={index}
            isLast={index === items.length - 1}
            item={item}
            key={getActivityItemKey(item)}
        />
    ));
}

function findFirstPendingClarificationId(items: ActivityItem[]) {
    const item = items.find(
        (candidate) =>
            candidate.row.kind === 'tool' &&
            Boolean(candidate.row.clarification) &&
            !candidate.row.completedAt &&
            !hasErrorStatus(candidate.row.toolCall.status)
    );

    return item?.row.id ?? null;
}

function useDisclosureScrollAnchor() {
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const capture = React.useCallback(() => {}, []);

    const captureFromKeyboard = React.useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                capture();
            }
        },
        [capture]
    );

    return { capture, captureFromKeyboard, triggerRef };
}

function hasNarration(items: ActivityItem[]) {
    return items.some((item) => {
        if (item.row.kind === 'system') {
            return false;
        }

        if (item.row.kind !== 'tool') {
            return false;
        }

        const name = item.row.toolCall.name.trim().toLowerCase();
        return name === 'message' || name === 'reasoning';
    });
}

function isThinkingOnly(items: ActivityItem[]) {
    return (
        items.length > 0 &&
        items.every((item) => item.row.kind === 'system' && item.row.systemKind === 'thinking')
    );
}

function useNow(enabled: boolean, start: string | null) {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        if (!enabled) {
            return;
        }

        const updateNow = () => setNow(Date.now());
        const startMs = start ? Date.parse(start) : Number.NaN;
        const elapsedMs = Number.isNaN(startMs) ? 0 : Math.max(0, Date.now() - startMs);
        const delayMs = Number.isNaN(startMs) ? 1000 : 1000 - (elapsedMs % 1000);
        let interval: number | undefined;

        updateNow();

        const timeout = window.setTimeout(
            () => {
                updateNow();
                interval = window.setInterval(updateNow, 1000);
            },
            Math.max(100, delayMs)
        );

        return () => {
            window.clearTimeout(timeout);

            if (interval !== undefined) {
                window.clearInterval(interval);
            }
        };
    }, [enabled, start]);

    return now;
}
