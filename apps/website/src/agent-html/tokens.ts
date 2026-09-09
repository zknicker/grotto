/**
 * The CSS variables Grotto hands to agent-authored HTML.
 *
 * Agent HTML renders in a frame with an opaque origin (see sandbox.ts), so it
 * cannot read the app's stylesheets. Instead each surface snapshots the
 * resolved values of these tokens off the live document and injects them as a
 * `:root` block — that is what makes an agent-written page wear the app theme
 * in light and dark. Values resolve through `styles/artifact-tokens.css`,
 * mostly as aliases onto HeroUI so they track the app without an agent ever
 * writing a HeroUI name.
 *
 * There are two lists and they do different jobs.
 *
 * `agentHtmlTokenNames` is the PUBLISHED CONTRACT: the role vocabulary the
 * seeded `visuals` skill teaches and the only thing new agent HTML should
 * reference. It is 38 names here plus the two derived chart-chrome names
 * appended by `agentHtmlTokenDeclarations` below — 40 taught names in eight
 * groups: type, surfaces, text, borders, emphasis, status, charts, layout.
 * Adding or removing one changes what already-authored pages render as; pair
 * it with a skill update.
 *
 * `agentHtmlLegacyTokenNames` is emitted into every frame and taught to
 * nobody. Visuals written before the vocabulary shrank sit in chat history
 * referencing these names, and a stored page that loses a token renders
 * broken forever. The list only shrinks when stored content is migrated.
 *
 * Deliberately one snapshot rather than per-surface subsets: a few extra
 * declarations per frame cost nothing next to a surface silently losing a
 * token because only one copy got updated.
 */

/** The taught vocabulary: 38 snapshotted names, plus 2 derived below. */
export const agentHtmlTokenNames = [
    // Type
    '--font-sans',
    '--font-mono',
    '--app-ui-font-size',
    // Surfaces
    '--background',
    '--surface',
    '--surface-secondary',
    '--surface-tertiary',
    // Text
    '--foreground',
    '--muted-foreground',
    '--foreground-tertiary',
    // Borders
    '--border',
    '--border-strong',
    // Emphasis
    '--accent',
    '--accent-foreground',
    '--accent-bg',
    // Status
    '--success',
    '--success-foreground',
    '--success-bg',
    '--warning',
    '--warning-foreground',
    '--warning-bg',
    '--error',
    '--error-foreground',
    '--error-bg',
    // Charts (--chart-grid and --chart-label are derived, not snapshotted)
    '--chart-1',
    '--chart-2',
    '--chart-3',
    '--chart-4',
    '--chart-5',
    // Layout
    '--radius',
    '--radius-card',
    '--pad-sm',
    '--pad-md',
    '--pad-lg',
    '--gap-xs',
    '--gap-sm',
    '--gap-md',
    '--gap-lg',
] as const;

/**
 * Emitted for durability, taught to nobody.
 *
 * Every name here is mapped onto a taught role in `artifact-tokens.css` or by
 * `hostRoleOverrides` below, so a page written against the old vocabulary
 * renders in the current system rather than freezing an old one. This list
 * only shrinks, and only once stored content no longer references the name.
 */
export const agentHtmlLegacyTokenNames = [
    '--font-heading',
    '--app-code-font-size',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--primary',
    '--primary-foreground',
    '--secondary',
    '--secondary-foreground',
    '--subtle',
    '--foreground-quaternary',
    '--brand',
    '--brand-foreground',
    '--brand-muted',
    '--brand-muted-foreground',
    '--destructive',
    '--destructive-foreground',
    '--info',
    '--info-foreground',
    '--info-bg',
    '--input',
    '--ring',
    '--surface-shadow',
    '--overlay-shadow',
    '--t-micro',
    '--t-fast',
    '--t-normal',
    '--t-slow',
    '--ease-out',
    '--ease-in',
    '--ease-standard',
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

/** Every name the snapshot emits, taught first. */
export const agentHtmlSnapshotNames = [
    ...agentHtmlTokenNames,
    ...agentHtmlLegacyTokenNames,
] as const;

/**
 * The host variable a published name reads from, where the two differ.
 *
 * `styles/artifact-tokens.css` is the home for this mapping and owns every
 * other name. These it cannot, for two reasons:
 *
 * HeroUI declares `--accent-foreground`, `--success-foreground` and
 * `--warning-foreground` in `@layer base` — above the theme layer that file
 * imports into — and spends them as the text on solid accent, success and
 * warning Chips and Badges, where near-black or near-white on a saturated fill
 * is correct. The contract gives the same names the opposite job: text sitting
 * on the matching `-bg` tint, where those values are invisible. Rebinding them
 * for the frame keeps the contract readable without repainting the app.
 *
 * `--radius` and the legacy `--radius-*` ramp are Tailwind's and HeroUI's own
 * scale. Declaring them in `artifact-tokens.css` would either lose to
 * `default-theme.css` or reshape every `rounded-*` utility in the product, so
 * the frame reads the artifact-owned `--radius-control` and `--radius-card`
 * under the published names instead.
 */
const hostRoleOverrides: Record<string, string> = {
    '--accent-foreground': '--accent-soft-foreground',
    '--radius': '--radius-control',
    '--radius-2xl': '--radius-card',
    '--radius-lg': '--radius-control',
    '--radius-md': '--radius-control',
    '--radius-sm': '--radius-control',
    '--radius-xl': '--radius-control',
    '--success-foreground': '--success-soft-foreground',
    '--warning-foreground': '--warning-soft-foreground',
};

function hostRoleFor(name: string): string {
    return hostRoleOverrides[name] ?? name;
}

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
    const read = (name: string) => computed.getPropertyValue(name).trim();

    return [
        ...agentHtmlSnapshotNames
            .map((name) => ({ name, value: read(hostRoleFor(name)) }))
            .filter((token) => token.value.length > 0)
            .map((token) => `${token.name}: ${token.value};`),
        // Chart chrome is derived rather than snapshotted; it is part of the
        // taught vocabulary and reaches every agent-HTML surface.
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

    const styleTag = `<style data-grotto-tokens>${tokenCss}</style>`;
    const headMatch = /<head[^>]*>/iu.exec(html);

    if (headMatch) {
        const insertAt = headMatch.index + headMatch[0].length;
        return `${html.slice(0, insertAt)}${styleTag}${html.slice(insertAt)}`;
    }

    return `${styleTag}${html}`;
}
