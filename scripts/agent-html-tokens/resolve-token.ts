/**
 * Turn a cascade entry into the self-contained literal the iOS build ships:
 * every `var()` substituted, every `calc()` folded, every colour printed as
 * hex. Anything left unresolved is a build-time bug, so it throws.
 */

import { toHex } from './color.ts';
import type { Cascade } from './css-cascade.ts';
import { parseColor } from './css-color.ts';
import { collapseCalc, expandVariables, normalizeWhitespace } from './css-expression.ts';

/** The literal value of `name`, resolved against `cascade`. */
export function resolveVariable(cascade: Cascade, name: string): string {
    const declaration = cascade.get(name);

    if (declaration === undefined) {
        throw new Error(`${name} is not declared by any loaded stylesheet`);
    }

    return literal(name, expandVariables(declaration.value, cascade, new Set([name])));
}

/** The literal value of a raw expression, e.g. a derived `color-mix()`. */
export function resolveExpression(cascade: Cascade, label: string, expression: string): string {
    return literal(label, expandVariables(expression, cascade, new Set()));
}

function literal(label: string, expanded: string): string {
    const folded = collapseCalc(normalizeWhitespace(expanded));

    if (folded.includes('UNRESOLVED(')) {
        throw new Error(`${label} still references an undeclared variable: ${folded}`);
    }

    if (folded.length === 0) {
        throw new Error(`${label} resolved to an empty value`);
    }

    const color = parseColor(folded);

    return color === null ? folded : toHex(color);
}
