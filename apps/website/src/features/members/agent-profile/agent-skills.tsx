import type {
    HostedAgent,
    HostedAgentSkillImportRecord,
    HostedAgentSkillMetadata,
    HostedImportableSkill,
} from '@tavern/api';
import * as React from 'react';
import { useSkillImport } from '../../../hooks/members/use-skill-import.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { SkillDialog } from './skill-dialog.tsx';
import { SkillList } from './skill-list.tsx';

export function AgentSkills({
    agent,
    canEdit,
    imports,
    server,
    skillSources,
    skills,
}: {
    agent: HostedAgent;
    canEdit: boolean;
    imports: HostedAgentSkillImportRecord[];
    server: ServerDetail;
    skillSources: HostedImportableSkill[];
    skills: HostedAgentSkillMetadata[];
}) {
    const [selectedSkill, setSelectedSkill] = React.useState<HostedAgentSkillMetadata | null>(null);
    const importSkill = useSkillImport(server.id, agent.id);

    return (
        <>
            <SkillList
                addableSkills={selectAddableSkills(skillSources, skills)}
                canEdit={canEdit}
                importError={importSkill.error?.message ?? null}
                importPending={importSkill.isPending}
                imports={selectOutstandingImports(imports, agent.id)}
                onImport={importSkill.importSkill}
                onSelectSkill={setSelectedSkill}
                skillSources={skillSources}
                skills={skills}
            />
            <SkillDialog
                agent={agent}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedSkill(null);
                    }
                }}
                server={server}
                skill={selectedSkill}
            />
        </>
    );
}

export function selectAddableSkills(
    sources: HostedImportableSkill[],
    owned: HostedAgentSkillMetadata[]
) {
    const ownedNames = new Set(owned.map((skill) => skill.name));
    return sources.filter((source) => !ownedNames.has(source.name));
}

export function selectOutstandingImports(records: HostedAgentSkillImportRecord[], agentId: string) {
    const latestBySource = new Map<string, HostedAgentSkillImportRecord>();
    for (const record of records) {
        if (record.agentId !== agentId || latestBySource.has(record.sourceId)) {
            continue;
        }
        latestBySource.set(record.sourceId, record);
    }
    return [...latestBySource.values()].filter((record) => record.status !== 'applied');
}
