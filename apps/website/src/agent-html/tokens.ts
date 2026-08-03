/**
 * The one set of CSS variables Tavern hands to agent-authored HTML.
 *
 * Agent HTML renders in a frame with an opaque origin (see sandbox.ts), so it
 * cannot read the app's stylesheets. Instead each surface snapshots the
 * resolved values of these tokens off the live document and injects them as a
 * `:root` block — that is what makes an agent-written page wear the app theme
 * in light and dark.
 *
 * This list is a PUBLISHED CONTRACT. The seeded `visuals` skill teaches these
 * names and pages written months ago still reference them. Most of them
 * resolve through `styles/artifact-tokens.css`, which aliases them onto HeroUI
 * so values track the app without agents ever writing a HeroUI name. Adding or
 * removing one changes what already-authored pages render as — pair it with a
 * skill update.
 *
 * Deliberately one list rather than per-surface subsets: a few extra
 * declarations per frame cost nothing next to a surface silently losing a
 * token because only one copy got updated.
 */

export const agentHtmlTokenNames = [
    '--font-sans',
    '--font-heading',
    '--font-mono',
    '--app-ui-font-size',
    '--app-code-font-size',
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--muted-foreground',
    '--foreground-tertiary',
    '--foreground-quaternary',
    '--subtle',
    '--brand',
    '--brand-foreground',
    '--brand-muted',
    '--brand-muted-foreground',
    '--destructive',
    '--destructive-foreground',
    '--border',
    '--border-strong',
    '--input',
    '--ring',
    '--surface',
    '--surface-secondary',
    '--surface-tertiary',
    '--surface-shadow',
    '--overlay-shadow',
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
    '--chart-1',
    '--chart-2',
    '--chart-3',
    '--chart-4',
    '--chart-5',
    '--t-micro',
    '--t-fast',
    '--t-normal',
    '--t-slow',
    '--ease-out',
    '--ease-in',
    '--ease-in-out-quad',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-2xl',
    '--label-amber-fg',
    '--label-blue-fg',
    '--label-gray-fg',
    '--label-green-fg',
    '--label-orange-fg',
    '--label-pink-fg',
    '--label-purple-fg',
    '--label-red-fg',
    '--label-teal-fg',
] as const;

/** The app's active color scheme, so the frame matches native form controls. */
export function agentHtmlColorScheme(): 'dark' | 'light' {
    if (typeof document === 'undefined') {
        return 'dark';
    }

    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Resolved token declarations for the current theme, or '' outside a browser. */
export function agentHtmlTokenDeclarations(): string {
    if (typeof document === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return '';
    }

    const computed = window.getComputedStyle(document.documentElement);

    return [
        ...agentHtmlTokenNames
            .map((name) => ({ name, value: computed.getPropertyValue(name).trim() }))
            .filter((token) => token.value.length > 0)
            .map((token) => `${token.name}: ${token.value};`),
        // Chart chrome is derived rather than snapshotted; the skill teaches
        // these to every agent-HTML surface, so both artifacts and inline
        // visuals get them.
        '--chart-grid: color-mix(in srgb, var(--border-strong) 58%, transparent);',
        '--chart-label: color-mix(in srgb, var(--muted-foreground) 86%, transparent);',
    ].join('\n');
}

/** A ready `:root { ... }` block for the current theme. */
export function agentHtmlTokenCss(scheme: 'dark' | 'light'): string {
    const declarations = agentHtmlTokenDeclarations();

    if (declarations.length === 0) {
        return '';
    }

    return `:root{color-scheme:${scheme};${declarations.split('\n').join('')}}`;
}

/**
 * Inject the token block into an artifact document without disturbing its
 * markup: after the opening <head> when present, otherwise prepended (the
 * parser hoists a leading <style> into head).
 */
export function injectHostTokenStyle(html: string, tokenCss: string): string {
    if (tokenCss.length === 0) {
        return html;
    }

    const styleTag = `<style data-tavern-tokens>${tokenCss}</style>`;
    const headMatch = /<head[^>]*>/iu.exec(html);

    if (headMatch) {
        const insertAt = headMatch.index + headMatch[0].length;
        return `${html.slice(0, insertAt)}${styleTag}${html.slice(insertAt)}`;
    }

    return `${styleTag}${html}`;
}
