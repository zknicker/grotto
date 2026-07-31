import { Button, Tooltip } from '@heroui/react';
import { ArrowLeft01Icon, Cancel01Icon, FileViewIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { writeClipboardText } from '../../../lib/clipboard.ts';

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
    const [copied, setCopied] = React.useState(false);

    return (
        <header className="flex h-12 shrink-0 items-center gap-3 border-separator border-b px-4">
            {takeover ? (
                <Tooltip>
                    <Button
                        aria-label="Back to chat"
                        isIconOnly
                        onPress={onBack}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" icon={ArrowLeft01Icon} size={18} />
                    </Button>
                    <Tooltip.Content>Back to chat</Tooltip.Content>
                </Tooltip>
            ) : null}
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <h2 className="min-w-0 truncate font-semibold text-sm">{header}</h2>
                {target ? (
                    <button
                        className="min-w-0 shrink truncate text-left text-muted text-xs hover:text-foreground"
                        onClick={async () => {
                            try {
                                await writeClipboardText(target);
                                setCopied(true);
                                window.setTimeout(() => setCopied(false), 1600);
                            } catch {
                                setCopied(false);
                            }
                        }}
                        title={copied ? 'Copied thread target' : 'Copy thread target'}
                        type="button"
                    >
                        {target}
                    </button>
                ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    isDisabled={!threadExists || followPending}
                    onPress={() => onFollowChange(!followed)}
                    size="sm"
                    variant={followed ? 'secondary' : 'ghost'}
                >
                    {followed ? 'Following' : 'Follow'}
                </Button>
                <Tooltip>
                    <Button
                        aria-label="View in channel"
                        isIconOnly
                        onPress={onViewInChannel}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" icon={FileViewIcon} size={18} />
                    </Button>
                    <Tooltip.Content>View in channel</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                    <Button
                        aria-label="Close thread"
                        isIconOnly
                        onPress={onClose}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon aria-hidden="true" icon={Cancel01Icon} size={18} />
                    </Button>
                    <Tooltip.Content>Close thread</Tooltip.Content>
                </Tooltip>
            </div>
        </header>
    );
}
