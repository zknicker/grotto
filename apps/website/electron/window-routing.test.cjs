'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildWindowUrl, isSafeWindowRoute, nextWindowBounds } = require('./window-routing.cjs');

test('isSafeWindowRoute only accepts in-app routes', () => {
    assert.equal(isSafeWindowRoute('/chats/abc'), true);
    assert.equal(isSafeWindowRoute('/members/agents/abc'), true);
    assert.equal(isSafeWindowRoute('/settings'), true);
    assert.equal(isSafeWindowRoute('/new/key'), false);
    assert.equal(isSafeWindowRoute('/dashboard/chats/abc'), false);
    assert.equal(isSafeWindowRoute('https://evil.example'), false);
    assert.equal(isSafeWindowRoute(undefined), false);
    assert.equal(isSafeWindowRoute(42), false);
});

test('nextWindowBounds centers the first window and offsets the rest', () => {
    assert.deepEqual(nextWindowBounds(undefined), {
        width: 1440,
        height: 960,
        x: undefined,
        y: undefined,
    });

    assert.deepEqual(
        nextWindowBounds({ x: 100, y: 80, width: 1200, height: 800 }, { offset: 36 }),
        {
            width: 1200,
            height: 800,
            x: 136,
            y: 116,
        }
    );
});

test('buildWindowUrl seeds hosted and dev Server UI routes', () => {
    assert.equal(buildWindowUrl('https://grotto.sh', '/chats/abc'), 'https://grotto.sh/chats/abc');
    assert.equal(
        buildWindowUrl('http://localhost:3100', '/chats/abc'),
        'http://localhost:3100/chats/abc'
    );
    assert.equal(buildWindowUrl('https://grotto.sh', undefined), 'https://grotto.sh');
});
