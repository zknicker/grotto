/**
 * Paren-aware scanning over a CSS value string. No CSS meaning lives here —
 * just the three primitives every other module in this folder needs to find
 * where a function call ends and where its arguments split.
 */

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

/** The index of the `)` closing the `(` at `open`, or null when unbalanced. */
export function matchingParen(value: string, open: number): number | null {
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
