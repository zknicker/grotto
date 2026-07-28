import type { HostedAgent, HostedComputerInventory, HostedImportableSkill } from '@tavern/api';
import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../components/ui/settings-row.tsx';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import {
    serverBriefVariationsRoute,
    serverComputersRoute,
} from '../../features/servers/server-routes.ts';
import { AppearanceSettings } from '../../features/settings/appearance/page.tsx';
import { ProfileSettings } from '../../features/settings/profile/page.tsx';
import { UpdatesSettings } from '../../features/settings/updates/page.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { ServerConnectionsPage } from './server-connections-page.tsx';

const sectionCopy: Record<string, { description: string; title: string }> = {
    appearance: { description: 'Choose how Grotto looks on this device.', title: 'Appearance' },
    browser: { description: 'Browser tools available to your Agents.', title: 'Browser' },
    connections: {
        description: 'Connect MCP servers and grant Agent tools.',
        title: 'Connections',
    },
    jobs: { description: 'Background work running on this Server.', title: 'Jobs' },
    models: { description: 'Models reported by attached Computers.', title: 'Models' },
    profile: { description: 'Your Grotto account and identity.', title: 'Profile' },
    sessions: { description: 'Recent Agent sessions and activity.', title: 'Sessions' },
    skills: { description: 'Skills available to Agents on this Server.', title: 'Skills' },
    stats: { description: 'Server and Agent activity.', title: 'Stats' },
    updates: { description: 'Grotto App and Computer updates.', title: 'Updates' },
};

