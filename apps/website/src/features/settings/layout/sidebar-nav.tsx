import { ArrowLeft02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../../components/ui/sidebar.tsx';
import {
    type CapabilityRequirement,
    type CapabilityView,
    formatCapabilityDisabledReason,
    settingsCapabilityRequirements,
    useCapability,
} from '../../../hooks/connections/use-capability.ts';
import { settingsNavSections, staticSettingsNavItems } from './navigation.ts';

type ResolveCapability = (requirement: CapabilityRequirement) => CapabilityView;
type StaticSettingsNavItem = (typeof staticSettingsNavItems)[number];
type SettingsNavSection = (typeof settingsNavSections)[number];

const staticSettingsNavItemsById = new Map<StaticSettingsNavItem['id'], StaticSettingsNavItem>(
    staticSettingsNavItems.map((item) => [item.id, item])
);
const settingsNavSectionsById = new Map<SettingsNavSection['id'], SettingsNavSection>(
    settingsNavSections.map((section) => [section.id, section])
);

export function SettingsSidebarNav({ onBackToApp }: { onBackToApp?: () => void }) {
    const capability = useCapability();
    return <SettingsSidebarNavView capability={capability} onBackToApp={onBackToApp} />;
}

export function SettingsSidebarNavView({
    capability,
    hiddenItemIds,
    onBackToApp,
    resolveTo = (to) => to,
}: {
    capability?: ResolveCapability;
    hiddenItemIds?: ReadonlySet<StaticSettingsNavItem['id']>;
    onBackToApp?: () => void;
    resolveTo?: (to: string, item: StaticSettingsNavItem) => string;
}) {
    const generalSection = settingsNavSectionsById.get('general');
    const activitySection = settingsNavSectionsById.get('activity');
    return (
        <>
            {onBackToApp ? <BackToAppSection onBackToApp={onBackToApp} /> : null}
            <StaticSettingsSection
                capability={capability}
                hiddenItemIds={hiddenItemIds}
                itemIds={generalSection?.itemIds ?? []}
                label={generalSection?.label ?? 'General'}
                resolveTo={resolveTo}
            />
            <StaticSettingsSection
                capability={capability}
                hiddenItemIds={hiddenItemIds}
                itemIds={activitySection?.itemIds ?? []}
                label={activitySection?.label ?? 'Activity'}
                resolveTo={resolveTo}
            />
        </>
    );
}

function BackToAppSection({ onBackToApp }: { onBackToApp: () => void }) {
    return (
        <SidebarGroup className="pt-2">
            <SidebarGroupContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton className="text-sidebar-muted" onClick={onBackToApp}>
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={ArrowLeft02Icon}
                                size={18}
                            />
                            <span className="min-w-0 truncate">Back to app</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function StaticSettingsSection({
    capability,
    hiddenItemIds,
    itemIds,
    label,
    resolveTo,
}: {
    capability?: ResolveCapability;
    hiddenItemIds?: ReadonlySet<StaticSettingsNavItem['id']>;
    itemIds: readonly StaticSettingsNavItem['id'][];
    label: string;
    resolveTo: (to: string, item: StaticSettingsNavItem) => string;
}) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarGroupContent>
                <SidebarMenu>
                    {itemIds.map((itemId) => {
                        if (hiddenItemIds?.has(itemId)) {
                            return null;
                        }
                        const item = staticSettingsNavItemsById.get(itemId);

                        if (!item) {
                            return null;
                        }

                        return (
                            <StaticSettingsNavRow
                                capability={capability}
                                item={item}
                                key={item.id}
                                resolveTo={resolveTo}
                            />
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

function StaticSettingsNavRow({
    capability,
    item,
    resolveTo,
}: {
    capability?: ResolveCapability;
    item: StaticSettingsNavItem;
    resolveTo: (to: string, item: StaticSettingsNavItem) => string;
}) {
    const gate = capability?.(settingsCapabilityRequirements[item.id]);
    const disabledReason = gate && !gate.healthy ? formatCapabilityDisabledReason(gate) : null;

    return (
        <SidebarMenuItem>
            {!gate || gate.healthy ? (
                <NavLink className="contents" to={resolveTo(item.to, item)}>
                    {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} render={<div />}>
                            <Icon
                                aria-hidden="true"
                                className="shrink-0"
                                icon={item.icon}
                                size={18}
                            />
                            <span className="min-w-0 truncate">{item.label}</span>
                        </SidebarMenuButton>
                    )}
                </NavLink>
            ) : (
                <SidebarMenuButton
                    className="w-fit max-w-full"
                    disabled
                    isActive={false}
                    tooltip={disabledReason ?? item.label}
                >
                    <Icon aria-hidden="true" className="shrink-0" icon={item.icon} size={18} />
                    <span className="min-w-0 truncate">{item.label}</span>
                </SidebarMenuButton>
            )}
        </SidebarMenuItem>
    );
}
