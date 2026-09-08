/**
 * Parse the colour syntaxes the app's stylesheets actually use into sRGB.
 * Anything that is not a single colour value — a shadow list, a duration, a
 * font stack — returns `null` and is shipped as its own literal text.
 */

import { hexToRgba, type MixSpace, mix, oklabToRgba, type Rgba } from './color.ts';
import { functionArguments, splitTop } from './css-expression.ts';

const TRAILING_PERCENT = /\s(\d*\.?\d+)%$/;

export function parseColor(value: string): Rgba | null {
    const trimmed = value.trim();

    if (trimmed === 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) {
        return hexToRgba(trimmed);
    }

    return (
        parseRgb(trimmed) ?? parseOklch(trimmed) ?? parseColorMix(trimmed) ?? parseAlpha(trimmed)
    );
}

function parseRgb(value: string): Rgba | null {
    const args = functionArguments(value, 'rgba') ?? functionArguments(value, 'rgb');

    if (args === null) {
        return null;
    }

    const parts = args.includes(',') ? splitTop(args, ',') : args.split(/[\s/]+/).filter(Boolean);

    return {
        r: Number.parseFloat(parts[0]) / 255,
        g: Number.parseFloat(parts[1]) / 255,
        b: Number.parseFloat(parts[2]) / 255,
        a: parts[3] === undefined ? 1 : ratio(parts[3]),
    };
}

function parseOklch(value: string): Rgba | null {
    const args = functionArguments(value, 'oklch');

    if (args === null) {
        return null;
    }

    const [main, alpha] = args.split('/').map((part) => part.trim());
    const [lightness, chroma, hue] = main.split(/\s+/);
    const l = ratio(lightness);
    const c = Number.parseFloat(chroma);
    const h = (Number.parseFloat(hue) * Math.PI) / 180;

    return oklabToRgba(l, c * Math.cos(h), c * Math.sin(h), alpha ? ratio(alpha) : 1);
}

function parseColorMix(value: string): Rgba | null {
    const args = functionArguments(value, 'color-mix');

    if (args === null) {
        return null;
    }

    const [spaceArg, firstArg, secondArg] = splitTop(args, ',');
    const space = spaceArg.replace(/^in\s+/, '').trim() as MixSpace;
    const first = parseColor(firstArg.replace(TRAILING_PERCENT, ''));
    const second = parseColor(secondArg.replace(TRAILING_PERCENT, ''));

    if (!(first && second)) {
        return null;
    }

    return mix(space, first, firstShare(firstArg, secondArg), second);
}

/** HeroUI's `--alpha(<color> / <percent>)` helper. */
function parseAlpha(value: string): Rgba | null {
    const args = functionArguments(value, '--alpha');

    if (args === null) {
        return null;
    }

    const [base, percent] = args.split('/').map((part) => part.trim());
    const color = parseColor(base);

    return color ? { ...color, a: ratio(percent) } : null;
}

/**
 * CSS normalizes `color-mix()` percentages when both are given and they do not
 * sum to 100% — HeroUI's soft-foreground mixes rely on exactly that.
 */
function firstShare(firstArg: string, secondArg: string): number {
    const first = TRAILING_PERCENT.exec(firstArg);
    const second = TRAILING_PERCENT.exec(secondArg);
    const a = first ? Number.parseFloat(first[1]) / 100 : null;
    const b = second ? Number.parseFloat(second[1]) / 100 : null;

    if (a !== null && b !== null) {
        return a / (a + b);
    }

    if (a !== null) {
        return a;
    }

    return b === null ? 0.5 : 1 - b;
}

function ratio(token: string): number {
    return token.endsWith('%') ? Number.parseFloat(token) / 100 : Number.parseFloat(token);
}
