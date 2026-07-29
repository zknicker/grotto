'use strict';

const path = require('node:path');
const { describe, expect, test } = require('bun:test');
const { desktopRuntimeDependencies } = require('./runtime-dependencies.cjs');

describe('desktop runtime dependencies', () => {
    test('packages the complete electron-updater dependency graph', () => {
        const packagePath = require.resolve('electron-updater/package.json');
        expect(collectDependencies('electron-updater', path.dirname(packagePath))).toEqual(
            desktopRuntimeDependencies
        );
    });
});

function collectDependencies(root, fromDirectory) {
    const found = new Set();

    function collect(packageName, searchDirectory) {
        if (found.has(packageName)) {
            return;
        }

        const packagePath = require.resolve(`${packageName}/package.json`, {
            paths: [searchDirectory],
        });
        const packageJson = require(packagePath);
        found.add(packageName);

        for (const dependency of Object.keys(packageJson.dependencies ?? {})) {
            collect(dependency, path.dirname(packagePath));
        }
    }

    collect(root, fromDirectory);
    return [...found].sort();
}
