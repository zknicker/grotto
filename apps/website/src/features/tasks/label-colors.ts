import type { TaskLabel } from '@tavern/api';

export type TaskLabelColor = TaskLabel['color'];

// The nine palette colors, in swatch order. Matches the runtime label color
// enum so any catalog color resolves to a chip style below.
export const taskLabelColors: TaskLabelColor[] = [
    'red',
    'orange',
    'amber',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray',
];

export const taskLabelColorNames: Record<TaskLabelColor, string> = {
    amber: 'Amber',
    blue: 'Blue',
    gray: 'Gray',
    green: 'Green',
    orange: 'Orange',
    pink: 'Pink',
    purple: 'Purple',
    red: 'Red',
    teal: 'Teal',
};

// Chip fill + text, keyed by color. Static class strings so Tailwind keeps the
// arbitrary product-token references.
export const taskLabelChipClass: Record<TaskLabelColor, string> = {
    amber: 'bg-[var(--label-amber-bg)] text-[var(--label-amber-fg)]',
    blue: 'bg-[var(--label-blue-bg)] text-[var(--label-blue-fg)]',
    gray: 'bg-[var(--label-gray-bg)] text-[var(--label-gray-fg)]',
    green: 'bg-[var(--label-green-bg)] text-[var(--label-green-fg)]',
    orange: 'bg-[var(--label-orange-bg)] text-[var(--label-orange-fg)]',
    pink: 'bg-[var(--label-pink-bg)] text-[var(--label-pink-fg)]',
    purple: 'bg-[var(--label-purple-bg)] text-[var(--label-purple-fg)]',
    red: 'bg-[var(--label-red-bg)] text-[var(--label-red-fg)]',
    teal: 'bg-[var(--label-teal-bg)] text-[var(--label-teal-fg)]',
};

// Solid dot/swatch, keyed by color. Reuses each color's foreground token.
export const taskLabelDotClass: Record<TaskLabelColor, string> = {
    amber: 'bg-[var(--label-amber-fg)]',
    blue: 'bg-[var(--label-blue-fg)]',
    gray: 'bg-[var(--label-gray-fg)]',
    green: 'bg-[var(--label-green-fg)]',
    orange: 'bg-[var(--label-orange-fg)]',
    pink: 'bg-[var(--label-pink-fg)]',
    purple: 'bg-[var(--label-purple-fg)]',
    red: 'bg-[var(--label-red-fg)]',
    teal: 'bg-[var(--label-teal-fg)]',
};

// Fallback for a name not yet in the catalog (e.g. an auto-create pending save).
export const fallbackLabelColor: TaskLabelColor = 'gray';
