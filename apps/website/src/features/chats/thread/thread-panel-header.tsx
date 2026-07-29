import { ArrowLeft01Icon, Cancel01Icon, FileViewIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { PaneTopbar, PaneTopbarTitle } from '../../../components/ui/pane.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
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
        <PaneTopbar>
            {takeover ? (
                <Button aria-label="Back to chat" onClick={onBack} size="icon-xs" variant="ghost">
                    <Icon className="size-4" icon={ArrowLeft01Icon} />
                </Button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <PaneTopbarTitle>{header}</PaneTopbarTitle>
                {target ? (
                    <button
                        className="min-w-0 shrink truncate text-left text-meta text-muted-foreground hover:text-foreground"
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
            <Button
                disabled={!threadExists || followPending}
                onClick={() => onFollowChange(!followed)}
                size="sm"
                variant={followed ? 'secondary' : 'ghost'}
            >
                {followed ? 'Following' : 'Follow'}
            </Button>
            <Button
                aria-label="View in channel"
                onClick={onViewInChannel}
                size="icon-xs"
                title="View in channel"
                variant="ghost"
            >
                <Icon className="size-4" icon={FileViewIcon} />
            </Button>
            <Button aria-label="Close thread" onClick={onClose} size="icon-xs" variant="ghost">
                <Icon className="size-4" icon={Cancel01Icon} />
            </Button>
        </PaneTopbar>
    );
}
