import { Button, Disclosure } from '@heroui/react';
import { CodeSnippet } from '../../components/code-snippet.tsx';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { ComputerUpdateControls } from './computer-update-controls.tsx';

export function ComputerActions({
    computerId,
    onRemove,
    serverId,
    serverSlug,
}: {
    computerId: string;
    onRemove: () => void;
    serverId: string;
    serverSlug: string;
}) {
    const computers = useComputers(serverId);
    const computer = computers.data?.find((candidate) => candidate.id === computerId);

    if (!computer) {
        return null;
    }

    return (
        <section className="grid gap-4 py-5">
            <h2 className="font-medium text-muted text-sm">Actions</h2>
            <div className="grid gap-5">
                <ComputerUpdateControls computer={computer} serverId={serverId} />
                <Disclosure>
                    <Disclosure.Heading>
                        <Button slot="trigger" variant="ghost">
                            Recovery Commands
                            <Disclosure.Indicator />
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body>
                            <div className="grid gap-3">
                                <p className="text-muted text-sm">
                                    If the App and this Computer disagree, check the machine
                                    directly.
                                </p>
                                <CodeSnippet
                                    lines={[
                                        'grotto-computer status',
                                        'grotto-computer doctor',
                                        `grotto-computer restart /${serverSlug}`,
                                        'grotto-computer upgrade --rollback',
                                    ]}
                                />
                            </div>
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
                <div className="flex flex-col gap-3 border-separator border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="font-medium text-foreground text-sm">Remove Computer</h3>
                        <p className="text-muted text-sm">
                            Delete every Agent on this Computer first.
                        </p>
                    </div>
                    <Button onPress={onRemove} size="sm" variant="danger-soft">
                        Remove Computer
                    </Button>
                </div>
            </div>
        </section>
    );
}
