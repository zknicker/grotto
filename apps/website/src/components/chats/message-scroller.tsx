import { Button } from '@heroui/react';
import {
    MessageScroller as MessageScrollerPrimitive,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
} from '@shadcn/react/message-scroller';
import { ArrowDownIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../lib/utils.ts';

function MessageScrollerProvider(
    props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>
) {
    return <MessageScrollerPrimitive.Provider {...props} />;
}

function MessageScroller({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
    return (
        <MessageScrollerPrimitive.Root
            className={cn(
                'group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden',
                className
            )}
            data-slot="message-scroller"
            {...props}
        />
    );
}

function MessageScrollerViewport({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>) {
    return (
        <MessageScrollerPrimitive.Viewport
            className={cn(
                'scroll-fade-b scrollbar-thin scrollbar-gutter-stable data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content',
                className
            )}
            data-slot="message-scroller-viewport"
            {...props}
        />
    );
}

function MessageScrollerContent({
    className,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
    return (
        <MessageScrollerPrimitive.Content
            className={cn('flex h-max min-h-full flex-col gap-6', className)}
            data-slot="message-scroller-content"
            {...props}
        />
    );
}

function MessageScrollerItem({
    className,
    scrollAnchor = false,
    ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
    return (
        <MessageScrollerPrimitive.Item
            className={cn(
                'min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]',
                className
            )}
            data-slot="message-scroller-item"
            scrollAnchor={scrollAnchor}
            {...props}
        />
    );
}

// Placement and the show/hide motion live on this wrapper so the HeroUI
// Button inside stays stock. `data-active` reads the same scrollable state
// the scroller primitives publish, so the control appears exactly when there
// is somewhere to jump to.
const scrollerButtonWrapperClassName =
    'absolute inset-s-1/2 -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[direction=start]:top-4 data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:data-[active=false]:-translate-y-full data-[active=false]:pointer-events-none data-[active=true]:translate-y-0 data-[active=false]:scale-95 data-[active=true]:scale-100 data-[active=false]:opacity-0 data-[active=true]:opacity-100 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180';

function MessageScrollerButton({
    behavior = 'smooth',
    children,
    className,
    direction = 'end',
    ...props
}: Omit<React.ComponentProps<typeof Button>, 'children'> & {
    behavior?: ScrollBehavior;
    children?: React.ReactNode;
    direction?: 'start' | 'end';
}) {
    const scroller = useMessageScroller();
    const scrollable = useMessageScrollerScrollable();
    const isActive = direction === 'start' ? scrollable.start : scrollable.end;

    return (
        <div
            className={cn(scrollerButtonWrapperClassName, className)}
            data-active={isActive ? 'true' : 'false'}
            data-direction={direction}
            data-slot="message-scroller-button"
            inert={isActive ? undefined : true}
        >
            <Button
                aria-label={direction === 'end' ? 'Scroll to end' : 'Scroll to start'}
                isIconOnly
                onPress={() =>
                    direction === 'start'
                        ? scroller.scrollToStart({ behavior })
                        : scroller.scrollToEnd({ behavior })
                }
                size="sm"
                variant="secondary"
                {...props}
            >
                {children ?? <ArrowDownIcon />}
            </Button>
        </div>
    );
}

export {
    MessageScrollerProvider,
    MessageScroller,
    MessageScrollerViewport,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerButton,
    useMessageScroller,
    useMessageScrollerScrollable,
    useMessageScrollerVisibility,
};
