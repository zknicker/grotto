import { type CloudAgentWork, isTerminalCloudAgentStatus } from '@grotto/api';
import { useRelativeNow } from '../../components/time/relative-time.tsx';
import { formatRelativeTime } from '../../lib/format.ts';
import {
    cloudAgentPresentationStatus,
    cloudAgentStatusText,
    cloudAgentWorkActivityLine,
    isCloudAgentWorkStale,
} from './cloud-agent-presentation.ts';
import { CloudAgentProviderGlyph } from './cloud-agent-provider-mark.tsx';
import { cloudAgentProviderName } from './cloud-agent-provider-presentation.ts';
import { CloudAgentStatusDisc } from './cloud-agent-status-disc.tsx';

/**
 * A live work reads its elapsed time, so it ticks; a settled one states a
 * duration that will never change again and only keeps a clock for the
 * relative last-update note.
 */
function useWorkNow(work: CloudAgentWork) {
    return useRelativeNow(isTerminalCloudAgentStatus(work.status) ? 60_000 : 5000);
}

/**
 * One Cloud Agent work as it reads on its Message: the provider it runs on,
 * what it was asked to do, and a trailing status. Task-chip grammar —
 * annotation scale, neutral throughout, with only the status carrying
 * lifecycle color.
 */
export function CloudAgentWorkHeader({ work }: { work: CloudAgentWork }) {
    const now = useWorkNow(work);
    const status = cloudAgentPresentationStatus(work);
    const statusText = cloudAgentStatusText(work, now);

    return (
        <span
            // Annotation scale, matching the author line — without an explicit
            // size it inherits the message container and outgrows the body text.
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-muted text-sm"
            data-testid="cloud-agent-work-header"
        >
            <CloudAgentProviderGlyph provider={work.provider} />
            <span className="shrink-0">{cloudAgentProviderName(work.provider)}</span>
            <span className="min-w-0 truncate">{work.title}</span>
            <CloudAgentStatusDisc status={status} />
            <span className="shrink-0">{statusText}</span>
        </span>
    );
}

/**
 * Live Cloud Agent work hoisted onto the surface of the Message it runs under,
 * beside that Message's own Task or Ask chip: the provider glyph and the
 * trailing status, without the title. The title belongs to the work's own
 * Message inside the Thread; what the anchor owes a reader scanning the Chat is
 * only that something is running under it, and for how long.
 */
export function CloudAgentWorkStatusMark({ work }: { work: CloudAgentWork }) {
    const now = useWorkNow(work);
    const status = cloudAgentPresentationStatus(work);

    return (
        <span
            className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-muted text-sm"
            data-testid="cloud-agent-work-status-mark"
        >
            <CloudAgentProviderGlyph provider={work.provider} />
            <CloudAgentStatusDisc status={status} />
            <span className="shrink-0 tabular-nums">{cloudAgentStatusText(work, now)}</span>
        </span>
    );
}

/**
 * The one muted line under the header: what the work is doing right now. A
 * settled work says nothing here — the card inside the Thread states the
 * branch, the pull request, and the diff it produced. A running work that has
 * gone quiet says when it last said anything, rather than gating on Computer
 * connection state.
 */
export function CloudAgentWorkDetail({ work }: { work: CloudAgentWork }) {
    const now = useWorkNow(work);
    const line = cloudAgentWorkActivityLine(work);
    const stale = isCloudAgentWorkStale(work, now);

    if (!(line || stale)) {
        return null;
    }

    return (
        <p
            // The recessed Thread surface is one Open-thread button, so this
            // line lets its clicks through rather than covering it.
            className="pointer-events-none relative min-w-0 truncate text-muted text-xs"
            data-testid="cloud-agent-work-detail"
        >
            {line}
            {line && stale ? <span aria-hidden> · </span> : null}
            {stale ? `Last update ${formatRelativeTime(work.updatedAt, now)}` : null}
        </p>
    );
}
