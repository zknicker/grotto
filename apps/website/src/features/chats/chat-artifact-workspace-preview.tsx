import { ToggleButton } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { CodeBlock } from '@heroui-pro/react/code-block';
import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo, useState } from 'react';
import { agentHtmlSandbox } from '../../agent-html/sandbox.ts';
import { agentHtmlTokenCss, injectHostTokenStyle } from '../../agent-html/tokens.ts';
import { CopyButton } from '../../components/copy-button.tsx';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { formatGrottoResourceLink, type GrottoResourceTarget } from './grotto-resource-link.ts';

export function WorkspaceArtifactContent({
    agentId,
    includeHidden = false,
    serverId,
    target,
}: {
    agentId: string;
    includeHidden?: boolean;
    serverId: string;
    target: Extract<GrottoResourceTarget, { kind: 'workspaceFile' }>;
}) {
    const serverFileQuery = grottoTrpc.agent.workspaceFile.useQuery(
        { agentId, includeHidden, path: target.path, serverId },
        { ...queryPolicy.computerSnapshot, enabled: agentId.length > 0 }
    );
    const fileQuery = serverFileQuery;
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
    // Files whose source renders through the code view (markdown included —
    // its Raw mode is that view). Images and HTML previews are not source.
    const sourceFile =
        !(file.binary || file.mediaType.startsWith('image/')) && file.mediaType !== 'text/html';

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
            {/* Same vertical padding and control step as the rail's toolbar
                row, so the controls sit on one line with the search field
                and filter button beside it — but the shell band's `px-3`
                trailing inset, so the edge gap matches the tab strip
                directly above. One ToggleButton, not a two-button pair — Raw
                is a mode, and the tab bar above is already a row of segmented
                choices. */}
            {sourceFile ? (
                <div className="flex shrink-0 items-center justify-end gap-1 py-2 ps-2 pe-3">
                    <CopyButton label="Copy file contents" value={file.content} />
                    {markdown ? (
                        <ToggleButton
                            isSelected={raw}
                            onChange={(selected) => setRawPath(selected ? target.path : null)}
                        >
                            Raw
                        </ToggleButton>
                    ) : null}
                </div>
            ) : null}
            {file.truncated ? (
                <div className="shrink-0 border-separator border-b bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
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
            {/* File facts are status, not chrome: a quiet footer keeps them
                available without competing with the tab bar above. Language
                sits trailing, editor-status-bar style. */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-separator border-t px-3 py-1.5">
                <span className="min-w-0 truncate text-muted text-xs tabular-nums">
                    {formatWorkspaceFileMetadata(file.sizeBytes, file.updatedAt)}
                </span>
                {sourceFile ? (
                    <span className="shrink-0 text-muted text-xs">
                        {workspaceFileLanguage(target.path).label}
                    </span>
                ) : null}
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
    target: Extract<GrottoResourceTarget, { kind: 'workspaceFile' }>;
}) {
    if (mediaType.startsWith('image/')) {
        return (
            <div className="grid h-full min-h-0 place-items-center overflow-auto bg-surface-secondary p-6">
                <img
                    alt={path}
                    className="h-auto max-h-full w-auto max-w-full rounded-md border border-separator bg-background object-contain"
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
            <div className="h-full overflow-auto px-6 py-5 text-base">
                <ChatMarkdownText content={content} />
            </div>
        );
    }
    // Stock CodeBlock (the app's one code renderer) rather than a read-only
    // editor: the raw view only ever displays, and this is what retired the
    // prismjs/react-simple-code-editor pipeline. `.code-pane` (theme layer)
    // sheds the root's snippet-card chrome so the code fills the pane on its
    // own ground; copy lives in the pane toolbar and the language in the
    // status footer, so no header here.
    return (
        <div className="code-pane h-full min-h-0 overflow-auto px-3 py-2">
            <SelectionQuoteContainer
                source={{ href: formatGrottoResourceLink(target), label: path }}
            >
                <CodeBlock>
                    <CodeBlock.Code code={content} language={workspaceFileLanguage(path).id} />
                </CodeBlock>
            </SelectionQuoteContainer>
        </div>
    );
}

/** Shiki language for a workspace file, by extension; plain text otherwise. */
function workspaceFileLanguage(path: string): { id: string; label: string } {
    const extension = path.split('.').at(-1)?.toLowerCase() ?? '';
    switch (extension) {
        case 'cjs':
        case 'js':
        case 'mjs':
            return { id: 'javascript', label: 'JavaScript' };
        case 'cts':
        case 'mts':
        case 'ts':
            return { id: 'typescript', label: 'TypeScript' };
        case 'jsx':
        case 'tsx':
            return { id: 'tsx', label: 'TSX' };
        case 'json':
        case 'jsonc':
            return { id: 'json', label: 'JSON' };
        case 'css':
            return { id: 'css', label: 'CSS' };
        case 'md':
        case 'mdx':
            return { id: 'markdown', label: 'Markdown' };
        case 'py':
            return { id: 'python', label: 'Python' };
        case 'sh':
        case 'bash':
        case 'zsh':
            return { id: 'shellscript', label: 'Shell' };
        case 'yaml':
        case 'yml':
            return { id: 'yaml', label: 'YAML' };
        case 'toml':
            return { id: 'toml', label: 'TOML' };
        default:
            return { id: 'text', label: 'Text' };
    }
}

export function formatWorkspaceFileMetadata(sizeBytes: number, updatedAt: string | null) {
    const parts = [formatWorkspaceFileBytes(sizeBytes)];
    if (updatedAt) {
        parts.push(
            `Modified ${new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(updatedAt))}`
        );
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
 * page styled with tokens wears the Grotto look and follows the app scheme.
 * Opaque origin, never allow-same-origin.
 */
function WorkspaceHtmlPreview({ content, path }: { content: string; path: string }) {
    const scheme = useResolvedThemeOptional();
    const srcDoc = useMemo(
        () => injectHostTokenStyle(content, agentHtmlTokenCss(scheme)),
        [content, scheme]
    );

    return (
        <iframe
            className="h-full min-h-0 w-full"
            sandbox={agentHtmlSandbox}
            srcDoc={srcDoc}
            style={{ colorScheme: scheme }}
            title={path}
        />
    );
}

export function WorkspaceArtifactEmpty({ detail, title }: { detail: string; title: string }) {
    return (
        // Upper third, not dead center: a vertically centered message in a
        // tall pane floats unanchored. Stock EmptyState anatomy, like every
        // other empty state in the app — the hand-rolled bordered icon box
        // this replaces matched nothing.
        <div className="flex h-full min-h-0 justify-center overflow-auto px-8 pt-[18vh]">
            <EmptyState>
                <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                        <Icon className="size-5" icon={File01Icon} />
                    </EmptyState.Media>
                    <EmptyState.Title className="max-w-sm truncate">{title}</EmptyState.Title>
                    <EmptyState.Description className="max-w-sm text-pretty">
                        {detail}
                    </EmptyState.Description>
                </EmptyState.Header>
            </EmptyState>
        </div>
    );
}
