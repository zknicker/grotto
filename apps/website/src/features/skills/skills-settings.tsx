import { useComputers } from '../../hooks/servers/use-computers.ts';
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

    if (computers.error && !computers.data) {
        return <SkillsBrowserUnavailable />;
    }
    return computers.data ? <SkillsBrowser sources={sources} /> : <SkillsBrowserPending />;
}
