/**
 * Theme token snapshot for generative visuals. The sandboxed iframe has an
 * opaque origin and cannot read app styles, so the host snapshots the
 * computed values of a curated token list and injects them as a `:root`
 * block. Visuals reference only these variables for surface, text, border,
 * and series colors — that is what makes them wear the app theme in both
 * schemes (see docs/internals/widgets.md).
 */

const surfaceTokenNames = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--surface-1',
    '--surface-2',
    '--surface-3',
    '--surface-4',
    '--border',
    '--border-strong',
    '--legacy-muted',
    '--muted-foreground',
    '--secondary',
    '--secondary-foreground',
    '--legacy-accent',
    '--legacy-accent-foreground',
    '--primary',
    '--primary-foreground',
    '--brand',
    '--brand-foreground',
    '--brand-muted',
    '--brand-muted-foreground',
] as const;

const statusTokenNames = [
    '--success',
    '--success-foreground',
    '--success-bg',
    '--warning',
    '--warning-foreground',
    '--warning-bg',
    '--error',
    '--error-foreground',
    '--error-bg',
    '--info',
    '--info-foreground',
    '--info-bg',
] as const;

const typographyTokenNames = ['--font-sans', '--font-mono', '--app-ui-font-size'] as const;

const radiusTokenNames = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'] as const;

const textTierTokenNames = ['--foreground-tertiary', '--foreground-quaternary'] as const;

// Categorical chart series shared with kit charts (tokens.css).
const chartTokenNames = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const;

const motionTokenNames = [
    '--t-micro',
    '--t-fast',
    '--t-normal',
    '--t-slow',
    '--ease-out',
    '--ease-in',
    '--ease-standard',
] as const;

export const visualTokenNames: readonly string[] = [
    ...surfaceTokenNames,
    ...statusTokenNames,
    ...typographyTokenNames,
    ...radiusTokenNames,
    ...textTierTokenNames,
    ...chartTokenNames,
    ...motionTokenNames,
];

/**
 * Snapshot the current computed token values as a CSS block for the iframe
 * head. Returns declarations only; the caller wraps them in `:root { }`.
 */
export function visualTokenDeclarations(): string {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return '';
    }

    const computed = window.getComputedStyle(document.documentElement);
    const declarations: string[] = [];

    for (const name of visualTokenNames) {
        const value = computed.getPropertyValue(name).trim();
        if (value) {
            declarations.push(`${name}: ${value};`);
        }
    }

    // Chart chrome derived from the injected base tokens.
    declarations.push('--chart-grid: color-mix(in srgb, var(--border-strong) 58%, transparent);');
    declarations.push(
        '--chart-label: color-mix(in srgb, var(--muted-foreground) 86%, transparent);'
    );

    return declarations.join('\n');
}

/** The app's active color scheme, so the iframe matches native form controls. */
export function visualColorScheme(): 'dark' | 'light' {
    if (typeof document === 'undefined') {
        return 'dark';
    }
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
