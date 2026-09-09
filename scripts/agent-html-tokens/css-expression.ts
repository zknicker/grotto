/**
 * Value-level CSS work: substitute `var()` against a cascade, then fold the
 * `calc()` and `min()` / `max()` calls left behind, so the shipped value needs
 * no runtime resolution. Paren scanning lives in `css-syntax.ts` and the
 * arithmetic in `css-quantity.ts`.
 */

import type { Cascade } from './css-cascade.ts';
import { evaluate, factor, format, pick } from './css-quantity.ts';
import { matchingParen, splitTop } from './css-syntax.ts';

const VAR_GUARD = 40;

/** Substitute every `var()` reference until the value is literal. */
export function expandVariables(value: string, cascade: Cascade, seen: Set<string>): string {
    let out = value;

    for (let guard = 0; guard < VAR_GUARD && out.includes('var('); guard += 1) {
        const start = out.indexOf('var(');
        const close = matchingParen(out, start + 3);

        if (close === null) {
            return out;
        }

        const [name, ...fallback] = splitTop(out.slice(start + 4, close), ',');

        if (seen.has(name)) {
            return out;
        }

        const declaration = cascade.get(name);
        const replacement = declaration
            ? expandVariables(declaration.value, cascade, new Set([...seen, name]))
            : fallback.join(', ').trim() || `UNRESOLVED(${name})`;

        out = out.slice(0, start) + replacement + out.slice(close + 1);
    }

    return out;
}

/** Fold every `calc()` whose arithmetic is decidable into a literal. */
export function collapseCalc(value: string): string {
    let out = value;

    for (let guard = 0; guard < VAR_GUARD; guard += 1) {
        const start = innermostCalc(out);

        if (start === null) {
            return out;
        }

        const close = matchingParen(out, start + 4);

        if (close === null) {
            return out;
        }

        const folded = format(evaluate(out.slice(start + 5, close)));

        if (folded === null) {
            return out;
        }

        out = out.slice(0, start) + folded + out.slice(close + 1);
    }

    return out;
}

/**
 * Fold every `min()` / `max()` whose arguments are plain same-unit quantities.
 * The shell radius tier carries a cap (`min(32px, calc(var(--radius) * 3))`),
 * and a snapshot injected into a frame should ship the answer rather than the
 * comparison. Run it after `collapseCalc`, which turns the arguments plain.
 */
export function collapseRange(value: string): string {
    let out = value;

    for (let guard = 0; guard < VAR_GUARD; guard += 1) {
        const call = innermostRange(out);

        if (call === null) {
            return out;
        }

        const close = matchingParen(out, call.start + call.name.length);

        if (close === null) {
            return out;
        }

        const args = splitTop(out.slice(call.start + call.name.length + 1, close), ',').map(factor);
        const folded = pick(call.name, args);

        if (folded === null) {
            return out;
        }

        out = out.slice(0, call.start) + folded + out.slice(close + 1);
    }

    return out;
}

/** Collapse newlines and runs of whitespace so a value fits one line. */
export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function innermostCalc(value: string): number | null {
    const last = value.lastIndexOf('calc(');

    return last < 0 ? null : last;
}

/** The last `min(`/`max(` that is a function call, not the tail of a name. */
function innermostRange(value: string): { name: string; start: number } | null {
    let found: { name: string; start: number } | null = null;

    for (const match of value.matchAll(/(?<![\w-])(min|max)\(/g)) {
        found = { name: match[1], start: match.index };
    }

    return found;
}
