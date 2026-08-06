import { useConnectionPresetAdd } from '../../../hooks/servers/use-connection-preset-add.ts';
import { SettingsSection } from '../layout/settings-page.tsx';
import { ConnectionPresetButtons } from './connection-view.tsx';

export function ConnectionPresetSection({ serverId }: { serverId: string }) {
    const addPreset = useConnectionPresetAdd(serverId);

    return (
        <SettingsSection title="Recommended">
            <ConnectionPresetButtons
                onAdd={(preset, name) => addPreset.mutate({ name, preset, serverId })}
            />
        </SettingsSection>
    );
}
