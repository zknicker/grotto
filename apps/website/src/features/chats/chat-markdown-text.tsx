import type { Mention, ReferenceActivation } from '../mentions/mention-types.ts';
import { ReferenceChip } from '../mentions/reference-chip.tsx';
import { ReferenceMarkdown } from '../mentions/reference-markdown.tsx';
import { splitMentionText } from '../mentions/render-mention-text.tsx';
import { renderInlineMarkdown } from './chat-inline-markdown-renderer.tsx';
import type { ChatTextAnimationRange } from './chat-inline-text-animation.tsx';
import { type ChatMarkdownHeadingBlock, parseChatMarkdownBlocks } from './chat-markdown-blocks.ts';

export function ChatMarkdownText({
    animatedRanges = [],
    content,
    mentions,
    onReferenceActivate,
}: {
    animatedRanges?: readonly ChatTextAnimationRange[];
    content: string;
    mentions?: readonly Mention[];
    onReferenceActivate?: ReferenceActivation;
}) {
    if (animatedRanges.length === 0) {
        return (
            <ReferenceMarkdown
                className="chat-markdown text-base"
                content={content}
                mentions={mentions}
                onReferenceActivate={onReferenceActivate}
            />
        );
    }

    const blocks = parseChatMarkdownBlocks(content);

    return blocks.map((block) => {
        if (block.kind === 'heading') {
            return (
                <ChatMarkdownHeading
                    animatedRanges={animatedRanges}
                    block={block}
                    key={`heading:${block.start}`}
                    mentions={mentions}
                    onReferenceActivate={onReferenceActivate}
                />
            );
        }

        if (block.text.trim().length === 0) {
            return null;
        }

        return (
            <p
                className="my-0 whitespace-pre-wrap break-words text-base [overflow-wrap:anywhere]"
                key={`prose:${block.start}`}
            >
                {renderMarkdownInline({
                    animatedRanges,
                    content: block.text,
                    keyPrefix: `prose:${block.start}`,
                    mentions: sliceMentions(mentions, block.start, block.start + block.text.length),
                    onReferenceActivate,
                    sourceOffset: block.start,
                })}
            </p>
        );
    });
}

function renderMarkdownInline({
    animatedRanges,
    content,
    keyPrefix,
    mentions,
    onReferenceActivate,
    sourceOffset,
}: {
    animatedRanges: readonly ChatTextAnimationRange[];
    content: string;
    keyPrefix: string;
    mentions?: readonly Mention[];
    onReferenceActivate?: ReferenceActivation;
    sourceOffset: number;
}) {
    if (!mentions || mentions.length === 0) {
        return renderInlineMarkdown(content, keyPrefix, 0, {
            animatedRanges,
            sourceOffset,
        });
    }

    return splitMentionText(content, mentions).flatMap((fragment, index) => {
        if (fragment.type === 'mention') {
            return (
                <ReferenceChip
                    id={fragment.mention.id}
                    key={`mention:${fragment.mention.start}:${fragment.mention.end}`}
                    kind={fragment.mention.kind}
                    label={fragment.mention.label}
                    metadata={fragment.mention.metadata}
                    onActivate={onReferenceActivate}
                />
            );
        }

        return renderInlineMarkdown(
            fragment.text,
            `${keyPrefix}:text:${fragment.start}:${index}`,
            0,
            {
                animatedRanges,
                sourceOffset: sourceOffset + fragment.start,
            }
        );
    });
}

function ChatMarkdownHeading({
    animatedRanges,
    block,
    mentions,
    onReferenceActivate,
}: {
    animatedRanges: readonly ChatTextAnimationRange[];
    block: ChatMarkdownHeadingBlock;
    mentions?: readonly Mention[];
    onReferenceActivate?: ReferenceActivation;
}) {
    const content = renderMarkdownInline({
        animatedRanges,
        content: block.text,
        keyPrefix: `heading:${block.start}`,
        mentions: sliceMentions(mentions, block.textStart, block.textStart + block.text.length),
        onReferenceActivate,
        sourceOffset: block.textStart,
    });

    if (block.depth === 1) {
        return (
            <h1 className="mt-4 mb-2 whitespace-normal break-words font-semibold text-xl leading-8 [overflow-wrap:anywhere] first:mt-0">
                {content}
            </h1>
        );
    }

    if (block.depth === 2) {
        return (
            <h2 className="mt-4 mb-1.5 whitespace-normal break-words font-semibold text-lg leading-7 [overflow-wrap:anywhere] first:mt-0">
                {content}
            </h2>
        );
    }

    return (
        <h3 className="mt-3 mb-1 whitespace-normal break-words font-semibold text-base leading-6 [overflow-wrap:anywhere] first:mt-0">
            {content}
        </h3>
    );
}

function sliceMentions(
    mentions: readonly Mention[] | undefined,
    start: number,
    end: number
): Mention[] | undefined {
    if (!mentions || mentions.length === 0) {
        return undefined;
    }

    return mentions
        .filter((mention) => mention.start >= start && mention.end <= end)
        .map((mention) => ({
            ...mention,
            end: mention.end - start,
            start: mention.start - start,
        }));
}
