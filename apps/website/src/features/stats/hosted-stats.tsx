import type { HostedComputerUsage } from '@tavern/api';
import { useHostedUsage } from '../../hooks/servers/use-hosted-usage.ts';
import { formatTimestamp } from '../../lib/format.ts';
import { UsageModulesSkeleton, UsageModulesView } from '../overview/usage-modules.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../settings/layout/settings-page.tsx';

export function HostedStatsSettings({ serverId }: { serverId: string }) {
    const usage = useHostedUsage(serverId);
    const hasSnapshot = usage.data !== undefined;

    return (
        <HostedStats
            computers={usage.data?.computers}
            refreshError={hasSnapshot ? usage.error?.message : undefined}
            status={
                usage.error && !hasSnapshot
                    ? {
                          detail: usage.error.message,
                          title: 'Stats unavailable',
                      }
                    : usage.isPending && !hasSnapshot
                      ? 'loading'
                      : undefined
            }
        />
    );
}

/** Durable per-Computer usage. Offline Computers keep their last reported snapshot visible. */
export function HostedStats({
    computers,
    refreshError,
    status,
}: {
    computers: HostedComputerUsage[] | undefined;
    refreshError?: string;
    status?: 'loading' | { detail: string; title: string };
}) {
    return (
        <SettingsPage>
            <SettingsPageHeader title="Stats" />
            <SettingsSection title="Usage">
                {status === 'loading' ? <UsageModulesSkeleton /> : null}
                {typeof status === 'object' ? (
                    <UsageState detail={status.detail} title={status.title} value="Unavailable" />
                ) : null}
                {refreshError ? (
                    <UsageState
                        detail={refreshError}
                        title="Stats refresh failed"
                        value="Showing last report"
                    />
                ) : null}
                {status === undefined && computers?.length === 0 ? (
                    <UsageState
                        detail="Attach a Computer to report local model usage."
                        title="No Computers"
                        value="Waiting for a Computer"
                    />
                ) : null}
                {status === undefined ? (
                    <div className="grid gap-6">
                        {computers?.map((computer) => (
                            <ComputerUsage computer={computer} key={computer.computerId} />
                        ))}
                    </div>
                ) : null}
            </SettingsSection>
        </SettingsPage>
    );
}

function ComputerUsage({ computer }: { computer: HostedComputerUsage }) {
    const identity = [computer.operatingSystem, computer.architecture].filter(Boolean).join(' · ');
    const health = computer.health === 'healthy' ? 'Online' : computer.health;
    const freshness = computer.reportedAt
        ? `Last reported ${formatTimestamp(computer.reportedAt)}`
        : 'No usage reported yet';

    return (
        <section className="grid gap-3" data-computer-id={computer.computerId}>
            <div>
                <h2 className="font-semibold text-sm">
                    Computer · {computer.computerId.slice(-6)}
                </h2>
                <p className="text-muted text-xs">
                    {[identity, health, freshness].filter(Boolean).join(' · ')}
                </p>
            </div>
            {computer.usage ? (
                <UsageModulesView
                    allowOpenRouterConfiguration={false}
                    connectedProviders={computer.usage.connectedProviders}
                    liveUsage={computer.usage}
                />
            ) : (
                <UsageState
                    detail={
                        computer.health === 'healthy'
                            ? 'This Computer has not completed its first usage report.'
                            : 'Reconnect this Computer to collect its first usage report.'
                    }
                    title="Usage not reported"
                    value={computer.health === 'healthy' ? 'Collecting' : 'Computer offline'}
                />
            )}
        </section>
    );
}

function UsageState({ detail, title, value }: { detail: string; title: string; value: string }) {
    return (
        <SettingsGroup>
            <SettingsRow description={detail} title={title}>
                <SettingsValue>{value}</SettingsValue>
            </SettingsRow>
        </SettingsGroup>
    );
}
