'use strict';

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { describe, expect, test } = require('bun:test');

const preloadPath = path.join(__dirname, 'preload.cjs');

// `preload.cjs` only resolves `electron` inside the renderer sandbox, so it
// cannot be required directly. Run the real file with a stub `require` instead
// and record what it hands to `contextBridge`.
function exposeDesktopBridge() {
    const exposed = new Map();
    const electron = {
        contextBridge: {
            exposeInMainWorld: (name, value) => {
                exposed.set(name, value);
            },
        },
        ipcRenderer: { invoke: () => undefined, off: () => undefined, on: () => undefined },
    };

    const preloadModule = { exports: {} };
    const compiled = new Function(
        'require',
        'module',
        'exports',
        '__filename',
        '__dirname',
        readFileSync(preloadPath, 'utf8')
    );
    compiled(
        // `electron` is the only specifier that needs standing in for; this
        // test file sits beside preload.cjs, so anything else resolves the same
        // way it would in the shell.
        (specifier) => (specifier === 'electron' ? electron : require(specifier)),
        preloadModule,
        preloadModule.exports,
        preloadPath,
        __dirname
    );

    return exposed;
}

describe('desktop preload bridge', () => {
    // The shell and the App ship on independent channels, so the injected
    // global is a cross-version wire contract: a packaged shell always loads
    // whatever App the hosted Server is serving. Renaming it without the alias
    // dropped older Apps back to the browser sign-in redirect in production.
    test('exposes both the current and the legacy bridge global', () => {
        const exposed = exposeDesktopBridge();

        expect(exposed.has('grottoDesktop')).toBe(true);
        expect(exposed.has('tavernDesktop')).toBe(true);
        expect(exposed.get('tavernDesktop')).toBe(exposed.get('grottoDesktop'));
    });

    test('both globals carry the same live desktop surface', () => {
        const bridge = exposeDesktopBridge().get('grottoDesktop');

        expect(bridge.loadsApp).toBe(true);
        expect(typeof bridge.authTokenGet).toBe('function');
        expect(typeof bridge.openExternal).toBe('function');
        expect(typeof bridge.prepareSsoCallback).toBe('function');
    });
});
