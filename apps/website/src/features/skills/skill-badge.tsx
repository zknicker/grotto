import { Chip } from '@heroui/react';
import { CubeIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';

export function SkillBadge({ className, name }: { className?: string; name: string }) {
    return (
        <Chip className={className} data-slot="skill-badge" size="sm" title={name} variant="soft">
            <Icon aria-hidden="true" className="size-4 shrink-0" icon={CubeIcon} />
            <span className="min-w-0 truncate">{name}</span>
        </Chip>
    );
}
