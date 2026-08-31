import type * as React from 'react';
import { cn } from '../lib/utils.ts';
import './grotto-logo.css';

const appIconUrl = '/grotto-app-icon.png';

/** The full-color Grotto mark: the blob on its blue-gradient badge. */
export function GrottoLogo({
    animated = false,
    className,
    ...props
}: { animated?: boolean } & React.ComponentPropsWithoutRef<'svg'>) {
    return (
        <svg
            className={cn('grotto-logo', animated && 'grotto-logo--animated', className)}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Grotto</title>
            <image className="grotto-logo__figure" height="256" href={appIconUrl} width="256" />
        </svg>
    );
}

/** Compact form of the released app icon for small chrome like menus. */
export function GrottoGlyph({ className, ...props }: React.ComponentPropsWithoutRef<'svg'>) {
    return (
        <svg
            className={className}
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            <title>Grotto</title>
            <image height="256" href={appIconUrl} width="256" />
        </svg>
    );
}
