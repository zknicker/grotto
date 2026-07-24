import { useEffect, useState } from 'react';
import {
    SettingsGroup,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { Switch } from '../../../components/ui/switch.tsx';
import { useAgentWebSettingsUpdate } from '../../../hooks/agents/use-agent-web-settings.ts';
import { useCapability } from '../../../hooks/connections/use-capability.ts';
import { withSaveErrorToast } from '../../../lib/saving-toast.ts';
import type { AgentListOutput } from '../../../lib/trpc.tsx';

export function AgentWebAccessSection({
    agent,
    disabled,
}: {
    agent: AgentListOutput['agents'][number];
    disabled: boolean;
}) {
    const capability = useCapability('webAccess');
    const update = useAgentWebSettingsUpdate();
    const [webAccess, setWebAccess] = useState(agent.webAccessEnabled);

    useEffect(() => {
        setWebAccess(agent.webAccessEnabled);
    }, [agent.webAccessEnabled]);

    if (!capability.healthy) {
        return null;
    }

    const isSaving = disabled || update.isPending;

    return (
        <SettingsSection title="Web access">
            <SettingsGroup>
                <SettingsRow
                    description="Let this agent use model-provided web search when its selected model supports it. Page fetching is granted separately under Tools."
                    title="Web search"
                >
                    <div className="flex justify-start md:justify-end">
                        <Switch
                            aria-label="Web search"
                            checked={webAccess}
                            disabled={isSaving}
                            onCheckedChange={(enabled) => {
                                setWebAccess(enabled);
                                void withSaveErrorToast(() =>
                                    update.mutateAsync({
                                        agentId: agent.id,
                                        webAccessEnabled: enabled,
                                    })
                                ).catch(() => setWebAccess(agent.webAccessEnabled));
                            }}
                        />
                    </div>
                </SettingsRow>
            </SettingsGroup>
        </SettingsSection>
    );
}
