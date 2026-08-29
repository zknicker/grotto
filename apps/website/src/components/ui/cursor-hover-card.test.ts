import { expect, test } from 'bun:test';
import { getCursorHoverOffset } from './cursor-hover-card.tsx';

const bounds = { height: 20, left: 100, top: 40, width: 100 };

test('centers the cursor-following surface when the pointer is centered', () => {
    expect(getCursorHoverOffset({ bounds, clientX: 150, clientY: 50 })).toEqual({ x: 0, y: 0 });
});

test('follows the pointer within bounded collision-safe travel', () => {
    expect(getCursorHoverOffset({ bounds, clientX: 200, clientY: 60 })).toEqual({ x: 40, y: 7 });
    expect(getCursorHoverOffset({ bounds, clientX: 1000, clientY: 1000 })).toEqual({
        x: 48,
        y: 16,
    });
});

test("keeps cursor-following motion inside HeroUI's viewport boundary", () => {
    expect(
        getCursorHoverOffset({
            bounds: { height: 18, left: 677, top: 841, width: 80 },
            clientX: 756,
            clientY: 850,
            surfaceBounds: { bottom: 943, left: 601, right: 931, top: 867 },
            viewport: { height: 1045, width: 943 },
        })
    ).toEqual({ x: 0, y: 0 });
});
