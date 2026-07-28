import { File01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useMemo } from 'react';
import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { SelectionQuoteContainer } from '../../components/quote/selection-quote.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { trpc } from '../../lib/trpc.tsx';
import { injectHostTokenStyle, readHostTokenCss } from './host-token-style.ts';
import { formatTavernResourceLink, type TavernResourceTarget } from './tavern-resource-link.ts';

export function WorkspaceArtifactContent({
    agentId,
    serverId,
    target,
}: {
    agentId: string;
    serverId?: string;
    target: Extract<TavernResourceTarget, { kind: 'workspaceFile' }>;
}) {
    const localFileQuery = trpc.agent.workspaceReadableFile.useQuery(
        { agentId, path: target.path },
        { enabled: agentId.length > 0 && !serverId }
    );
    const hostedFileQuery = grottoTrpc.agent.workspaceFile.useQuery(
        { agentId, path: target.path, serverId: serverId ?? '' },
        { enabled: agentId.length > 0 && Boolean(serverId) }
    );
    const fileQuery = serverId ? hostedFileQuery : localFileQuery;

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

    if (file.binary && !file.mediaType.startsWith('image/')) {
        return (
            <WorkspaceArtifactEmpty
                detail="Binary files cannot be previewed here yet."
                title={target.path}
            />
        );
    }

    if (file.mediaType.startsWith('image/')) {
        return (
            <div className="grid h-full min-h-0 place-items-center overflow-auto bg-muted/20 p-6">
                <img
                    alt={target.path}
                    className="h-auto max-h-full w-auto max-w-full rounded-md border border-border/60 bg-background object-contain shadow-sm"
                    height={768}
                    src={`data:${file.mediaType};base64,${file.content}`}
                    width={1024}
                />
            </div>
        );
    }

    if (file.mediaType === 'text/html') {
        return <WorkspaceHtmlPreview content={file.content} path={target.path} />;
    }

    return (
        <SelectionQuoteContainer
            className="h-full min-h-0"
            source={{ href: formatTavernResourceLink(target), label: target.path }}
        >
            <SimpleCodeEditor
                className="h-full"
                filePath={target.path}
                readOnly
                value={file.content}
            />
        </SelectionQuoteContainer>
    );
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
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-border/70 bg-muted/35">
                    <Icon className="size-4 text-muted-foreground" icon={File01Icon} />
                </div>
                <div className="truncate font-medium text-sm">{title}</div>
                <div className="mt-1 text-muted-foreground text-sm leading-6">{detail}</div>
            </div>
        </div>
    );
}
