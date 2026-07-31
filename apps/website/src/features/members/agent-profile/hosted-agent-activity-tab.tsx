import { Button, Separator } from '@heroui/react';
import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedAgent } from '@tavern/api';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { HostedAgentTabLoading } from './hosted-agent-tab-loading.tsx';

export function HostedAgentActivityTab({
    agent,
    server,
}: {
    agent: HostedAgent;
    server: ServerDetail;
}) {
    const activity = grottoTrpc.agent.activity.useQuery({
        agentId: agent.id,
        limit: 50,
        serverId: server.id,
    });
    const entries = activity.data ?? [];

    return (
        <div className="px-5 py-6 sm:px-7">
            <SettingsPage>
                <SettingsSection
                    action={
                        <Button
                            isDisabled={entries.length === 0}
                            onPress={() =>
                                void navigator.clipboard.writeText(
                                    entries
                                        .map(
                                            (entry) =>
                                                `${entry.endedAt} · ${entry.status} · ${entry.summary}`
                                        )
                                        .join('\n')
                                )
                            }
                            size="sm"
                            variant="secondary"
                        >
                            <Icon aria-hidden="true" icon={Copy01Icon} />
                            Copy Activity
                        </Button>
                    }
                    title="Activity"
                >
                    {activity.isPending ? (
                        <HostedAgentTabLoading label="Loading activity..." />
                    ) : entries.length === 0 ? (
                        <p className="text-muted text-sm">No activity yet.</p>
                    ) : (
                        <SettingsGroup>
                            {entries.map((entry, index) => (
                                <React.Fragment key={entry.runId}>
                                    {index > 0 ? <Separator /> : null}
                                    <SettingsItem>
                                        <div className="grid grid-cols-[5rem_auto_minmax(0,1fr)] items-baseline gap-3">
                                            <time className="text-muted text-xs tabular-nums">
                                                {new Date(entry.endedAt).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </time>
                                            <StatusDot
                                                status={
                                                    entry.status === 'failed' ? 'error' : 'success'
                                                }
                                            />
                                            <div className="min-w-0 text-sm">
                                                <span className="font-medium text-foreground capitalize">
                                                    {entry.status}
                                                </span>{' '}
                                                <span className="text-muted">{entry.summary}</span>
                                            </div>
                                        </div>
                                    </SettingsItem>
                                </React.Fragment>
                            ))}
                        </SettingsGroup>
                    )}
                </SettingsSection>
            </SettingsPage>
        </div>
    );
}
