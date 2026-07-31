'use client';

import { type HTMLMotionProps, motion } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';
import { springs } from '../../lib/springs.ts';
import { cn } from '../../lib/utils.ts';
import { AttachmentGroup } from './attachment.tsx';
import { Bubble, BubbleContent } from './bubble.tsx';
import { Message, MessageContent } from './message.tsx';

export interface ChatMessageProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
    animateEnter?: boolean;
    attachments?: ReactNode;
    children?: ReactNode;
    from: 'user' | 'assistant';
}

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
    (
        {
            animateEnter = true,
            attachments,
            children,
            className,
            from,
            style,
            transition,
            ...props
        },
        ref
    ) => {
        const hasBody = children !== null && children !== undefined && children !== '';
        const hasAttachments = attachments !== null && attachments !== undefined;

        // Every message — the owner's included — reads as left-aligned plain
        // text in one Slack-style roster. `from` survives only as data-from
        // so tests and tooling can still tell who sent the row.
        return (
            <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={cn('min-w-0', className)}
                data-from={from}
                initial={animateEnter ? { opacity: 0, scale: 0.96, y: 8 } : false}
                ref={ref}
                style={{
                    transformOrigin: 'bottom left',
                    ...style,
                }}
                transition={transition ?? springs.moderate}
                {...props}
            >
                <Message align="start">
                    <MessageContent>
                        {hasAttachments ? <AttachmentGroup>{attachments}</AttachmentGroup> : null}
                        {hasBody ? (
                            <Bubble align="start">
                                <BubbleContent>{children}</BubbleContent>
                            </Bubble>
                        ) : null}
                    </MessageContent>
                </Message>
            </motion.div>
        );
    }
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
