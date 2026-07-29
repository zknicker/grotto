import { CubeIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Badge } from '../../components/ui/badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';

export function SkillBadge({ className, name }: { className?: string; name: string }) {
    return (
        <Badge
            className={className}
            data-slot="skill-badge"
            size="chip"
            title={name}
            variant="chip"
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" icon={CubeIcon} />
            <span className="min-w-0 truncate">{name}</span>
        </Badge>
    );
}
