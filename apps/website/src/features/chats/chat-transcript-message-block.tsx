'use client';

import { ChatMessage } from '@heroui-pro/react';
import { type HTMLMotionProps, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AttachmentGroup } from '../../components/chats/attachment.tsx';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';

export interface TranscriptMessageBlockProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    animateEnter?: boolean;
    attachments?: ReactNode;
    children?: ReactNode;
    from: 'user' | 'assistant';
}

/**
 * One message inside a transcript turn: attachments strip plus prose body,
 * rendered through the stock Pro ChatMessage media/content slots. Every
 * message — the owner's included — reads as left-aligned plain text in one
 * Slack-style roster; `from` survives only as data-from so tests and tooling
 * can still tell who sent the row.
 */
export function TranscriptMessageBlock({
    animateEnter = true,
    attachments,
    children,
    className,
    from,
    style,
    transition,
    ...props
}: TranscriptMessageBlockProps) {
    const hasBody = children !== null && children !== undefined && children !== '';
    const hasAttachments = attachments !== null && attachments !== undefined;

    return (
        <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={cn('flex min-w-0 flex-col gap-2', className)}
            data-from={from}
            initial={animateEnter ? { opacity: 0, scale: 0.96, y: 8 } : false}
            style={{
                transformOrigin: 'bottom left',
                ...style,
            }}
            transition={transition ?? springs.moderate}
            {...props}
        >
            {hasAttachments ? (
                <ChatMessage.Media>
                    <AttachmentGroup>{attachments}</AttachmentGroup>
                </ChatMessage.Media>
            ) : null}
            {hasBody ? <ChatMessage.Content>{children}</ChatMessage.Content> : null}
        </motion.div>
    );
}
