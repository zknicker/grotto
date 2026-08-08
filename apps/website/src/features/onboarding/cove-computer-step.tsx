import { Tabs } from '@heroui/react';
import { CodeSnippet } from '../../components/code-snippet.tsx';
import type { ServerDetail } from '../../lib/grotto-server.tsx';
import type { CoveOnboardingView } from './cove-onboarding-model.ts';
import {
    type CoveStatusLine,
    covePrototypeInstallCommand,
    covePrototypePlatforms,
} from './cove-onboarding-prototype/cove-prototype-model.ts';
import {
    StatusLineList,
    StepSection,
    SwitchServerButton,
} from './cove-onboarding-prototype/cove-prototype-shell.tsx';

export function CoveComputerStep({
    failure,
    onSwitchServer,
    serverSlug,
    view,
}: {
    failure: ServerDetail['onboarding']['failure'];
    onSwitchServer: () => void;
    serverSlug: string;
    view: Exclude<CoveOnboardingView, 'app' | 'meet-cove'>;
}) {
    const setupCommand = `grotto-computer setup /${serverSlug}`;
    return (
        <StepSection
            footer={<SwitchServerButton onPress={onSwitchServer} />}
            title="Connect a Computer"
        >
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
                            Run these two commands on the Mac you want to connect. Nothing reaches
                            this Server until you do.
                        </p>
                        <CommandStep
                            command={covePrototypeInstallCommand}
                            label="1. Install Grotto Computer"
                        />
                        <CommandStep command={setupCommand} label="2. Connect it to this Server" />
                    </Tabs.Panel>
                </Tabs>
                <StatusLineList lines={statusLines(view, failure)} />
            </div>
        </StepSection>
    );
}

function CommandStep({ command, label }: { command: string; label: string }) {
    return (
        <div className="grid min-w-0 gap-2">
            <p className="font-medium text-base sm:text-sm">{label}</p>
            <CodeSnippet lines={command} />
        </div>
    );
}

function statusLines(
    view: Exclude<CoveOnboardingView, 'app' | 'meet-cove'>,
    failure: ServerDetail['onboarding']['failure']
): CoveStatusLine[] {
    if (view === 'connect-failed' && failure) {
        return [{ label: failure.detail, tone: 'failed' }];
    }
    if (view === 'detecting-runtimes') {
        return [
            { label: 'Request approved.', tone: 'done' },
            { label: 'Computer connected.', tone: 'done' },
            { label: 'Detecting runtimes…', tone: 'waiting' },
        ];
    }
    return [];
}
