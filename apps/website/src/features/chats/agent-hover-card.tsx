import { Separator, Spinner } from '@heroui/react';
import { HoverCard } from '@heroui-pro/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { useAgentActivity } from '../../hooks/agents/use-agent-activity.ts';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useAgentList } from '../../hooks/agents/use-agent-list.ts';
import { useAgentSession } from '../../hooks/agents/use-agent-session.ts';
import { appRoutes } from '../../lib/app-routes.ts';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import {
    type AgentActivityEntry,
    formatAgentActivityEntry,
    formatAgentActivityTime,
} from './agent-activity-labels.ts';
import { AgentFace } from './agent-face.tsx';
import { useAgentPresenceEntry } from './agent-presence.tsx';

const hoverCardEntryLimit = 5;

/**
 * Profile hover card for any agent avatar (specs/agent-activity.md):
 * identity, live presence, the session model, and the latest activity.
 * Clicking the avatar opens the full Members profile.
 */
export function AgentHoverCard({
    agentId,
    agentName,
    chatId,
    children,
    onOpenProfile,
    triggerButtonClassName,
    triggerClassName,
}: {
    agentId: string;
    agentName: string;
    chatId: string;
    children: React.ReactNode;
    onOpenProfile?: () => void;
    /** Styling for the focusable control itself. */
    triggerButtonClassName?: string;
    /** Layout for the trigger wrapper, which is the row's flex child. */
    triggerClassName?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const navigate = useNavigate();

    return (
        <HoverCard closeDelay={150} onOpenChange={setOpen} open={open} openDelay={100}>
            {/*
             * Row layout and control styling are separate concerns on separate
             * elements: the wrapper is the flex child, the button is what takes
             * focus.
             */}
            <HoverCard.Trigger className={triggerClassName}>
                <button
                    aria-label={`Agent details: ${agentName}`}
                    className={triggerButtonClassName}
                    onClick={() => {
                        setOpen(false);
                        if (onOpenProfile) {
                            onOpenProfile();
                            return;
                        }
                        navigate(appRoutes.memberAgent(agentId));
                    }}
                    title={agentName}
                    type="button"
                >
                    {children}
                </button>
            </HoverCard.Trigger>
            <HoverCard.Content className="w-76" placement="bottom start">
                <AgentHoverCardBody
                    agentId={agentId}
                    agentName={agentName}
                    chatId={chatId}
                    enabled={open}
                />
            </HoverCard.Content>
        </HoverCard>
    );
}

function AgentHoverCardBody({
    agentId,
    agentName,
    chatId,
    enabled,
}: {
    agentId: string;
    agentName: string;
    chatId: string;
    enabled: boolean;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const appearance = useAgentAppearanceLookup()(agentId);
    const bio = useAgentList().data?.agents.find((agent) => agent.id === agentId)?.bio ?? null;
    const session = useAgentSession({ agentId, chatId, enabled }).data?.session ?? null;
    const presence = useAgentPresenceEntry(agentId);
    const activity = useAgentActivity({ agentId, enabled });
    const entries = (activity.data?.entries ?? []).slice(0, hoverCardEntryLimit);

    return (
        <div className="flex min-w-0 flex-col gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center">
                    <AgentFace
                        animate={false}
                        dark={dark}
                        head={appearance.character}
                        ink={resolveAgentInk(dark, appearance.primaryColor)}
                        size={44}
                    />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-semibold text-base text-foreground">
                            {agentName}
                        </span>
                        <span
                            className={cn(
                                'size-2 shrink-0 rounded-full transition-colors duration-300',
                                presence?.state === 'busy' ? 'bg-warning' : 'bg-success'
                            )}
                        />
                    </span>
                    <span className="min-w-0 truncate text-muted text-xs">
                        {presence?.state === 'busy' ? 'Working…' : 'Idle'}
                    </span>
                </div>
            </div>
            {bio ? (
                <>
                    <Separator />
                    <p className="line-clamp-2 text-muted text-sm">{bio}</p>
                </>
            ) : null}
            {session ? (
                <>
                    <Separator />
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-xs">
                        <dt className="text-muted">Model</dt>
                        <dd className="min-w-0 truncate text-foreground">
                            {session.effectiveModel.model} ·{' '}
                            {getModelProviderConfig(session.effectiveModel.provider).displayName}
                        </dd>
                    </dl>
                </>
            ) : null}
            <Separator />
            <div className="flex min-w-0 flex-col gap-1.5">
                <span className="font-medium text-muted text-xs uppercase tracking-wider">
                    Recent activity
                </span>
                {activity.isPending ? (
                    <span className="flex items-center gap-2 text-muted text-xs">
                        <Spinner color="current" size="sm" />
                        Loading...
                    </span>
                ) : entries.length === 0 ? (
                    <p className="text-muted text-xs">No recent activity.</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {entries.map((entry) => (
                            <li
                                className="flex min-w-0 items-center gap-2 text-xs"
                                key={`${entry.turnId ?? entry.at}-${entry.kind}`}
                            >
                                <span
                                    className={cn(
                                        'size-1.5 shrink-0 rounded-full',
                                        activityDotClassName(entry.kind)
                                    )}
                                />
                                <span className="w-16 shrink-0 whitespace-nowrap text-muted tabular-nums">
                                    {formatAgentActivityTime(entry.at)}
                                </span>
                                <span className="min-w-0 truncate text-foreground">
                                    {formatAgentActivityEntry(entry)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function activityDotClassName(kind: AgentActivityEntry['kind']) {
    switch (kind) {
        case 'completed':
            return 'bg-success';
        case 'failed':
            return 'bg-danger';
        case 'stopped':
        case 'new_session':
            return 'bg-muted';
        default:
            return 'bg-warning';
    }
}
