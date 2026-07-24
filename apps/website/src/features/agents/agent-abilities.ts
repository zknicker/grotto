import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';

type Agent = AgentListOutput['agents'][number];
type SkillSummary = SkillListOutput['skills'][number];

export function selectAgentSkills(skills: SkillSummary[], agent: Agent): SkillSummary[] {
    return skills.filter((skill) => agent.enabledSkillIds.includes(skill.id));
}

export function selectAddableSkills(skills: SkillSummary[], agent: Agent): SkillSummary[] {
    return skills.filter(
        (skill) => !agent.enabledSkillIds.includes(skill.id) && skill.usability === 'enabled'
    );
}
