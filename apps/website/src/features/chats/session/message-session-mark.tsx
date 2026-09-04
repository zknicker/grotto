import type { AgentSessionRotation } from '@grotto/api';
import { ArrowUpRight01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Link, useParams } from 'react-router-dom';
import { CursorHoverCard } from '../../../components/ui/cursor-hover-card.tsx';
import { identityMarkRadius } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentSessionRotation } from '../../../hooks/agents/use-agent-session-rotation.ts';
import { settingsAgentRoute } from '../../servers/server-routes.ts';
import { sessionRotationHoverRows } from './session-mark-model.ts';

/**
 * The Agent started over before it wrote this.
 *
 * A reset leaves no row in the transcript, so without this the reader sees an
 * Agent that suddenly forgot the last hour and nothing that says why. The mark
 * sits in the same header slot as the automation mark and after it when both
 * apply: why the Agent spoke comes before what it had already forgotten.
 */
export function MessageSessionMark({
    agentId,
    generation,
    serverId,
}: {
    agentId: string;
    generation: number;
    serverId: string;
}) {
    return (
        <CursorHoverCard
            className="w-80"
            content={
                <SessionMarkHoverCard
                    agentId={agentId}
                    generation={generation}
                    serverId={serverId}
                />
            }
            triggerClassName="min-w-0"
        >
            <span
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-session-mark text-xs leading-5"
                data-testid="message-session-mark"
            >
                <SessionGlyph />
                New session
            </span>
        </CursorHoverCard>
    );
}

/**
 * The read. It runs only here, and the hover card's content mounts only once
 * the card opens, so a transcript full of marks costs nothing until one is
 * pointed at.
 */
function SessionMarkHoverCard({
    agentId,
    generation,
    serverId,
}: {
    agentId: string;
    generation: number;
    serverId: string;
}) {
    const rotation = useAgentSessionRotation({ agentId, enabled: true, generation, serverId });

    return <SessionMarkHoverContent agentId={agentId} rotation={rotation.data ?? null} />;
}

/**
 * The card itself. `rotation` is null while the read is in flight and when no
 * rotation was recorded for this generation — history older than the record
 * has none — so the card states the heading it is certain of and adds the
 * facts when they arrive, rather than flashing a shell of empty rows.
 */
export function SessionMarkHoverContent({
    agentId,
    rotation,
}: {
    agentId: string;
    rotation: AgentSessionRotation | null;
}) {
    const rows = rotation ? sessionRotationHoverRows(rotation) : [];

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <header className="flex min-w-0 items-center gap-2.5">
                <SessionGlyphBox />
                <strong className="min-w-0 truncate font-semibold text-foreground text-sm">
                    New session
                </strong>
            </header>
            {rows.length > 0 ? (
                <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                    {rows.map((row) => (
                        <div className="contents" key={row.label}>
                            <dt className="text-muted">{row.label}</dt>
                            <dd className="m-0 min-w-0 text-foreground">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            <div className="border-separator border-t pt-3">
                <ViewAgentActivityLink agentId={agentId} />
            </div>
        </div>
    );
}

/**
 * Out of the transcript and into the Agent's own history. The Activity tab is
 * where a session's turns, tools, and restarts are read in order, so the mark
 * points there rather than trying to explain the run in a hover card.
 */
function ViewAgentActivityLink({ agentId }: { agentId: string }) {
    const { slug = '' } = useParams();

    return (
        <Link
            className="inline-flex w-fit items-center gap-1 font-semibold text-accent text-xs"
            to={settingsAgentRoute(slug, agentId, 'activity')}
        >
            View activity
            <Icon aria-hidden="true" icon={ArrowUpRight01Icon} size={11} />
        </Link>
    );
}

function SessionGlyph() {
    return (
        <Icon
            className="shrink-0"
            icon={RefreshIcon}
            size={13}
            strokeWidth={1.6}
            style={{ height: 13, width: 13 }}
        />
    );
}

/** Exact box, so it derives its radius the way every fixed identity mark does. */
function SessionGlyphBox() {
    return (
        <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center bg-surface-tertiary text-session-mark"
            style={{ borderRadius: identityMarkRadius(24), height: 24, width: 24 }}
        >
            <Icon
                icon={RefreshIcon}
                size={14}
                strokeWidth={1.6}
                style={{ height: 14, width: 14 }}
            />
        </span>
    );
}
