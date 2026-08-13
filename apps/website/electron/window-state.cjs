'use strict';

// Persists the last-closed window's bounds so the app reopens where the user
// left it. Resolution helpers are pure (no electron imports) so they can be
// unit-tested without launching the app; only the read/write pair touches disk.

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

// Restored bounds must keep at least this much of the window on a connected
// display, so a saved position from a detached monitor never strands it.
const minVisibleWidthPx = 200;
const minVisibleHeightPx = 100;

/** Reads persisted bounds, returning null for missing or malformed state. */
function readWindowState(filePath) {
    try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        if (!isBounds(parsed)) {
            return null;
        }

        return { x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height };
    } catch {
        return null;
    }
}

/** Persists window bounds. Failure to save must never break the app. */
function writeWindowState(filePath, bounds) {
    if (!isBounds(bounds)) {
        return;
    }

    try {
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(
            filePath,
            JSON.stringify({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            })
        );
    } catch {
        // Window-state persistence is best-effort.
    }
}

/**
 * Restores saved bounds only when they satisfy the window minimums and still
 * land on a connected display; otherwise falls back to the provided defaults.
 */
function resolveInitialBounds(state, displayWorkAreas, { minWidth, minHeight, defaults }) {
    if (!state || state.width < minWidth || state.height < minHeight) {
        return defaults;
    }

    const visible = displayWorkAreas.some(
        (area) =>
            overlap(state.x, state.width, area.x, area.width) >= minVisibleWidthPx &&
            overlap(state.y, state.height, area.y, area.height) >= minVisibleHeightPx
    );

    return visible ? state : defaults;
}

function overlap(start, length, areaStart, areaLength) {
    return Math.min(start + length, areaStart + areaLength) - Math.max(start, areaStart);
}

function isBounds(value) {
    return (
        typeof value === 'object' &&
        value !== null &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y) &&
        Number.isFinite(value.width) &&
        Number.isFinite(value.height)
    );
}

module.exports = {
    readWindowState,
    resolveInitialBounds,
    writeWindowState,
};
