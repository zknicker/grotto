import type { ServerMember } from '@tavern/api/membership';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { SettingsPage } from '../../settings/layout/settings-page.tsx';
import { CreatedAgents } from './created-agents.tsx';
import { HumanIdentity } from './human-identity.tsx';

/** One human's profile, assembled from independently owned identity and Agent sections. */
export function HumanProfile({
    member,
    server,
    viewerUserId,
}: {
    member: ServerMember;
    server: ServerDetail;
    viewerUserId: string;
}) {
    return (
        <div className="min-w-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <div className="px-4 py-6">
                <SettingsPage>
                    <HumanIdentity
                        isSelf={member.userId === viewerUserId}
                        member={member}
                        serverId={server.id}
                    />
                    <CreatedAgents
                        serverId={server.id}
                        serverSlug={server.slug}
                        userId={member.userId}
                    />
                </SettingsPage>
            </div>
        </div>
    );
}
