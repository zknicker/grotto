import { type WidgetArtifactProps, widgetArtifactPropsSchema } from '@tavern/api/widgets/artifact';
import { WidgetArtifactCard } from '../../widgets/artifact-card.tsx';
import { ArtifactPanelOpenProvider } from '../chats/artifact-panel-context.tsx';
import { ChatMarkdownText } from '../chats/chat-markdown-text.tsx';
import type { TavernResourceTarget } from '../chats/tavern-resource-link.ts';

type HostedArtifactMessageSegment =
    | { key: string; kind: 'artifact'; props: WidgetArtifactProps }
    | { key: string; kind: 'text'; text: string };

export function HostedArtifactMessage({
    agentId,
    content,
    onOpenArtifact,
}: {
    agentId: string;
    content: string;
    onOpenArtifact: (target: TavernResourceTarget) => void;
}) {
    const segments = splitHostedArtifactFences(content);

    return (
        <ArtifactPanelOpenProvider agentId={agentId} onOpen={onOpenArtifact}>
            <div className="flex min-w-0 max-w-[46rem] flex-col gap-3">
                {segments.map((segment) =>
                    segment.kind === 'artifact' ? (
                        <WidgetArtifactCard key={segment.key} props={segment.props} />
                    ) : (
                        <ChatMarkdownText content={segment.text} key={segment.key} />
                    )
                )}
            </div>
        </ArtifactPanelOpenProvider>
    );
}

export function splitHostedArtifactFences(content: string): HostedArtifactMessageSegment[] {
    const fence = /```artifact[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/gu;
    const segments: HostedArtifactMessageSegment[] = [];
    let cursor = 0;

    for (const match of content.matchAll(fence)) {
        const matchIndex = match.index;
        const parsed = parseArtifactProps(match[1] ?? '');
        if (!(parsed && matchIndex !== undefined)) {
            continue;
        }
        if (matchIndex > cursor) {
            segments.push({
                key: `text:${cursor}:${matchIndex}`,
                kind: 'text',
                text: content.slice(cursor, matchIndex),
            });
        }
        segments.push({
            key: `artifact:${matchIndex}:${match[0].length}`,
            kind: 'artifact',
            props: parsed,
        });
        cursor = matchIndex + match[0].length;
    }

    if (cursor < content.length || segments.length === 0) {
        segments.push({
            key: `text:${cursor}:${content.length}`,
            kind: 'text',
            text: content.slice(cursor),
        });
    }
    return segments;
}

function parseArtifactProps(source: string) {
    try {
        return widgetArtifactPropsSchema.parse(JSON.parse(source));
    } catch {
        return null;
    }
}
