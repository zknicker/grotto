import type { CloudAgentWork } from '@grotto/api';
import { identityMarkRadius } from '../../components/ui/entity-avatar.tsx';
import { cloudAgentPresentationStatus } from './cloud-agent-presentation.ts';
import { CloudAgentProviderGlyph } from './cloud-agent-provider-mark.tsx';
import { cloudAgentProviderName } from './cloud-agent-provider-presentation.ts';

/** Informational rows let the Thread surface's single button own every click. */
export function ThreadCloudAgentRows({ works }: { works: readonly CloudAgentWork[] }) {
    return (
        <div
            className="pointer-events-none relative flex min-w-0 flex-col gap-1"
            data-testid="thread-cloud-agent-rows"
        >
            {works.map((work) => (
                <span
                    className="flex min-w-0 items-center gap-1.5 text-sm leading-tight"
                    key={work.id}
                >
                    <span
                        className="flex shrink-0 items-center justify-center bg-default"
                        style={{ borderRadius: identityMarkRadius(20), height: 20, width: 20 }}
                    >
                        <CloudAgentProviderGlyph className="scale-110" provider={work.provider} />
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">
                        {cloudAgentProviderName(work.provider)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted">{work.title}</span>
                    <span className="shrink-0 text-muted text-xs">
                        {statusLabels[cloudAgentPresentationStatus(work)]}
                    </span>
                </span>
            ))}
        </div>
    );
}

const statusLabels = {
    cancelled: 'Cancelled',
    cancelling: 'Cancelling',
    completed: 'Done',
    expired: 'Expired',
    failed: 'Failed',
    queued: 'Queued',
    running: 'Running',
};
