import { BriefVariationsView } from '../../features/overview/brief-variations.tsx';
import { toOverviewAgent } from '../../features/overview/hosted-overview.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';

export function ServerBriefVariationsPage() {
    const { agents } = useHostedServerContext();
    return <BriefVariationsView agents={agents.map(toOverviewAgent)} />;
}
