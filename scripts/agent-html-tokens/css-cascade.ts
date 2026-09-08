/**
 * A tiny cascade walker over the stylesheets the web app loads, good enough to
 * answer "what value does this custom property have on `:root` in this colour
 * scheme?" without a browser.
 *
 * It reads custom-property declarations only, tracks the selector stack so
 * `@layer` / `@supports` wrappers cannot masquerade as selectors, and keeps the
 * winner per name: an explicit theme selector beats a bare `:root`, and later
 * source order beats earlier.
 */

import { readFileSync } from 'node:fs';

export type Scheme = 'dark' | 'light';

export interface Declaration {
    order: number;
    rank: number;
    value: string;
}

export type Cascade = Map<string, Declaration>;

const DARK_SELECTORS = ['.dark', '[data-theme="dark"]', "[data-theme='dark']"];

const LIGHT_SELECTORS = [
    '.light',
    '.default',
    '[data-theme="light"]',
    "[data-theme='light']",
    '[data-theme="default"]',
    "[data-theme='default']",
];

/** Read every source in order and return the winning declaration per name. */
export function collectCascade(sources: string[], scheme: Scheme): Cascade {
    const cascade: Cascade = new Map();
    let order = 0;

    for (const source of sources) {
        const css = stripComments(readFileSync(source, 'utf8'));

        for (const entry of readDeclarations(css)) {
            const rank = matchRank(entry.selector, entry.containers, scheme);

            if (rank === null) {
                continue;
            }

            order += 1;
            const previous = cascade.get(entry.name);
            const wins =
                previous === undefined ||
                rank > previous.rank ||
                (rank === previous.rank && order > previous.order);

            if (wins) {
                cascade.set(entry.name, { order, rank, value: entry.value });
            }
        }
    }

    return cascade;
}

interface Entry {
    containers: string[];
    name: string;
    selector: string;
    value: string;
}

function* readDeclarations(css: string): Generator<Entry> {
    const stack: string[] = [];
    let buffer = '';

    for (const char of css) {
        if (char === '{') {
            stack.push(buffer.trim());
            buffer = '';
            continue;
        }

        if (char === '}') {
            stack.pop();
            buffer = '';
            continue;
        }

        if (char !== ';') {
            buffer += char;
            continue;
        }

        const declaration = buffer.trim();
        buffer = '';
        const separator = declaration.indexOf(':');

        if (separator < 0 || !declaration.startsWith('--')) {
            continue;
        }

        yield {
            containers: stack.slice(0, -1),
            name: declaration.slice(0, separator).trim(),
            selector: stack.at(-1) ?? '',
            value: declaration.slice(separator + 1).trim(),
        };
    }
}

/** `null` when the block does not apply; 1 for an explicit theme selector. */
function matchRank(selector: string, containers: string[], scheme: Scheme): number | null {
    const conditional = containers.some(
        (container) => container.startsWith('@supports') || container.startsWith('@media')
    );

    if (conditional) {
        return null;
    }

    if (selector.startsWith('@theme')) {
        return 0;
    }

    if (selector.startsWith('@')) {
        return null;
    }

    const wanted = scheme === 'dark' ? DARK_SELECTORS : LIGHT_SELECTORS;
    const other = scheme === 'dark' ? LIGHT_SELECTORS : DARK_SELECTORS;
    let best: number | null = null;

    for (const part of selector.split(',').map((piece) => piece.trim())) {
        if (wanted.some((candidate) => part.includes(candidate))) {
            return 1;
        }

        if (other.some((candidate) => part.includes(candidate))) {
            continue;
        }

        if (part === ':root' && best === null) {
            best = 0;
        }
    }

    return best;
}

function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}
