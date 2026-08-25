import { Button, Dropdown, Label, Tooltip, toast } from '@heroui/react';
import {
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowUpRight01Icon,
    Cancel01Icon,
    Copy01Icon,
    Notification01Icon,
    NotificationOff01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { bandHeightClassName, shellNavigationIconSize } from '../../shell/section-header.tsx';

export function ThreadPanelHeader({
    followed,
    followPending,
    header,
    onBack,
    onClose,
    onFollowChange,
    onViewInChannel,
    target,
    takeover,
    threadExists,
}: {
    followed: boolean;
    followPending: boolean;
    header: string;
    onBack: () => void;
    onClose: () => void;
    onFollowChange: (follow: boolean) => void;
    onViewInChannel: () => void;
    target: null | string;
    takeover: boolean;
    threadExists: boolean;
}) {
    return (
        <header
            className={`flex ${bandHeightClassName} shrink-0 items-center gap-3 border-separator border-b px-5`}
        >
            {takeover ? (
                <Tooltip>
                    <Button
                        aria-label="Back to chat"
                        isIconOnly
                        onPress={onBack}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            icon={ArrowLeft01Icon}
                            size={shellNavigationIconSize}
                        />
                    </Button>
                    <Tooltip.Content>Back to chat</Tooltip.Content>
                </Tooltip>
            ) : null}
            {/* The name is the menu, mirroring the chat topbar: one control
                on the leading edge, and the trailing edge keeps only close. */}
            <div className="flex min-w-0 flex-1 items-center">
                <Dropdown>
                    <Button
                        aria-label={`${header} — thread actions`}
                        className="-ms-2 min-w-0 gap-2 px-2"
                        size="sm"
                        variant="ghost"
                    >
                        <span className="truncate font-semibold text-sm">{header}</span>
                        <Icon
                            aria-hidden="true"
                            className="text-muted"
                            icon={ArrowDown01Icon}
                            size={15}
                        />
                    </Button>
                    <Dropdown.Popover placement="bottom start">
                        <Dropdown.Menu
                            onAction={(key) => {
                                if (key === 'view') {
                                    onViewInChannel();
                                    return;
                                }
                                if (key === 'follow') {
                                    onFollowChange(!followed);
                                    return;
                                }
                                if (key === 'copy' && target) {
                                    writeClipboardText(target)
                                        .then(() => toast.success('Reference copied'))
                                        .catch(() =>
                                            toast.danger('Could not copy the thread reference')
                                        );
                                }
                            }}
                        >
                            <Dropdown.Item id="view" textValue="View in chat">
                                <Icon icon={ArrowUpRight01Icon} size={16} />
                                <Label>View in chat</Label>
                            </Dropdown.Item>
                            <Dropdown.Item
                                id="copy"
                                isDisabled={!target}
                                textValue="Copy reference"
                            >
                                <Icon icon={Copy01Icon} size={16} />
                                <Label>Copy reference</Label>
                            </Dropdown.Item>
                            {/* Following is automatic on participation, so this
                                is the escape hatch: its replies stop counting
                                toward the parent chat's unread badge. */}
                            <Dropdown.Item
                                id="follow"
                                isDisabled={!threadExists || followPending}
                                textValue={followed ? 'Stop following thread' : 'Follow thread'}
                            >
                                <Icon
                                    icon={followed ? NotificationOff01Icon : Notification01Icon}
                                    size={16}
                                />
                                <Label>
                                    {followed ? 'Stop following thread' : 'Follow thread'}
                                </Label>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>
            </div>
            <Tooltip>
                <Button
                    aria-label="Close thread"
                    isIconOnly
                    onPress={onClose}
                    size="sm"
                    variant="ghost"
                >
                    <Icon aria-hidden="true" icon={Cancel01Icon} size={shellNavigationIconSize} />
                </Button>
                <Tooltip.Content>Close thread</Tooltip.Content>
            </Tooltip>
        </header>
    );
}
