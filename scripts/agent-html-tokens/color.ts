/**
 * The colour math the agent-HTML token generator needs: parse what the app's
 * stylesheets actually write (hex, `oklch()`, `color-mix()`, HeroUI's
 * `--alpha()`) and print a self-contained hex string an iOS build can ship.
 */

export interface Rgba {
    a: number;
    b: number;
    g: number;
    r: number;
}

export type MixSpace = 'oklab' | 'oklch' | 'srgb';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function hexToRgba(hex: string): Rgba {
    const raw = hex.replace('#', '');
    const full =
        raw.length === 3 || raw.length === 4
            ? raw
                  .split('')
                  .map((char) => char + char)
                  .join('')
            : raw;

    return {
        r: Number.parseInt(full.slice(0, 2), 16) / 255,
        g: Number.parseInt(full.slice(2, 4), 16) / 255,
        b: Number.parseInt(full.slice(4, 6), 16) / 255,
        a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
}

export function toHex(color: Rgba): string {
    const pair = (value: number) =>
        Math.round(clamp01(value) * 255)
            .toString(16)
            .padStart(2, '0');
    const alpha = color.a < 0.999 ? pair(color.a) : '';

    return `#${pair(color.r)}${pair(color.g)}${pair(color.b)}${alpha}`;
}

export function oklabToRgba(lightness: number, a: number, b: number, alpha: number): Rgba {
    const linear = oklabToLinear(lightness, a, b);

    return {
        r: clamp01(linearToSrgb(linear.r)),
        g: clamp01(linearToSrgb(linear.g)),
        b: clamp01(linearToSrgb(linear.b)),
        a: alpha,
    };
}

/** Mix two colours the way CSS `color-mix()` does (alpha-premultiplied). */
export function mix(space: MixSpace, first: Rgba, firstShare: number, second: Rgba): Rgba {
    const secondShare = 1 - firstShare;
    const alpha = first.a * firstShare + second.a * secondShare;

    if (alpha === 0) {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    const weightA = (first.a * firstShare) / alpha;
    const weightB = (second.a * secondShare) / alpha;

    if (space === 'srgb') {
        return {
            r: first.r * weightA + second.r * weightB,
            g: first.g * weightA + second.g * weightB,
            b: first.b * weightA + second.b * weightB,
            a: alpha,
        };
    }

    return mixInOklab(space, rgbaToOklab(first), weightA, rgbaToOklab(second), weightB, alpha);
}

interface Oklab {
    a: number;
    b: number;
    lightness: number;
}

function mixInOklab(
    space: MixSpace,
    first: Oklab,
    weightA: number,
    second: Oklab,
    weightB: number,
    alpha: number
): Rgba {
    const lightness = first.lightness * weightA + second.lightness * weightB;

    if (space === 'oklab') {
        return oklabToRgba(
            lightness,
            first.a * weightA + second.a * weightB,
            first.b * weightA + second.b * weightB,
            alpha
        );
    }

    const chroma =
        Math.hypot(first.a, first.b) * weightA + Math.hypot(second.a, second.b) * weightB;
    const hueA = hueOf(first);
    let delta = hueOf(second) - hueA;

    if (delta > 180) {
        delta -= 360;
    }

    if (delta < -180) {
        delta += 360;
    }

    const hue = ((hueA + delta * weightB) * Math.PI) / 180;

    return oklabToRgba(lightness, chroma * Math.cos(hue), chroma * Math.sin(hue), alpha);
}

function hueOf(color: Oklab): number {
    const degrees = (Math.atan2(color.b, color.a) * 180) / Math.PI;

    return degrees < 0 ? degrees + 360 : degrees;
}

function rgbaToOklab(color: Rgba): Oklab {
    const r = srgbToLinear(color.r);
    const g = srgbToLinear(color.g);
    const b = srgbToLinear(color.b);
    const l = Math.cbrt(0.412_221_470_8 * r + 0.536_332_536_3 * g + 0.051_445_992_9 * b);
    const m = Math.cbrt(0.211_903_498_2 * r + 0.680_699_545_1 * g + 0.107_396_956_6 * b);
    const s = Math.cbrt(0.088_302_461_9 * r + 0.281_718_837_6 * g + 0.629_978_700_5 * b);

    return {
        lightness: 0.210_454_255_3 * l + 0.793_617_785 * m - 0.004_072_046_8 * s,
        a: 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s,
        b: 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s,
    };
}

function oklabToLinear(lightness: number, a: number, b: number) {
    const l = (lightness + 0.396_337_777_4 * a + 0.215_803_757_3 * b) ** 3;
    const m = (lightness - 0.105_561_345_8 * a - 0.063_854_172_8 * b) ** 3;
    const s = (lightness - 0.089_484_177_5 * a - 1.291_485_548 * b) ** 3;

    return {
        r: 4.076_741_662_1 * l - 3.307_711_591_3 * m + 0.230_969_929_2 * s,
        g: -1.268_438_004_6 * l + 2.609_757_401_1 * m - 0.341_319_396_5 * s,
        b: -0.004_196_086_3 * l - 0.703_418_614_7 * m + 1.707_614_701 * s,
    };
}

function srgbToLinear(channel: number): number {
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
    return channel <= 0.003_130_8 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
}
