import type { AgentSkillImportRecord, AgentSkillMetadata, ImportableSkill } from '@grotto/api';
import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import { formatSkillName } from '../../skills/skill-name-format.ts';

/** Agent skill library: the Agent's own SKILL.md copies plus in-flight imports. */
export function SkillList({
    addableSkills,
    canEdit,
    importError,
    importPending,
    imports,
    onImport,
    onSelectSkill,
    skills,
    skillSources,
}: {
    addableSkills: ImportableSkill[];
    canEdit: boolean;
    importError: string | null;
    importPending: boolean;
    imports: AgentSkillImportRecord[];
    onImport: (sourceId: string) => void;
    onSelectSkill: (skill: AgentSkillMetadata) => void;
    skills: AgentSkillMetadata[];
    skillSources: ImportableSkill[];
}) {
    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header className="flex items-center justify-between gap-3">
                <ItemCardGroup.Title>Skills</ItemCardGroup.Title>
                {canEdit ? (
                    <PickerPopover
                        emptyText="Every available skill is already added."
                        isPending={importPending}
                        items={addableSkills.map((skill) => ({
                            id: skill.id,
                            name: formatSkillName(skill.name),
                        }))}
                        label="Add Skills"
                        onAdd={(skill) => onImport(skill.id)}
                        searchPlaceholder="Search skills..."
                    />
                ) : null}
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                {skills.length === 0 ? (
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Description>No skills yet.</ItemCard.Description>
                        </ItemCard.Content>
                    </ItemCard>
                ) : (
                    skills.map((skill, index) => (
                        <React.Fragment key={skill.name}>
                            {index > 0 ? <Separator /> : null}
                            <ItemCard>
                                <ItemCard.Content>
                                    {/* A description is a truncating single line
                                        by design; a skill's is a paragraph, so it
                                        wraps here rather than being cut. */}
                                    <ItemCard.Title>
                                        {canEdit ? (
                                            <button
                                                className="cursor-(--cursor-interactive) rounded-sm text-left outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                                                onClick={() => onSelectSkill(skill)}
                                                type="button"
                                            >
                                                {skill.name}
                                            </button>
                                        ) : (
                                            skill.name
                                        )}
                                    </ItemCard.Title>
                                    <ItemCard.Description className="whitespace-normal">
                                        {skill.description}
                                    </ItemCard.Description>
                                </ItemCard.Content>
                                <ItemCard.Action>
                                    <span className="text-muted text-sm">
                                        Updated {formatDate(skill.modifiedAt)}
                                    </span>
                                </ItemCard.Action>
                            </ItemCard>
                        </React.Fragment>
                    ))
                )}
            </ItemCardGroup>
            {importError ? <p className="px-4 text-danger text-sm">{importError}</p> : null}
            {imports.map((record) => {
                const sourceName = skillSources.find(
                    (candidate) => candidate.id === record.sourceId
                )?.name;
                return (
                    <p
                        className={
                            record.status === 'failed'
                                ? 'px-4 text-danger text-sm'
                                : 'px-4 text-muted text-sm'
                        }
                        key={record.requestId}
                    >
                        {record.status === 'failed'
                            ? `${formatSkillName(sourceName ?? 'Skill')} import failed: ${record.error}`
                            : `Importing ${formatSkillName(sourceName ?? 'skill')}…`}
                    </p>
                );
            })}
        </ItemCardGroup>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
