import type * as React from 'react';
import { cn } from '../lib/utils.ts';
import './haus-logo.css';

const appIconUrl = '/haus-app-icon.png';

/** The full-color Haus mark: the blob on its blue-gradient badge. */
export function HausLogo({
    animated = false,
    className,
    ...props
}: { animated?: boolean } & React.ComponentPropsWithoutRef<'svg'>) {
    return (
        <svg
            className={cn('haus-logo', animated && 'haus-logo--animated', className)}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Haus</title>
            <image className="haus-logo__figure" height="256" href={appIconUrl} width="256" />
        </svg>
    );
}

/** Compact form of the released app icon for small chrome like menus. */
export function HausGlyph({ className, ...props }: React.ComponentPropsWithoutRef<'svg'>) {
    return (
        <svg
            className={className}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Haus</title>
            <image height="256" href={appIconUrl} width="256" />
        </svg>
    );
}
