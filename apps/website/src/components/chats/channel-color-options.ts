import type { CSSProperties } from 'react';

export const channelColorOptions = [
    { darkValue: '#94a3b8', id: 'slate', label: 'Slate', lightValue: '#475569', value: '#64748b' },
    { darkValue: '#f87171', id: 'red', label: 'Red', lightValue: '#dc2626', value: '#ef4444' },
    {
        darkValue: '#fb923c',
        id: 'orange',
        label: 'Orange',
        lightValue: '#ea580c',
        value: '#f97316',
    },
    { darkValue: '#fbbf24', id: 'amber', label: 'Amber', lightValue: '#d97706', value: '#f59e0b' },
    {
        darkValue: '#facc15',
        id: 'yellow',
        label: 'Yellow',
        lightValue: '#ca8a04',
        value: '#eab308',
    },
    { darkValue: '#a3e635', id: 'lime', label: 'Lime', lightValue: '#65a30d', value: '#84cc16' },
    { darkValue: '#4ade80', id: 'green', label: 'Green', lightValue: '#16a34a', value: '#22c55e' },
    {
        darkValue: '#34d399',
        id: 'emerald',
        label: 'Emerald',
        lightValue: '#059669',
        value: '#10b981',
    },
    { darkValue: '#2dd4bf', id: 'teal', label: 'Teal', lightValue: '#0d9488', value: '#14b8a6' },
    { darkValue: '#22d3ee', id: 'cyan', label: 'Cyan', lightValue: '#0891b2', value: '#06b6d4' },
    { darkValue: '#38bdf8', id: 'sky', label: 'Sky', lightValue: '#0284c7', value: '#0ea5e9' },
    { darkValue: '#60a5fa', id: 'blue', label: 'Blue', lightValue: '#2563eb', value: '#3b82f6' },
    {
        darkValue: '#818cf8',
        id: 'indigo',
        label: 'Indigo',
        lightValue: '#4f46e5',
        value: '#6366f1',
    },
    {
        darkValue: '#a78bfa',
        id: 'violet',
        label: 'Violet',
        lightValue: '#7c3aed',
        value: '#8b5cf6',
    },
    {
        darkValue: '#c084fc',
        id: 'purple',
        label: 'Purple',
        lightValue: '#9333ea',
        value: '#a855f7',
    },
    {
        darkValue: '#e879f9',
        id: 'fuchsia',
        label: 'Fuchsia',
        lightValue: '#c026d3',
        value: '#d946ef',
    },
    { darkValue: '#f472b6', id: 'pink', label: 'Pink', lightValue: '#db2777', value: '#ec4899' },
    { darkValue: '#fb7185', id: 'rose', label: 'Rose', lightValue: '#e11d48', value: '#f43f5e' },
] as const;

export interface ChannelColorTheme {
    darkValue: string;
    lightValue: string;
}

type ChannelColorStyle = CSSProperties & Record<`--${string}`, string>;

export function getChannelColorStyle(
    color: string | null | undefined
): ChannelColorStyle | undefined {
    if (!color) {
        return undefined;
    }

    const theme = getChannelColorTheme(color);

    return {
        '--channel-color-bg-active-dark': colorMix(theme.darkValue, 30),
        '--channel-color-bg-active-light': colorMix(theme.lightValue, 28),
        '--channel-color-bg-dark': colorMix(theme.darkValue, 22),
        '--channel-color-bg-hover-dark': colorMix(theme.darkValue, 26),
        '--channel-color-bg-hover-light': colorMix(theme.lightValue, 24),
        '--channel-color-bg-light': colorMix(theme.lightValue, 20),
        '--channel-color-bg-sidebar-light': colorMix(theme.lightValue, 17),
        '--channel-color-dark': theme.darkValue,
        '--channel-color-light': theme.lightValue,
    };
}

/**
 * Channels store a preset id (`violet`), not a hex value, so a design-system
 * palette change restyles every channel that already picked that preset.
 */
export function getChannelColorTheme(color: string): ChannelColorTheme {
    const normalized = color.trim().toLowerCase();
    const option = channelColorOptions.find((entry) => entry.id === normalized);

    return option
        ? { darkValue: option.darkValue, lightValue: option.lightValue }
        : { darkValue: color, lightValue: color };
}

function colorMix(color: string, percent: number) {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
