import { Chip } from '@heroui/react';
import { SparklesIcon } from '@hugeicons-pro/core-solid-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { formatSkillName } from './skill-name-format.ts';

export function SkillBadge({ className, name }: { className?: string; name: string }) {
    const displayName = formatSkillName(name);

    return (
        <Chip
            className={className}
            data-slot="skill-badge"
            size="sm"
            title={displayName}
            variant="soft"
        >
            <Icon aria-hidden="true" className="size-4 shrink-0" icon={SparklesIcon} />
            <Chip.Label className="min-w-0 truncate">{displayName}</Chip.Label>
        </Chip>
    );
}
