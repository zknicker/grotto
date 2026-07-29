import { Attachment01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useChatFiles } from '../../hooks/chats/use-chat-files.ts';
import type { ChatFilesOutput } from '../../lib/trpc.tsx';

export function ChatFilesTab({ chatId, enabled }: { chatId: string; enabled: boolean }) {
    const filesQuery = useChatFiles(chatId, { enabled });

    if (filesQuery.isPending) {
        return (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <Spinner aria-label="Loading files" />
            </div>
        );
    }

    // Sync-first: a failed background refetch must not blank the last good
    // list — the error blocks only when nothing was ever loaded.
    if (filesQuery.isError && !filesQuery.data) {
        return (
            <p className="px-5 py-8 text-destructive text-sm">
                Could not load files for this chat.
            </p>
        );
    }

    const files = filesQuery.data?.files ?? [];

    if (files.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Icon icon={Attachment01Icon} />
                    </EmptyMedia>
                    <EmptyTitle size="sm">No files yet</EmptyTitle>
                    <EmptyDescription size="sm">
                        Attach files in Chat, or drag files into the message composer. They will
                        appear here after the message is sent.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <ul className="divide-y divide-border">
                {files.map((file) => (
                    <ChatFileRow file={file} key={file.id} />
                ))}
            </ul>
        </div>
    );
}

function ChatFileRow({ file }: { file: ChatFilesOutput['files'][number] }) {
    return (
        <li className="flex min-w-0 items-center gap-3 px-5 py-3">
            <Icon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
                icon={Attachment01Icon}
            />
            <div className="min-w-0">
                <p className="truncate font-semibold text-foreground text-sm">{file.filename}</p>
                <p className="truncate text-meta text-muted-foreground">
                    {file.sizeBytes === null ? null : `${formatBytes(file.sizeBytes)} · `}
                    {file.senderName} · <RelativeTime value={file.at} />
                </p>
            </div>
        </li>
    );
}

function formatBytes(value: number) {
    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
