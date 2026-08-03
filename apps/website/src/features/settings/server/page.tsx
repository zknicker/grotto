import { Button } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ServerSummary } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { HostedDeleteDialog } from '../../../routes/app/hosted-delete-dialog.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../layout/settings-page.tsx';

export function ServerSettings({ server }: { server: ServerSummary }) {
    const navigate = useNavigate();
    const utils = grottoTrpc.useUtils();
    const [deleting, setDeleting] = React.useState(false);
    const remove = grottoTrpc.server.delete.useMutation({
        onSuccess: async () => {
            setDeleting(false);
            await utils.server.list.invalidate();
            navigate('/s', { replace: true });
        },
    });

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Identity and permanent actions for this Server."
                title="Server"
            />
            <SettingsSection title="Identity">
                <SettingsGroup>
                    <SettingsRow title="Name">
                        <SettingsValue>{server.displayName}</SettingsValue>
                    </SettingsRow>
                    <SettingsRow description="The permanent Server address." title="Address">
                        <SettingsValue>/{server.slug}</SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
            {server.role === 'owner' ? (
                <SettingsSection title="Danger">
                    <SettingsGroup>
                        <SettingsRow
                            description="Permanently delete this Server and its hosted data."
                            error={remove.error?.message}
                            title="Delete Server"
                            trailingWidth="intrinsic"
                        >
                            <Button
                                onPress={() => setDeleting(true)}
                                size="sm"
                                type="button"
                                variant="danger-soft"
                            >
                                Delete Server
                            </Button>
                        </SettingsRow>
                    </SettingsGroup>
                    {deleting ? (
                        <HostedDeleteDialog
                            confirmation={server.slug}
                            description="This immediately disables the Server and permanently deletes its hosted data. Offline Computers do not block deletion."
                            onConfirm={() =>
                                remove.mutate({
                                    confirmation: server.slug,
                                    serverId: server.id,
                                })
                            }
                            onOpenChange={(open) => !open && setDeleting(false)}
                            pending={remove.isPending}
                            title="Delete Server"
                        />
                    ) : null}
                </SettingsSection>
            ) : null}
        </SettingsPage>
    );
}
