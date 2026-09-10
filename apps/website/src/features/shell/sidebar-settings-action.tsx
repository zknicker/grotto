import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { ArrowLeft01Icon, Settings01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { shellBandIconSize } from './section-header.tsx';

/**
 * The sidebar's one piece of chrome: Settings, and nothing else. Server
 * identity moved out of the sidebar entirely — the navigation below now leads
 * with the Grotto mark on the Inbox row — so what is left is a single quiet
 * action with no row to justify.
 *
 * So it takes none. `shell.css` floats it at the sidebar's top-right corner,
 * over the trailing end of the first navigation row's line, and that row
 * reserves the gear's box at its own trailing end. On the macOS desktop the
 * same box lands inside the titlebar strip beside the traffic lights, which is
 * reserved space with nothing else in it. One markup shape serves both; where
 * the box lands is the shell's business, not this action's.
 */
export function SidebarSettingsAction({
    onOpenSettings,
    onPreloadSettings,
}: {
    onOpenSettings: () => void;
    onPreloadSettings: () => void;
}) {
    return (
        // `app-shell-band` is the glyph rank, not a box: the gear still sits
        // beside the 22px Grotto mark and is sized against it.
        <div className="app-shell-band app-shell-titlebar-action flex items-center">
            <Tooltip>
                <Button
                    aria-label="Settings"
                    isIconOnly
                    onHoverStart={onPreloadSettings}
                    onPress={onOpenSettings}
                    size="sm"
                    variant="ghost"
                >
                    <Icon
                        aria-hidden="true"
                        className="text-muted"
                        icon={Settings01Icon}
                        size={shellBandIconSize}
                    />
                </Button>
                <Tooltip.Content>Settings</Tooltip.Content>
            </Tooltip>
        </div>
    );
}

/**
 * Escape hatch for sidebar pages that replace the chat navigation (settings,
 * tasks, members, computers): one quiet row back to the last-open chat.
 *
 * It leads those pages the way Inbox leads the chat navigation, so the Settings
 * gear floats over its line too — but its label is one short word that stops
 * nowhere near the gear, so it claims no trailing reserve. The stock
 * `Sidebar.Group` is what puts it on the same leading edge and width as the
 * settings rows it sits above.
 */
export function SidebarBackToChatRow({ route }: { route: string }) {
    return (
        <Sidebar.Group>
            <Sidebar.Menu aria-label="Back to chat">
                <Sidebar.MenuItem
                    aria-label="Back to chat"
                    href={route}
                    id="back-to-chat"
                    textValue="Back"
                >
                    <Sidebar.MenuIcon>
                        <Icon aria-hidden="true" icon={ArrowLeft01Icon} />
                    </Sidebar.MenuIcon>
                    <Sidebar.MenuItemContent>
                        <Sidebar.MenuLabel>Back</Sidebar.MenuLabel>
                    </Sidebar.MenuItemContent>
                </Sidebar.MenuItem>
            </Sidebar.Menu>
        </Sidebar.Group>
    );
}
