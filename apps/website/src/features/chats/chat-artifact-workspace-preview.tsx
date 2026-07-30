import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo, useState } from 'react';
import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { injectHostTokenStyle, readHostTokenCss } from './host-token-style.ts';
import { formatTavernResourceLink, type TavernResourceTarget } from './tavern-resource-link.ts';

export function WorkspaceArtifactContent({
    agentId,
    includeHidden = false,
    serverId,
    target,
}: {
    agentId: string;
    includeHidden?: boolean;
    serverId?: string;
    target: Extract<TavernResourceTarget, { kind: 'workspaceFile' }>;
}) {
    const localFileQuery = trpc.agent.workspaceReadableFile.useQuery(
        { agentId, includeHidden, path: target.path },
        { enabled: agentId.length > 0 && !serverId }
    );
    const hostedFileQuery = grottoTrpc.agent.workspaceFile.useQuery(
        { agentId, includeHidden, path: target.path, serverId: serverId ?? '' },
        { enabled: agentId.length > 0 && Boolean(serverId) }
    );
    const fileQuery = serverId ? hostedFileQuery : localFileQuery;
    const [rawPath, setRawPath] = useState<string | null>(null);

    if (!agentId) {
        return (
            <WorkspaceArtifactEmpty
                detail="No active agent workspace is available."
                title={target.path}
            />
        );
    }

    if (fileQuery.isPending) {
        return <WorkspaceArtifactEmpty detail="Loading workspace file..." title={target.path} />;
    }

    if (fileQuery.error) {
        return (
            <WorkspaceArtifactEmpty
                detail="Unable to load this workspace file."
                title={target.path}
            />
        );
    }

    const file = fileQuery.data;
    const markdown = file.mediaType === 'text/markdown' || /\.(?:md|mdx)$/iu.test(target.path);
    const raw = rawPath === target.path;

    if (file.binary && !file.mediaType.startsWith('image/')) {
        return (
            <WorkspaceArtifactEmpty
                detail="Binary files cannot be previewed here yet."
                title={target.path}
            />
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-border-subtle border-b px-3">
                <span className="min-w-0 truncate text-meta text-muted-foreground">
                    {formatWorkspaceFileMetadata(file.sizeBytes, file.updatedAt)}
                </span>
                {markdown ? (
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            onClick={() => setRawPath(null)}
                            size="xs"
                            variant={raw ? 'ghost' : 'secondary'}
                        >
                            Preview
                        </Button>
                        <Button
                            onClick={() => setRawPath(target.path)}
                            size="xs"
                            variant={raw ? 'secondary' : 'ghost'}
                        >
                            Raw
                        </Button>
                    </div>
                ) : null}
            </div>
            {file.truncated ? (
                <div className="shrink-0 border-warning/30 border-b bg-warning/10 px-3 py-2 text-warning-foreground text-xs">
                    Preview truncated. This file is {formatWorkspaceFileBytes(file.sizeBytes)}.
                </div>
            ) : null}
            <div className="min-h-0 flex-1">
                <WorkspaceFilePreview
                    content={file.content}
                    mediaType={file.mediaType}
                    path={target.path}
                    raw={raw}
                    target={target}
                />
            </div>
        </div>
    );
}

function WorkspaceFilePreview({
    content,
    mediaType,
    path,
    raw,
    target,
}: {
    content: string;
    mediaType: string;
    path: string;
    raw: boolean;
    target: Extract<TavernResourceTarget, { kind: 'workspaceFile' }>;
}) {
    if (mediaType.startsWith('image/')) {
        return (
            <div className="grid h-full min-h-0 place-items-center overflow-auto bg-muted p-6">
                <img
                    alt={path}
                    className="h-auto max-h-full w-auto max-w-full rounded-md border border-border bg-background object-contain"
                    height={768}
                    src={`data:${mediaType};base64,${content}`}
                    width={1024}
                />
            </div>
        );
    }
    if (mediaType === 'text/html') {
        return <WorkspaceHtmlPreview content={content} path={path} />;
    }
    if (!raw && (mediaType === 'text/markdown' || /\.(?:md|mdx)$/iu.test(path))) {
        return (
            <div className="h-full overflow-auto px-6 py-5 text-sm">
                <ChatMarkdownText content={content} />
            </div>
        );
    }
    return (
        <SelectionQuoteContainer
            className="h-full min-h-0"
            source={{ href: formatTavernResourceLink(target), label: path }}
        >
            <SimpleCodeEditor className="h-full" filePath={path} readOnly value={content} />
        </SelectionQuoteContainer>
    );
}

export function formatWorkspaceFileMetadata(sizeBytes: number, updatedAt: string | null) {
    const parts = [formatWorkspaceFileBytes(sizeBytes)];
    if (updatedAt) {
        parts.push(`Modified ${new Date(updatedAt).toLocaleString()}`);
    }
    return parts.join(' · ');
}

export function formatWorkspaceFileBytes(sizeBytes: number) {
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Sandboxed HTML preview with host tokens riding in: artifacts (and any
 * workspace HTML file) get the app's resolved theme variables injected, so a
 * page styled with tokens wears the Tavern look and follows the app scheme.
 * Opaque origin, never allow-same-origin.
 */
function WorkspaceHtmlPreview({ content, path }: { content: string; path: string }) {
    const scheme = useResolvedThemeOptional();
    const srcDoc = useMemo(
        () => injectHostTokenStyle(content, readHostTokenCss(scheme)),
        [content, scheme]
    );

    return (
        <iframe
            className="h-full min-h-0 w-full"
            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-scripts"
            srcDoc={srcDoc}
            style={{ colorScheme: scheme }}
            title={path}
        />
    );
}

export function WorkspaceArtifactEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        <div className="grid h-full min-h-0 place-items-center px-8 text-center">
            <div className="max-w-sm">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className="mt-1 text-muted-foreground text-sm leading-6">{detail}</div>
            </div>
        </div>
    );
}
