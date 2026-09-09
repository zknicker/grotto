import type { AgentRuntimeBrowserSettings } from '@grotto/api';
import { Button, Chip, Dropdown, Label } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import { MoreHorizontalIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import type { BrowserCapabilityView } from '../../computers/browser-capability-model.ts';

type BrowserSettings = AgentRuntimeBrowserSettings;

export function BrowserRow({
    isActionPending,
    isSaving,
    onConfigure,
    onOpenBrowser,
    onRestartBrowser,
    onToggle,
    settings,
    view,
}: {
    isActionPending: boolean;
    isSaving: boolean;
    onConfigure: () => void;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onToggle: (enabled: boolean) => void;
    settings: BrowserSettings;
    view: BrowserCapabilityView;
}) {
    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Title>
                    Chrome
                    <StatusChip view={view} />
                </ItemCard.Title>
                <ItemCard.Description>{view.description}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
                {settings.configured ? (
                    <BrowserActionsMenu
                        isActionPending={isActionPending}
                        isSaving={isSaving}
                        onConfigure={onConfigure}
                        onOpenBrowser={onOpenBrowser}
                        onRestartBrowser={onRestartBrowser}
                        onToggle={onToggle}
                        view={view}
                    />
                ) : (
                    <Button
                        isDisabled={isSaving || !view.canConfigure}
                        onPress={onConfigure}
                        size="sm"
                        variant="secondary"
                    >
                        Configure
                    </Button>
                )}
            </ItemCard.Action>
        </ItemCard>
    );
}

function BrowserActionsMenu({
    isActionPending,
    isSaving,
    onConfigure,
    onOpenBrowser,
    onRestartBrowser,
    onToggle,
    view,
}: {
    isActionPending: boolean;
    isSaving: boolean;
    onConfigure: () => void;
    onOpenBrowser: () => Promise<unknown> | undefined;
    onRestartBrowser: () => Promise<unknown> | undefined;
    onToggle: (enabled: boolean) => void;
    view: BrowserCapabilityView;
}) {
    return (
        <Dropdown>
            <Button aria-label="Chrome actions" isIconOnly size="sm" variant="ghost">
                <Icon aria-hidden="true" icon={MoreHorizontalIcon} size={16} />
            </Button>
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu>
                    <Dropdown.Item
                        id="configure"
                        isDisabled={isSaving}
                        onAction={onConfigure}
                        textValue="Configure Chrome"
                    >
                        <Label>Configure</Label>
                    </Dropdown.Item>
                    {view.canOpen ? (
                        <Dropdown.Item
                            id="open"
                            isDisabled={isSaving || isActionPending}
                            onAction={() => {
                                void onOpenBrowser()?.catch(() => undefined);
                            }}
                            textValue="Open Chrome"
                        >
                            <Label>Open Chrome</Label>
                        </Dropdown.Item>
                    ) : null}
                    {view.canRestart ? (
                        <Dropdown.Item
                            id="restart"
                            isDisabled={isSaving || isActionPending}
                            onAction={() => {
                                void onRestartBrowser()?.catch(() => undefined);
                            }}
                            textValue="Restart Chrome"
                        >
                            <Label>Restart Chrome</Label>
                        </Dropdown.Item>
                    ) : null}
                    {view.canEnable ? (
                        <Dropdown.Item
                            id="enable"
                            isDisabled={isSaving}
                            onAction={() => onToggle(true)}
                            textValue="Turn on Browser"
                        >
                            <Label>Turn on Browser</Label>
                        </Dropdown.Item>
                    ) : null}
                    {view.canDisable ? (
                        <Dropdown.Item
                            id="disable"
                            isDisabled={isSaving}
                            onAction={() => onToggle(false)}
                            textValue="Turn off Browser"
                            variant="danger"
                        >
                            <Label>Turn off Browser</Label>
                        </Dropdown.Item>
                    ) : null}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}

function StatusChip({ view }: { view: BrowserCapabilityView }) {
    return (
        <Chip
            className="ms-2 align-middle"
            color={statusColor(view.status)}
            size="sm"
            variant="soft"
        >
            {view.statusLabel}
        </Chip>
    );
}

export function BrowserStatusChip({ view }: { view: BrowserCapabilityView }) {
    return <StatusChip view={view} />;
}

function statusColor(status: BrowserCapabilityView['status']) {
    switch (status) {
        case 'ready':
            return 'success' as const;
        case 'not-configured':
        case 'starting':
        case 'attention':
            return 'warning' as const;
        case 'off':
        case 'not-running':
        case 'unavailable':
            return 'default' as const;
    }
}
