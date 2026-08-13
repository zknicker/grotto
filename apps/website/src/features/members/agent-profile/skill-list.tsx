import { Separator } from '@heroui/react';
import type { AgentSkillImportRecord, AgentSkillMetadata, ImportableSkill } from '@tavern/api';
import * as React from 'react';
import { PickerPopover } from '../../agents/picker-popover.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
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
        <SettingsSection
            action={
                canEdit ? (
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
                ) : null
            }
            title="Skills"
        >
            {skills.length > 0 ? (
                <SettingsGroup>
                    {skills.map((skill, index) => (
                        <React.Fragment key={skill.name}>
                            {index > 0 ? <Separator /> : null}
                            <SettingsItem>
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                                    <div className="min-w-0">
                                        {canEdit ? (
                                            <button
                                                className="cursor-[var(--cursor-interactive)] rounded-sm text-left font-medium text-foreground text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                                                onClick={() => onSelectSkill(skill)}
                                                type="button"
                                            >
                                                {skill.name}
                                            </button>
                                        ) : (
                                            <p className="font-medium text-foreground text-sm">
                                                {skill.name}
                                            </p>
                                        )}
                                        <p className="text-muted text-sm">{skill.description}</p>
                                    </div>
                                    <p className="shrink-0 text-muted text-xs">
                                        Updated {formatDate(skill.modifiedAt)}
                                    </p>
                                </div>
                            </SettingsItem>
                        </React.Fragment>
                    ))}
                </SettingsGroup>
            ) : (
                <p className="px-1 text-muted text-sm">No skills yet.</p>
            )}
            {importError ? <p className="px-1 text-danger text-sm">{importError}</p> : null}
            {imports.map((record) => {
                const sourceName = skillSources.find(
                    (candidate) => candidate.id === record.sourceId
                )?.name;
                return (
                    <p
                        className={
                            record.status === 'failed'
                                ? 'px-1 text-danger text-sm'
                                : 'px-1 text-muted text-sm'
                        }
                        key={record.requestId}
                    >
                        {record.status === 'failed'
                            ? `${formatSkillName(sourceName ?? 'Skill')} import failed: ${record.error}`
                            : `Importing ${formatSkillName(sourceName ?? 'skill')}…`}
                    </p>
                );
            })}
        </SettingsSection>
    );
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
