import { ComputerIcon, Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { AppIconRailView } from '../shell/app-icon-rail.tsx';
import { RouteTabIcon } from '../shell/route-tab-presentation.tsx';

export type HostedServerSection =
    | 'activity'
    | 'chat'
    | 'computers'
    | 'members'
    | 'reminders'
    | 'search'
    | 'settings'
    | 'tasks';

export function HostedServerRail({
    active,
    canOperate,
    onSelect,
}: {
    active: HostedServerSection;
    canOperate: boolean;
    onSelect: (section: HostedServerSection) => void;
}) {
    const items: {
        id: Exclude<HostedServerSection, 'settings'>;
        label: string;
    }[] = [
        { id: 'search', label: 'Search' },
        { id: 'chat', label: 'Chat' },
        { id: 'activity', label: 'Activity' },
        { id: 'tasks', label: 'Tasks' },
    ];
    if (canOperate) {
        items.push({ id: 'reminders', label: 'Reminders' });
    }
    items.push({ id: 'members', label: 'Members' });
    if (canOperate) {
        items.push({ id: 'computers', label: 'Computers' });
    }

    return (
        <AppIconRailView
            items={items.map((item) => ({
                content:
                    item.id === 'computers' ? (
                        <Icon
                            aria-hidden="true"
                            className="size-4.5"
                            icon={ComputerIcon}
                            size={20}
                        />
                    ) : (
                        <RouteTabIcon className="size-4.5" tab={item.id} />
                    ),
                id: item.id,
                isActive: active === item.id,
                label: item.label,
                onClick: () => onSelect(item.id),
            }))}
            settings={{
                content: (
                    <Icon aria-hidden="true" className="size-4.5" icon={Setting07Icon} size={20} />
                ),
                id: 'settings',
                isActive: active === 'settings',
                label: 'Settings',
                onClick: () => onSelect('settings'),
            }}
        />
    );
}
