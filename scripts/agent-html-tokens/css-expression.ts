/**
 * Text-level CSS value work: split argument lists, substitute `var()` against a
 * cascade, and fold `calc()` down to a literal so the shipped value needs no
 * runtime resolution.
 */

import type { Cascade } from './css-cascade.ts';

const PIXELS_PER_REM = 16;

const VAR_GUARD = 40;

/** Split on `separator` at paren depth zero. */
export function splitTop(input: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let buffer = '';

    for (const char of input) {
        if (char === '(') {
            depth += 1;
        }

        if (char === ')') {
            depth -= 1;
        }

        if (char === separator && depth === 0) {
            parts.push(buffer.trim());
            buffer = '';
            continue;
        }

        buffer += char;
    }

    parts.push(buffer.trim());

    return parts;
}

/** The arguments of `name(...)` when the value is exactly that call. */
export function functionArguments(value: string, name: string): string | null {
    const prefix = `${name}(`;

    if (!value.startsWith(prefix)) {
        return null;
    }

    const close = matchingParen(value, prefix.length - 1);

    if (close === null || value.slice(close + 1).trim().length > 0) {
        return null;
    }

    return value.slice(prefix.length, close).trim();
}

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

/** Collapse newlines and runs of whitespace so a value fits one line. */
export function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

interface Quantity {
    amount: number;
    unit: string;
}

function innermostCalc(value: string): number | null {
    const last = value.lastIndexOf('calc(');

    return last < 0 ? null : last;
}

function matchingParen(value: string, open: number): number | null {
    let depth = 0;

    for (let index = open; index < value.length; index += 1) {
        if (value[index] === '(') {
            depth += 1;
        }

        if (value[index] === ')') {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return null;
}

function evaluate(expression: string): Quantity | null {
    return sum(expression.trim());
}

function sum(expression: string): Quantity | null {
    const terms = expression.split(/\s+(?=[+-]\s)/);
    let total = product(terms[0]);

    for (const term of terms.slice(1)) {
        const next = product(term.slice(1).trim());

        if (total === null || next === null || total.unit !== next.unit) {
            return null;
        }

        total = {
            amount: term.startsWith('-') ? total.amount - next.amount : total.amount + next.amount,
            unit: total.unit,
        };
    }

    return total;
}

function product(expression: string): Quantity | null {
    const parts = splitFactors(expression);
    let total = factor(parts[0]);

    for (let index = 1; index < parts.length; index += 2) {
        total = total === null ? null : apply(total, parts[index], factor(parts[index + 1] ?? ''));
    }

    return total;
}

/** `a * b / c` -> `['a', '*', 'b', '/', 'c']`, at paren depth zero. */
function splitFactors(expression: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let buffer = '';

    for (const char of expression) {
        if (char === '(') {
            depth += 1;
        }

        if (char === ')') {
            depth -= 1;
        }

        if (depth === 0 && (char === '*' || char === '/')) {
            parts.push(buffer.trim(), char);
            buffer = '';
            continue;
        }

        buffer += char;
    }

    parts.push(buffer.trim());

    return parts;
}

function apply(left: Quantity, operator: string, right: Quantity | null): Quantity | null {
    if (right === null) {
        return null;
    }

    if (operator === '/') {
        return right.unit === '' && right.amount !== 0
            ? { amount: left.amount / right.amount, unit: left.unit }
            : null;
    }

    return left.unit === '' || right.unit === ''
        ? { amount: left.amount * right.amount, unit: left.unit || right.unit }
        : null;
}

function factor(text: string): Quantity | null {
    const trimmed = text.trim();

    if (trimmed.startsWith('(')) {
        const close = matchingParen(trimmed, 0);

        return close === trimmed.length - 1 ? sum(trimmed.slice(1, close)) : null;
    }

    const matched = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(trimmed);

    return matched ? { amount: Number.parseFloat(matched[1]), unit: matched[2] } : null;
}

function format(quantity: Quantity | null): string | null {
    if (quantity === null) {
        return null;
    }

    const inPixels = quantity.unit === 'rem';
    const amount = inPixels ? quantity.amount * PIXELS_PER_REM : quantity.amount;
    const rounded = Number.parseFloat(amount.toFixed(6));

    return `${rounded}${inPixels ? 'px' : quantity.unit}`;
}
