import type { ServerMember } from '@grotto/api/membership';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { CreatedAgents } from './created-agents.tsx';
import { HumanIdentity } from './human-identity.tsx';

/**
 * One human's profile, assembled from independently owned identity and Agent
 * sections. The host owns scrolling and the gutter — both hosts already carry
 * their own — so this composes straight into a `PageColumn`.
 */
export function HumanProfile({
    agentHref,
    member,
    server,
    viewerUserId,
}: {
    /**
     * Where an Agent row goes. This profile has two hosts — the members browser
     * and Settings — and a row must stay inside the one the reader is in, so the
     * destination belongs to the host rather than to the list.
     */
    agentHref: (agentId: string) => string;
    member: ServerMember;
    server: ServerDetail;
    viewerUserId: string;
}) {
    return (
        <PageColumn>
            <HumanIdentity
                isSelf={member.userId === viewerUserId}
                member={member}
                serverId={server.id}
            />
            <CreatedAgents agentHref={agentHref} serverId={server.id} userId={member.userId} />
        </PageColumn>
    );
}
