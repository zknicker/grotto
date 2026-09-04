import type { IconSvgElement } from '@hugeicons/react';
import {
    Activity03Icon,
    Chat01Icon,
    CheckListIcon,
    InboxIcon,
    Search01Icon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { RouteTab } from '../../hooks/shell/use-route-tab.ts';
import { cn } from '../../lib/utils.ts';

export function RouteTabIcon({
    className,
    size = 18,
    tab,
}: {
    className?: string;
    size?: number;
    tab: RouteTab;
}) {
    return (
        <Icon
            aria-hidden="true"
            className={cn('shrink-0', className)}
            icon={getRouteTabIcon(tab)}
            size={size}
            // Inline, so the sidebar's `size-4` rule — which scales with the
            // panel's spacing token — cannot shrink the glyph along with the
            // whitespace. Density should move padding, not iconography.
            style={{ height: size, width: size }}
        />
    );
}

export function getRouteTabIcon(tab: RouteTab): IconSvgElement {
    switch (tab) {
        case 'tasks':
            return CheckListIcon;
        case 'inbox':
            return InboxIcon;
        case 'search':
            return Search01Icon;
        case 'chat':
            return Chat01Icon;
        case 'activity':
            return Activity03Icon;
        case 'members':
            return UserMultiple02Icon;
    }
}
