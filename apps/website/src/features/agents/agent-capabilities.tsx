import type * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import type { AgentListOutput, SkillListOutput } from '../../lib/trpc.tsx';
import { SkillBadge } from '../skills/skill-badge.tsx';
import { formatSkillName } from '../skills/skill-name-format.ts';
import { selectAddableSkills } from './agent-abilities.ts';
import { PickerPopover } from './picker-popover.tsx';
import { useAgentSkillsUpdate } from './use-agent-skills-update.ts';

const visibleCapabilityLimit = 6;

export function AgentCapabilities({
    agent,
    enabledSkills,
    skills,
    skillsError,
    skillsPending,
}: {
    agent: AgentListOutput['agents'][number];
    enabledSkills: SkillListOutput['skills'];
    skills: SkillListOutput['skills'];
    skillsError: string | null;
    skillsPending: boolean;
}) {
    const saveSkills = useAgentSkillsUpdate();
    const visibleSkills = enabledSkills.slice(0, visibleCapabilityLimit);
    const skillOverflow = enabledSkills.length - visibleSkills.length;
    const addableSkills = selectAddableSkills(skills, agent);

    return (
        <section className="flex flex-col gap-2">
            <CapabilityRow
                addControl={
                    <PickerPopover
                        emptyText="Every usable skill is already added. Install or enable more on the Skills settings page."
                        isPending={saveSkills.isPending}
                        items={addableSkills.map((skill) => ({
                            id: skill.id,
                            name: formatSkillName(skill.name),
                        }))}
                        label="Add skill"
                        onAdd={(item) =>
                            void withSavingToast(() =>
                                saveSkills.mutateAsync({
                                    agentId: agent.id,
                                    enabledSkillIds: [
                                        ...new Set([...agent.enabledSkillIds, item.id]),
                                    ],
                                })
                            ).catch(() => undefined)
                        }
                        searchPlaceholder="Search skills..."
                        triggerVariant="ghost"
                    />
                }
                overflowCount={skillOverflow}
                title="Skills"
            >
                {visibleSkills.map((skill) => (
                    <SkillBadge key={skill.id} name={skill.name} />
                ))}
                {skillsPending ? (
                    <span className="text-muted-foreground text-sm">Loading skills...</span>
                ) : null}
            </CapabilityRow>
            {skillsError ? (
                <Alert variant="error">
                    <AlertDescription className="text-error-foreground">
                        Skills are unavailable: {skillsError}
                    </AlertDescription>
                </Alert>
            ) : null}
        </section>
    );
}

function CapabilityRow({
    addControl,
    children,
    overflowCount,
    title,
}: {
    addControl: React.ReactNode;
    children: React.ReactNode;
    overflowCount: number;
    title: string;
}) {
    return (
        <div className="grid min-h-9 grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-2">
            <h2 className="pt-1.5 font-medium text-muted-foreground text-sm leading-6">{title}</h2>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {children}
                {overflowCount > 0 ? (
                    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 font-medium text-muted-foreground text-sm shadow-xs">
                        +{overflowCount}
                    </span>
                ) : null}
                {addControl}
            </div>
        </div>
    );
}
