import * as z from 'zod';

/**
 * Channel appearance. `icon` names a curated hugeicons export (for example
 * `RocketIcon`); `color` is a preset id (for example `violet`). Both are
 * channel-only and null means the default hash glyph / muted box.
 */
export const channelIconSchema = z
    .string()
    .trim()
    .regex(/^[A-Z][A-Za-z0-9]{0,63}Icon$/u);

export const channelColorSchema = z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,31}$/u);
