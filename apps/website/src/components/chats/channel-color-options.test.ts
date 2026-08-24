import { describe, expect, test } from 'bun:test';
import {
    channelColorOptions,
    getChannelColorStyle,
    getChannelColorTheme,
} from './channel-color-options.ts';

describe('channel color options', () => {
    test('offers unique hex color choices', () => {
        expect(channelColorOptions.length).toBeGreaterThanOrEqual(12);
        expect(new Set(channelColorOptions.map((option) => option.id)).size).toBe(
            channelColorOptions.length
        );
        expect(channelColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.value))).toBe(
            true
        );
        expect(
            channelColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.lightValue))
        ).toBe(true);
        expect(
            channelColorOptions.every((option) => /^#[0-9a-f]{6}$/u.test(option.darkValue))
        ).toBe(true);
    });

    test('resolves a stored preset id case-insensitively', () => {
        expect(getChannelColorTheme('Green')).toEqual({
            darkValue: '#4ade80',
            lightValue: '#16a34a',
        });
    });

    test('leaves an unknown color as its own theme', () => {
        expect(getChannelColorTheme('#22c55e')).toEqual({
            darkValue: '#22c55e',
            lightValue: '#22c55e',
        });
    });

    test('builds visible style vars for a selected preset', () => {
        expect(getChannelColorStyle('green')).toEqual(
            expect.objectContaining({
                '--channel-color-bg-active-light': 'color-mix(in srgb, #16a34a 20%, transparent)',
                '--channel-color-dark': '#4ade80',
                '--channel-color-light': '#16a34a',
            })
        );
        expect(getChannelColorStyle(null)).toBeUndefined();
    });
});
