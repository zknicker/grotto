import { Sidebar } from '@heroui-pro/react';
import { ArrowLeft01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { serverActivityRoute, serverSettingsSectionRoute } from '../servers/server-routes.ts';
import {
    type SettingsRouteTab,
    settingsNavItems,
    settingsNavSections,
} from '../settings/layout/navigation.ts';

const hostedHiddenSettings: ReadonlySet<string> = new Set(['agent-runtime']);

/** Settings navigation sidebar for the hosted server settings routes. */
export function SettingsSidebar({
    currentSection,
    slug,
}: {
    currentSection: SettingsRouteTab | undefined;
    slug: string;
}) {
    const itemById = new Map(settingsNavItems.map((item) => [item.id, item]));
    return (
        <Sidebar aria-label="Settings">
            <Sidebar.Header>
                <div className="px-2 py-1 font-semibold text-sm">Settings</div>
            </Sidebar.Header>
            <Sidebar.Content>
                <Sidebar.Menu aria-label="Back">
                    <Sidebar.MenuItem
                        href={serverActivityRoute(slug)}
                        id="back-to-app"
                        textValue="Back to app"
                    >
                        <Sidebar.MenuIcon>
                            <Icon aria-hidden="true" icon={ArrowLeft01Icon} />
                        </Sidebar.MenuIcon>
                        <Sidebar.MenuItemContent>
                            <Sidebar.MenuLabel>Back to app</Sidebar.MenuLabel>
                        </Sidebar.MenuItemContent>
                    </Sidebar.MenuItem>
                </Sidebar.Menu>
                {settingsNavSections.map((section) => {
                    const items = section.itemIds
                        .filter((id) => !hostedHiddenSettings.has(id))
                        .map((id) => itemById.get(id))
                        .filter((item) => item !== undefined);
                    if (items.length === 0) {
                        return null;
                    }
                    return (
                        <Sidebar.Group key={section.id}>
                            <Sidebar.GroupLabel>{section.label}</Sidebar.GroupLabel>
                            <Sidebar.Menu aria-label={section.label}>
                                {items.map((item) => (
                                    <Sidebar.MenuItem
                                        href={serverSettingsSectionRoute(slug, item.id)}
                                        id={item.id}
                                        isCurrent={item.id === currentSection}
                                        key={item.id}
                                        textValue={item.label}
                                    >
                                        <Sidebar.MenuIcon>
                                            <Icon aria-hidden="true" icon={item.icon} />
                                        </Sidebar.MenuIcon>
                                        <Sidebar.MenuItemContent>
                                            <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                                        </Sidebar.MenuItemContent>
                                    </Sidebar.MenuItem>
                                ))}
                            </Sidebar.Menu>
                        </Sidebar.Group>
                    );
                })}
            </Sidebar.Content>
        </Sidebar>
    );
}
