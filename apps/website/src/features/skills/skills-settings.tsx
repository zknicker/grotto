import { useComputers } from '../../hooks/servers/use-computers.ts';
import { SkillsBrowser } from './skills-browser.tsx';

export function SkillsSettings({ serverId }: { serverId: string }) {
    const computers = useComputers(serverId);
    const sources = (computers.data ?? []).flatMap((computer) =>
        (computer.reportedInventory?.importableSkills ?? []).map((skill) => ({
            computerId: computer.id,
            skill,
        }))
    );

    return <SkillsBrowser sources={sources} />;
}
