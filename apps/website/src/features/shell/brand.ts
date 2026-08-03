import type { HugeiconsIconProps } from '@hugeicons/react';

type BrandIconProps = Pick<
    HugeiconsIconProps,
    'disableSecondaryOpacity' | 'primaryColor' | 'secondaryColor' | 'strokeWidth'
>;

export function brandIconProps(isActive = true): BrandIconProps {
    return {
        disableSecondaryOpacity: true,
        primaryColor: isActive ? 'var(--accent)' : 'var(--muted)',
        secondaryColor: isActive ? 'var(--focus)' : 'var(--muted)',
    };
}
