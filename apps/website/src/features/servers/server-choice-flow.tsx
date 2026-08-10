import { Button, Card } from '@heroui/react';
import * as React from 'react';
import { ActivationStep } from '../../components/activation/activation-shell.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { CreateServerForm } from './create-server-form.tsx';
import { JoinServerForm } from './join-server-form.tsx';
import { ServerSwitcher } from './server-switcher.tsx';

export type ServerChoiceView = 'servers' | 'create' | 'join';

/**
 * The activation Server chooser: one short screen per intent. The servers view
 * offers Create and Join; each flips to its own focused step with a way back.
 */
export function ServerChoiceFlow({
    initialView = 'servers',
    servers,
}: {
    initialView?: ServerChoiceView;
    servers: ServerSummary[];
}) {
    const [view, setView] = React.useState<ServerChoiceView>(initialView);
    const backToServers = () => setView('servers');

    if (view === 'create') {
        return <CreateServerStep onBack={backToServers} />;
    }
    if (view === 'join') {
        return <JoinServerStep onBack={backToServers} />;
    }
    return (
        <ServerChoiceStep
            onCreate={() => setView('create')}
            onJoin={() => setView('join')}
            servers={servers}
        />
    );
}

function ServerChoiceStep({
    onCreate,
    onJoin,
    servers,
}: {
    onCreate: () => void;
    onJoin: () => void;
    servers: ServerSummary[];
}) {
    const hasServers = servers.length > 0;

    return (
        <ActivationStep
            description={
                hasServers
                    ? 'Open a joined Server, or start another.'
                    : 'Create a Server or join one with an invitation.'
            }
            footer={
                <>
                    <Button onPress={onJoin} variant="outline">
                        Join a Server
                    </Button>
                    <Button onPress={onCreate}>Create a Server</Button>
                </>
            }
            title={hasServers ? 'Choose a Server' : 'Your First Server'}
        >
            {hasServers ? (
                <Card>
                    <Card.Content>
                        <ServerSwitcher servers={servers} />
                    </Card.Content>
                </Card>
            ) : null}
        </ActivationStep>
    );
}

function CreateServerStep({ onBack }: { onBack: () => void }) {
    return (
        <ActivationStep
            description="Start a new place for your people and Agents."
            footer={<BackButton onPress={onBack} />}
            title="Create a Server"
        >
            <Card>
                <Card.Content>
                    <CreateServerForm />
                </Card.Content>
            </Card>
        </ActivationStep>
    );
}

function JoinServerStep({ onBack }: { onBack: () => void }) {
    return (
        <ActivationStep
            description="Paste an invitation link or token."
            footer={<BackButton onPress={onBack} />}
            title="Join a Server"
        >
            <Card>
                <Card.Content>
                    <JoinServerForm />
                </Card.Content>
            </Card>
        </ActivationStep>
    );
}

function BackButton({ onPress }: { onPress: () => void }) {
    return (
        <Button onPress={onPress} variant="ghost">
            Back
        </Button>
    );
}
