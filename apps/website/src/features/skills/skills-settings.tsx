import { useComputers } from '../../hooks/servers/use-computers.ts';
import { SettingsPageHeader } from '../settings/layout/settings-page-header.tsx';
import { PageColumn } from '../shell/page-column.tsx';
import {
    SkillsBrowser,
    SkillsBrowserPending,
    SkillsBrowserUnavailable,
} from './skills-browser.tsx';

export function SkillsSettings({ serverId }: { serverId: string }) {
    const computers = useComputers(serverId);
    const sources = (computers.data ?? []).flatMap((computer) =>
        (computer.reportedInventory?.importableSkills ?? []).map((skill) => ({
            computerId: computer.id,
            skill,
        }))
    );

    return (
        <div className="flex h-full min-h-0 flex-col">
            <PageColumn className="shrink-0 pb-6">
                <SettingsPageHeader
                    description="Browse installed Skills to add to your Agents."
                    title="Skills"
                />
            </PageColumn>
            <div className="min-h-0 flex-1">
                {computers.error && !computers.data ? (
                    <SkillsBrowserUnavailable />
                ) : computers.data ? (
                    <SkillsBrowser sources={sources} />
                ) : (
                    <SkillsBrowserPending />
                )}
            </div>
        </div>
    );
}