export function ServerSettingsSectionPage() {
    const { section = 'agent-runtime' } = useParams();
    const { agents, server } = useHostedServerContext();
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId: server.id },
        {
            enabled: section === 'models' || section === 'skills',
            refetchInterval: section === 'skills' ? 1000 : false,
        }
    );

    if (section === 'agent-runtime') {
        return <Navigate replace to="../appearance" />;
    }

    if (section === 'appearance') {
        return <AppearanceSettings briefVariationsHref={serverBriefVariationsRoute(server.slug)} />;
    }

    if (section === 'profile') {
        return <ProfileSettings />;
    }

    if (section === 'connections') {
        return <ServerConnectionsPage embedded />;
    }

    if (section === 'models') {
        return <HostedModelsSettings computers={computers.data ?? []} />;
    }

    if (section === 'skills') {
        return (
            <HostedSkillsSettings
                agents={agents}
                computers={computers.data ?? []}
                serverId={server.id}
            />
        );
    }

    if (section === 'updates') {
        return <UpdatesSettings computerSettingsHref={serverComputersRoute(server.slug)} />;
    }

    const copy = sectionCopy[section] ?? { description: '', title: section };
    return (
        <SettingsPage>
            <SettingsPageHeader description={copy.description} title={copy.title} />
            <SettingsSection title={copy.title}>
                <SettingsGroup>
                    <SettingsRow
                        description="This legacy settings surface has not moved to the Server and Computer contract."
                        title={copy.title}
                    >
                        <SettingsValue>Not available yet</SettingsValue>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function HostedModelsSettings({ computers }: { computers: SkillsComputer[] }) {
    const runtimes = computers.flatMap((computer) =>
        (computer.reportedInventory?.runtimes ?? []).map((runtime) => ({
            computerId: computer.id,
            runtime,
        }))
    );

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Models detected by each attached Computer."
                title="Models"
            />
            <SettingsSection title="Computer Inventory">
                <SettingsGroup>
                    {runtimes.length > 0 ? (
                        runtimes.map(({ computerId, runtime }, index) => (
                            <React.Fragment key={`${computerId}:${runtime.id}`}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow
                                    description={`${computerId.slice(-6)} · ${runtime.models
                                        .map((model) => model.label)
                                        .join(', ')}`}
                                    title={runtime.label}
                                >
                                    <SettingsValue>
                                        {runtime.models.length}{' '}
                                        {runtime.models.length === 1 ? 'model' : 'models'}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsRow
                            description="Attach an online Computer to discover local runtimes and models."
                            title="No models reported"
                        >
                            <SettingsValue>Waiting for a Computer</SettingsValue>
                        </SettingsRow>
                    )}
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

interface SkillsComputer {
    id: string;
    reportedInventory: HostedComputerInventory | null;
}

function HostedSkillsSettings({
    agents,
    computers,
    serverId,
}: {
    agents: HostedAgent[];
    computers: SkillsComputer[];
    serverId: string;
}) {
    const sources = computers.flatMap((computer) =>
        (computer.reportedInventory?.importableSkills ?? []).map((skill) => ({
            computerId: computer.id,
            skill,
        }))
    );
    const libraries = computers.flatMap(
        (computer) => computer.reportedInventory?.agentSkills ?? []
    );

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Copy a skill already installed on a Computer into one Agent’s library."
                title="Skills"
            />
            <SettingsSection title="Available on Computers">
                <SettingsGroup>
                    {sources.length > 0 ? (
                        sources.map((source, index) => (
                            <React.Fragment key={`${source.computerId}:${source.skill.id}`}>
                                {index > 0 ? <Separator /> : null}
                                <ImportableSkillRow
                                    agents={agents.filter(
                                        (agent) => agent.computerId === source.computerId
                                    )}
                                    computer={computers.find(
                                        (computer) => computer.id === source.computerId
                                    )}
                                    serverId={serverId}
                                    skill={source.skill}
                                />
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsRow
                            description="Attach an online Computer with locally installed skills."
                            title="No skills reported"
                        >
                            <SettingsValue>Waiting for a Computer</SettingsValue>
                        </SettingsRow>
                    )}
                </SettingsGroup>
            </SettingsSection>
            <SettingsSection title="Agent Libraries">
                <SettingsGroup>
                    {agents.map((agent, index) => {
                        const report = libraries.find((item) => item.agentId === agent.id);
                        return (
                            <React.Fragment key={agent.id}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow
                                    description={
                                        report?.skills.map((skill) => skill.name).join(', ') ||
                                        'No imported skills'
                                    }
                                    title={agent.displayName}
                                >
                                    <SettingsValue>
                                        {report?.skills.length ?? 0}{' '}
                                        {(report?.skills.length ?? 0) === 1 ? 'skill' : 'skills'}
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        );
                    })}
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function ImportableSkillRow({
    agents,
    computer,
    serverId,
    skill,
}: {
    agents: HostedAgent[];
    computer: SkillsComputer | undefined;
    serverId: string;
    skill: HostedImportableSkill;
}) {
    const [agentId, setAgentId] = React.useState(agents[0]?.id ?? '');
    const [imported, setImported] = React.useState(false);
    const utils = grottoTrpc.useUtils();
    const mutation = grottoTrpc.agent.importSkill.useMutation({
        onSuccess: () => {
            setImported(true);
            void utils.computer.list.invalidate({ serverId });
        },
    });
    const selectedAgent = agents.find((agent) => agent.id === agentId);
    const existing = computer?.reportedInventory?.agentSkills
        ?.find((report) => report.agentId === agentId)
        ?.skills.some((candidate) => candidate.name === skill.name);

    return (
        <SettingsRow
            description={
                <>
                    {skill.description}
                    <span className="mt-1 block font-mono text-xs">{skill.source}</span>
                </>
            }
            error={mutation.error?.message}
            title={skill.name}
            trailingWidth="wide"
        >
            <div className="flex min-w-0 items-center gap-2">
                {agents.length > 0 ? (
                    <Select
                        onValueChange={(value) => {
                            setAgentId(value ?? '');
                            setImported(false);
                            mutation.reset();
                        }}
                        value={agentId}
                    >
                        <SelectTrigger aria-label={`Agent for ${skill.name}`}>
                            <SelectValue>{selectedAgent?.displayName}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                    {agent.displayName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <SettingsValue className="flex-1">No Agent on this Computer</SettingsValue>
                )}
                <Button
                    disabled={!agentId || Boolean(existing) || imported}
                    loading={mutation.isPending}
                    onClick={() => mutation.mutate({ agentId, serverId, sourceId: skill.id })}
                    size="sm"
                    type="button"
                >
                    {existing || imported ? 'Imported' : 'Import'}
                </Button>
            </div>
        </SettingsRow>
    );
}
