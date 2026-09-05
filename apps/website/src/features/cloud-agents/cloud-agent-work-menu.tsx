import type { CloudAgentWork } from '@grotto/api';
import { Button, Dropdown, Label, toast } from '@heroui/react';
import {
    ArrowUpRight01Icon,
    BubbleChatIcon,
    Cancel01Icon,
    Copy01Icon,
    MoreHorizontalIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { writeClipboardText } from '../../lib/clipboard.ts';
import { openExternalLink } from '../../lib/open-external-link.ts';
import { cn } from '../../lib/utils.ts';
import { useServerContext } from '../servers/server-context.ts';
import { appLink, serverChatRoute } from '../servers/server-routes.ts';
import { cloudAgentProviderLabels } from './cloud-agent-presentation.ts';
import { useCloudAgentCancelAction } from './use-cloud-agent-cancel-action.ts';

/**
 * Everything a human can do to one Cloud Agent work, in the surface's overflow
 * menu rather than a band of buttons: the work is a record to watch, not a
 * form to answer. Cancel is an Owner and Admin control; everyone else asks in
 * the Thread.
 */
export function CloudAgentWorkMenu({
    className,
    conversationChatId,
    onOpenThread,
    work,
}: {
    className?: string;
    /** The Channel or DM the link points at, never a Thread. */
    conversationChatId: string;
    onOpenThread?: () => void;
    work: CloudAgentWork;
}) {
    const { server } = useServerContext();
    const cancel = useCloudAgentCancelAction(work);
    const providerLabel = cloudAgentProviderLabels[work.provider];

    const runAction = (key: React.Key) => {
        if (key === 'thread') {
            onOpenThread?.();
            return;
        }
        if (key === 'provider' && work.providerUrl) {
            openExternalLink(work.providerUrl).catch(() =>
                toast.danger(`Could not open ${providerLabel}`)
            );
            return;
        }
        if (key === 'link') {
            writeClipboardText(appLink(serverChatRoute(server.slug, conversationChatId)))
                .then(() => toast.success('Link copied'))
                .catch(() => toast.danger('Could not copy the link'));
            return;
        }
        if (key === 'cancel') {
            cancel.requestCancel();
        }
    };

    return (
        <Dropdown>
            <Button
                aria-label={`${work.title} — Cloud Agent actions`}
                className={cn('shrink-0', className)}
                isIconOnly
                size="sm"
                variant="ghost"
            >
                <Icon aria-hidden="true" icon={MoreHorizontalIcon} size={16} />
            </Button>
            <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu onAction={runAction}>
                    {onOpenThread ? (
                        <Dropdown.Item id="thread" textValue="Open thread">
                            <Icon icon={BubbleChatIcon} size={16} />
                            <Label>Open thread</Label>
                        </Dropdown.Item>
                    ) : null}
                    <Dropdown.Item
                        id="provider"
                        isDisabled={!work.providerUrl}
                        textValue={`Open in ${providerLabel}`}
                    >
                        <Icon icon={ArrowUpRight01Icon} size={16} />
                        <Label>Open in {providerLabel}</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="link" textValue="Copy link">
                        <Icon icon={Copy01Icon} size={16} />
                        <Label>Copy link</Label>
                    </Dropdown.Item>
                    {cancel.canCancel ? (
                        <Dropdown.Item
                            id="cancel"
                            isDisabled={cancel.isPending}
                            textValue="Cancel run"
                            variant="danger"
                        >
                            <Icon icon={Cancel01Icon} size={16} />
                            <Label>Cancel run</Label>
                        </Dropdown.Item>
                    ) : null}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
