'use client';

import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { cn } from '../../lib/utils.ts';

export function Avatar({ className, ...props }: AvatarPrimitive.Root.Props) {
    return (
        <AvatarPrimitive.Root
            className={cn(
                'relative flex size-9 shrink-0 overflow-hidden rounded-full bg-legacy-muted',
                className
            )}
            data-slot="avatar"
            {...props}
        />
    );
}

export function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
    return (
        <AvatarPrimitive.Image
            className={cn('size-full object-cover', className)}
            data-slot="avatar-image"
            {...props}
        />
    );
}

export function AvatarFallback({ className, ...props }: AvatarPrimitive.Fallback.Props) {
    return (
        <AvatarPrimitive.Fallback
            className={cn(
                'flex size-full items-center justify-center font-medium text-muted-foreground text-xs',
                className
            )}
            data-slot="avatar-fallback"
            {...props}
        />
    );
}
