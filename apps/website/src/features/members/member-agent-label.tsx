import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import type { AgentListOutput } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from '../chats/agent-face.tsx';
import { useAgentPresenceEntry } from '../chats/agent-presence.tsx';

type MemberAgent = AgentListOutput['agents'][number];

const faceStyle = { flexShrink: 0, height: 32, overflow: 'visible', width: 32 } as const;

export function MemberAgentLabel({
    agent,
    className,
    showPresence = false,
}: {
    agent: MemberAgent;
    className?: string;
    showPresence?: boolean;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const presence = useAgentPresenceEntry(showPresence ? agent.id : null);

    return (
        <div className={cn('flex min-w-0 items-center gap-3', className)}>
            <span
                aria-hidden="true"
                className="relative flex size-8 shrink-0 items-center justify-center overflow-visible"
            >
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agent.effectiveCharacter}
                    ink={resolveAgentInk(dark, agent.effectivePrimaryColor)}
                    size={32}
                    style={faceStyle}
                />
                {presence ? (
                    <StatusDot
                        className="absolute -right-0.5 -bottom-0.5 ring-2 ring-sidebar"
                        size="md"
                        status={presence.state === 'busy' ? 'warning' : 'success'}
                    />
                ) : null}
            </span>
            <span className="min-w-0">
                <span className="block truncate font-semibold text-sm">{agent.name}</span>
                {agent.bio ? (
                    <span className="block truncate text-muted-foreground text-sm">
                        {agent.bio}
                    </span>
                ) : null}
            </span>
        </div>
    );
}
