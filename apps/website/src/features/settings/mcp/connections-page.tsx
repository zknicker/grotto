import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { RequireOperator } from '../../servers/require-operator.tsx';
import { useServerContext } from '../../servers/server-context.ts';
import { serverRoute } from '../../servers/server-routes.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page-header.tsx';
import { ConnectionAddDrawer } from './connection-add-drawer.tsx';
import { ConnectionDetail } from './connection-detail.tsx';
import { ConnectionListSection } from './connection-list-section.tsx';
import { ConnectionPresetSection } from './connection-preset-section.tsx';

export function ConnectionsPage({ embedded = false }: { embedded?: boolean }) {
    const { slug = '' } = useParams();
    const { server } = useServerContext();
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    return (
        <RequireOperator
            description="MCP connections are managed by Server operators."
            role={server.role}
        >
            <PageColumn>
                {embedded ? null : (
                    <Link
                        className="text-muted text-sm hover:text-foreground"
                        to={serverRoute(slug)}
                    >
                        Back to /{slug}
                    </Link>
                )}
                <SettingsPageHeader
                    description="Connect remote tools to this Server, then enable each connection for the Agents that need it."
                    title="Connections"
                />
                <ConnectionPresetSection serverId={server.id} />
                <ConnectionListSection
                    onAdd={() => setIsAddOpen(true)}
                    onSelect={setSelectedId}
                    serverId={server.id}
                />
                {selectedId ? (
                    <ConnectionDetail
                        connectionId={selectedId}
                        onClose={() => setSelectedId(null)}
                        serverId={server.id}
                    />
                ) : null}
                <ConnectionAddDrawer
                    onOpenChange={setIsAddOpen}
                    open={isAddOpen}
                    serverId={server.id}
                />
            </PageColumn>
        </RequireOperator>
    );
}
