'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { readWindowState, resolveInitialBounds, writeWindowState } = require('./window-state.cjs');

const laptopDisplay = { x: 0, y: 0, width: 1728, height: 1079 };
const constraints = {
    minWidth: 1100,
    minHeight: 760,
    defaults: { width: 1440, height: 960, x: undefined, y: undefined },
};

test('readWindowState returns null for missing or malformed files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'window-state-'));
    try {
        assert.equal(readWindowState(path.join(dir, 'missing.json')), null);

        const malformed = path.join(dir, 'malformed.json');
        writeFileSync(malformed, 'not json');
        assert.equal(readWindowState(malformed), null);

        const partial = path.join(dir, 'partial.json');
        writeFileSync(partial, JSON.stringify({ width: 1200, height: 800 }));
        assert.equal(readWindowState(partial), null);
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
});

test('writeWindowState round-trips bounds and drops extra fields', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'window-state-'));
    try {
        const file = path.join(dir, 'nested', 'window-state.json');
        writeWindowState(file, { x: 40, y: 60, width: 1280, height: 900, extra: true });

        assert.deepEqual(readWindowState(file), { x: 40, y: 60, width: 1280, height: 900 });
        assert.equal(JSON.parse(readFileSync(file, 'utf8')).extra, undefined);
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
});

test('writeWindowState ignores malformed bounds', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'window-state-'));
    try {
        const file = path.join(dir, 'window-state.json');
        writeWindowState(file, { x: Number.NaN, y: 0, width: 1280, height: 900 });
        assert.equal(readWindowState(file), null);
    } finally {
        rmSync(dir, { force: true, recursive: true });
    }
});

test('resolveInitialBounds restores state on a connected display', () => {
    const state = { x: 120, y: 80, width: 1280, height: 900 };
    assert.deepEqual(resolveInitialBounds(state, [laptopDisplay], constraints), state);
});

test('resolveInitialBounds falls back when no state is saved', () => {
    assert.deepEqual(
        resolveInitialBounds(null, [laptopDisplay], constraints),
        constraints.defaults
    );
});

test('resolveInitialBounds falls back when the saved display is gone', () => {
    const offscreen = { x: 4000, y: 0, width: 1280, height: 900 };
    assert.deepEqual(
        resolveInitialBounds(offscreen, [laptopDisplay], constraints),
        constraints.defaults
    );
});

test('resolveInitialBounds falls back when saved bounds shrank below minimums', () => {
    const tiny = { x: 0, y: 0, width: 800, height: 600 };
    assert.deepEqual(
        resolveInitialBounds(tiny, [laptopDisplay], constraints),
        constraints.defaults
    );
});

test('resolveInitialBounds accepts partially visible windows across displays', () => {
    const secondDisplay = { x: 1728, y: 0, width: 2560, height: 1440 };
    const straddling = { x: 1600, y: 100, width: 1280, height: 900 };
    assert.deepEqual(
        resolveInitialBounds(straddling, [laptopDisplay, secondDisplay], constraints),
        straddling
    );
});
