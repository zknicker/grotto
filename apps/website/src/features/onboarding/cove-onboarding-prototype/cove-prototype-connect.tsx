import { Button, Tabs } from '@heroui/react';
import { CodeSnippet } from '../../../components/code-snippet.tsx';
import {
    type CovePrototypeState,
    covePrototypeComputerCommand,
    covePrototypePlatforms,
    getConnectStatusLines,
} from './cove-prototype-model.ts';
import { StatusLineList, StepSection, SwitchServerButton } from './cove-prototype-shell.tsx';

/**
 * Step 1. The command is the whole interaction: the owner runs it in a
 * terminal and the page reports what the Server heard back. Nothing is
 * discovered or connected on the owner's behalf.
 */
export function ConnectComputerStep({
    onStateChange,
    state,
}: {
    onStateChange: (state: CovePrototypeState) => void;
    state: CovePrototypeState;
}) {
    const statusLines = getConnectStatusLines(state);
    const canAdvance = state === 'runtimes-detected';

    return (
        <StepSection
            footer={
                <>
                    <SwitchServerButton onPress={() => onStateChange('choose-server')} />
                    <Button isDisabled={!canAdvance} onPress={() => onStateChange('meet-cove')}>
                        Next
                    </Button>
                </>
            }
            title="Connect a Computer"
        >
            {/* Grid and flex children default to min-width:auto, so the long install
                command would size this whole column and spill outside the page. */}
            <div className="grid min-w-0 gap-4">
                <Tabs className="min-w-0" defaultSelectedKey="macos" variant="secondary">
                    <Tabs.ListContainer>
                        <Tabs.List aria-label="Computer platform">
                            {covePrototypePlatforms.map((platform) => (
                                <Tabs.Tab
                                    id={platform.id}
                                    isDisabled={!platform.isAvailable}
                                    key={platform.id}
                                >
                                    {platform.label}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs.ListContainer>
                    <Tabs.Panel className="grid min-w-0 gap-4 pt-4" id="macos">
                        <p className="text-base text-muted sm:text-sm">
                            Run this command on the Mac you want to connect. Nothing reaches this
                            Server until you do.
                        </p>
                        <CommandStep
                            command={covePrototypeComputerCommand}
                            label="Install and connect Grotto Computer"
                        />
                    </Tabs.Panel>
                </Tabs>
                <StatusLineList lines={statusLines} />
                {state === 'connect-failed' ? (
                    <Button
                        className="justify-self-start"
                        onPress={() => onStateChange('connect-computer')}
                        size="sm"
                        variant="outline"
                    >
                        Run command again
                    </Button>
                ) : null}
            </div>
        </StepSection>
    );
}

/**
 * The one command the owner runs themselves. `CodeSnippet` is the same row the
 * production Add Computer dialog uses.
 */
function CommandStep({ command, label }: { command: string; label: string }) {
    return (
        <div className="grid min-w-0 gap-2">
            <p className="font-medium text-base sm:text-sm">{label}</p>
            <CodeSnippet lines={command} />
        </div>
    );
}
