import { Separator } from '@heroui/react';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { CreateServerForm } from './create-server-form.tsx';
import { JoinServerForm } from './join-server-form.tsx';
import { ServerSwitcher } from './server-switcher.tsx';

export function ServerChoicePanel({
    onServerSelect,
    servers,
}: {
    onServerSelect?: () => void;
    servers: ServerSummary[];
}) {
    return (
        <div className="flex flex-col gap-8">
            {servers.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <h2 className="font-medium text-muted text-sm">Joined Servers</h2>
                    <ServerSwitcher onSelect={onServerSelect} servers={servers} />
                </section>
            ) : null}
            <section className="flex flex-col gap-3">
                <div>
                    <h2 className="font-medium text-foreground text-sm">Create a Server</h2>
                    <p className="mt-0.5 text-muted text-sm">
                        Start a new place for your people and Agents.
                    </p>
                </div>
                <CreateServerForm onCreated={onServerSelect} />
            </section>
            <Separator />
            <section className="flex flex-col gap-3">
                <div>
                    <h2 className="font-medium text-foreground text-sm">Join a Server</h2>
                    <p className="mt-0.5 text-muted text-sm">Paste an invitation link or token.</p>
                </div>
                <JoinServerForm />
            </section>
        </div>
    );
}
