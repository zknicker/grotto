'use client';

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type React from 'react';
import { cn } from '../../lib/utils.ts';
import { SurfaceProvider, surfaceClasses, useSurface } from './surface.tsx';

export function AlertDialog(props: AlertDialogPrimitive.Root.Props): React.ReactElement {
    return <AlertDialogPrimitive.Root {...props} />;
}

export function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props): React.ReactElement {
    return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

export function AlertDialogClose(props: AlertDialogPrimitive.Close.Props): React.ReactElement {
    return <AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />;
}

export function AlertDialogPopup({
    children,
    className,
    ...props
}: AlertDialogPrimitive.Popup.Props): React.ReactElement {
    const substrate = useSurface();
    const level = Math.min(substrate + 4, 8);
    return (
        <AlertDialogPrimitive.Portal>
            <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 dark:bg-black/80" />
            <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4">
                <AlertDialogPrimitive.Popup
                    className={cn(
                        'row-start-2 flex max-h-full w-[calc(100%-2rem)] max-w-[400px] flex-col rounded-2xl p-6 text-popover-foreground outline-none',
                        surfaceClasses(level),
                        className
                    )}
                    {...props}
                >
                    <SurfaceProvider value={level}>{children}</SurfaceProvider>
                </AlertDialogPrimitive.Popup>
            </AlertDialogPrimitive.Viewport>
        </AlertDialogPrimitive.Portal>
    );
}

export function AlertDialogHeader({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>({ className: cn('mb-4 flex flex-col gap-1.5', className) }, props),
        render,
    });
}

export function AlertDialogFooter({
    className,
    render,
    ...props
}: useRender.ComponentProps<'div'>): React.ReactElement {
    return useRender({
        defaultTagName: 'div',
        props: mergeProps<'div'>(
            {
                className: cn(
                    'mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
                    className
                ),
            },
            props
        ),
        render,
    });
}

export function AlertDialogTitle(props: AlertDialogPrimitive.Title.Props): React.ReactElement {
    return (
        <AlertDialogPrimitive.Title
            className="text-foreground text-lg leading-tight"
            style={{ fontVariationSettings: "'wght' 700" }}
            {...props}
        />
    );
}

export function AlertDialogDescription(
    props: AlertDialogPrimitive.Description.Props
): React.ReactElement {
    return (
        <AlertDialogPrimitive.Description className="text-meta text-muted-foreground" {...props} />
    );
}
