import { Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Badge } from '../../../components/ui/badge.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { SettingsRow } from '../../../components/ui/settings-row.tsx';
import type { AgentListOutput, SkillListOutput } from '../../../lib/trpc.tsx';
import { formatSkillName } from '../../skills/skill-name-format.ts';

type Agent = AgentListOutput['agents'][number];
type SkillSummary = SkillListOutput['skills'][number];

export function AgentSkillRow({
    agent,
    isSaving,
    onRemove,
    skill,
}: {
    agent: Agent;
    isSaving: boolean;
    onRemove: () => void;
    skill: SkillSummary;
}) {
    const displayName = formatSkillName(skill.name);
    const hint =
        skill.usability === 'enabled'
            ? null
            : skill.enabled
              ? (skill.diagnostic ?? 'Needs setup')
              : 'Disabled in Skills';

    return (
        <AbilityRow
            description={skill.description}
            hint={hint}
            isSaving={isSaving}
            name={displayName}
            onRemove={onRemove}
            removeLabel={`Remove ${displayName} from ${agent.name}`}
        />
    );
}

function AbilityRow({
    description,
    hint,
    isSaving,
    name,
    onRemove,
    removeLabel,
}: {
    description: string | null;
    hint: string | null;
    isSaving: boolean;
    name: string;
    onRemove: () => void;
    removeLabel: string;
}) {
    return (
        <SettingsRow
            className="group/ability relative pe-10"
            description={description}
            title={
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{name}</span>
                    {hint ? (
                        <Badge size="sm" variant="subtle">
                            {hint}
                        </Badge>
                    ) : null}
                </span>
            }
            trailingWidth="intrinsic"
        >
            <button
                aria-label={removeLabel}
                className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 group-hover/ability:text-muted-foreground"
                disabled={isSaving}
                onClick={onRemove}
                type="button"
            >
                <Icon className="size-3.5" icon={Cancel01Icon} />
            </button>
        </SettingsRow>
    );
}
