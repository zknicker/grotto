import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { HostedChatMessage } from '@tavern/api';
import { Icon } from '../../../components/ui/icon.tsx';

export function ChatFiles({ messages }: { messages: HostedChatMessage[] | undefined }) {
    const attachments = messages?.flatMap((message) => message.attachments) ?? [];
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
            {attachments.length === 0 ? (
                <p className="m-auto text-muted text-sm">No files in this chat.</p>
            ) : (
                attachments.map((attachment) => (
                    <div
                        className="flex items-center gap-3 border-border border-b py-3"
                        key={attachment.id}
                    >
                        <Icon className="size-4 text-muted" icon={Attachment01Icon} />
                        <span className="text-sm">{attachment.filename}</span>
                    </div>
                ))
            )}
        </div>
    );
}
