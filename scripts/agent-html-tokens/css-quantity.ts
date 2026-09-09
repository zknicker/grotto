/**
 * The arithmetic half of CSS value work: read a length or bare number,
 * evaluate the expression inside a `calc()`, compare the arguments of a
 * `min()` / `max()`, and print the answer back as a literal.
 *
 * `rem` folds to pixels on the way out, because the frame a snapshot lands in
 * has no app root font size to resolve against.
 */

import { matchingParen } from './css-syntax.ts';

const PIXELS_PER_REM = 16;

export interface Quantity {
    amount: number;
    unit: string;
}

/** The value of a `calc()` body, or null when the arithmetic is undecidable. */
export function evaluate(expression: string): Quantity | null {
    return sum(expression.trim());
}

/** One `min()` / `max()` argument, or null when it is not a plain quantity. */
export function factor(text: string): Quantity | null {
    const trimmed = text.trim();

    if (trimmed.startsWith('(')) {
        const close = matchingParen(trimmed, 0);

        return close === trimmed.length - 1 ? sum(trimmed.slice(1, close)) : null;
    }

    const matched = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(trimmed);

    return matched ? { amount: Number.parseFloat(matched[1]), unit: matched[2] } : null;
}

/** The winning argument of `min(...)` / `max(...)`, printed. */
export function pick(name: string, args: (Quantity | null)[]): string | null {
    const first = args[0];

    if (args.length === 0 || first === null || args.some((arg) => arg?.unit !== first.unit)) {
        return null;
    }

    const amounts = args.map((arg) => (arg as Quantity).amount);

    return format({
        amount: name === 'min' ? Math.min(...amounts) : Math.max(...amounts),
        unit: first.unit,
    });
}

/** A quantity as CSS text, with `rem` converted to pixels. */
export function format(quantity: Quantity | null): string | null {
    if (quantity === null) {
        return null;
    }

    const inPixels = quantity.unit === 'rem';
    const amount = inPixels ? quantity.amount * PIXELS_PER_REM : quantity.amount;
    const rounded = Number.parseFloat(amount.toFixed(6));

    return `${rounded}${inPixels ? 'px' : quantity.unit}`;
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
