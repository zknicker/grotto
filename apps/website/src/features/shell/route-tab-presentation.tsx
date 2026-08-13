import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity03Icon,
    BubbleChatIcon,
    CheckListIcon,
    Search01Icon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { RouteTab } from '../../hooks/shell/use-route-tab.ts';
import { cn } from '../../lib/utils.ts';

export function RouteTabIcon({ className, tab }: { className?: string; tab: RouteTab }) {
    return (
        <Icon
            aria-hidden="true"
            className={cn('shrink-0', className)}
            icon={getRouteTabIcon(tab)}
            size={18}
        />
    );
}

export function getRouteTabIcon(tab: RouteTab): IconSvgElement {
    switch (tab) {
        case 'tasks':
            return CheckListIcon;
        case 'search':
            return Search01Icon;
        case 'chat':
            return BubbleChatIcon;
        case 'activity':
            return Activity03Icon;
        case 'members':
            return UserMultiple02Icon;
    }
}
