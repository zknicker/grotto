'use strict';

// Pure helpers for multi-window routing/placement. Kept free of electron imports so
// they can be unit-tested without launching the app.

// Top-level in-app route prefixes (mirrors lib/app-routes.ts; this file is plain CJS and
// cannot import the TS source). Only routes under one of these may seed a new window.
const appRoutePrefixes = [
    '/activity',
    '/chats',
    '/design',
    '/members',
    '/reminders',
    '/search',
    '/tasks',
    '/settings',
];
const defaultWindowWidth = 1440;
const defaultWindowHeight = 960;
const defaultWindowOffsetPx = 36;

/** Only same-origin app routes may seed a new window. */
function isSafeWindowRoute(route) {
    return typeof route === 'string' && appRoutePrefixes.some((prefix) => route.startsWith(prefix));
}

/** Offsets each new window from its opener (or screen-centered default) so they don't stack. */
function nextWindowBounds(openerBounds, options = {}) {
    const offset = options.offset ?? defaultWindowOffsetPx;
    const width = options.width ?? defaultWindowWidth;
    const height = options.height ?? defaultWindowHeight;

    if (!openerBounds) {
        return { width, height, x: undefined, y: undefined };
    }

    return {
        width: openerBounds.width,
        height: openerBounds.height,
        x: openerBounds.x + offset,
        y: openerBounds.y + offset,
    };
}

/** Builds the hosted or dev Grotto App URL for a seeded route, or the bare App origin. */
function buildWindowUrl(appUrl, route) {
    return route ? new URL(route, appUrl).toString() : appUrl;
}

module.exports = {
    buildWindowUrl,
    isSafeWindowRoute,
    nextWindowBounds,
};
