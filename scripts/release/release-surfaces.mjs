import { isSemver } from './release-utils.mjs';

const surfaceLabels = {
    appServer: 'App/Server',
    desktop: 'Desktop',
    computer: 'Computer',
    runtime: 'Runtime',
};
const surfaceKeys = Object.keys(surfaceLabels);

export function assertReleaseSurfaceDecision(value, options = {}) {
    assertExactObject(value, ['surfaces', 'targetVersion']);
    assertExactObject(value.surfaces, surfaceKeys);

    if (value.targetVersion === null) {
        const undecided = surfaceKeys.every(
            (key) =>
                value.surfaces[key].action === 'undecided' && value.surfaces[key].version === null
        );
        if (undecided) {
            if (options.requireDecision) {
                throw new Error('release surface decision is not prepared');
            }
            for (const key of surfaceKeys) {
                assertSurface(value.surfaces[key], key, true);
            }
            return { complete: false, value };
        }
        if (options.targetVersion) {
            throw new Error('Computer-only release decision cannot satisfy an App release');
        }
        for (const key of surfaceKeys) {
            assertSurface(value.surfaces[key], key, false);
        }
        if (
            value.surfaces.appServer.action !== 'unchanged' ||
            value.surfaces.desktop.action !== 'unchanged' ||
            value.surfaces.runtime.action !== 'unchanged' ||
            value.surfaces.computer.action !== 'publish'
        ) {
            throw new Error(
                'Computer-only release must publish Computer and leave other surfaces unchanged'
            );
        }
        return { complete: true, value };
    }

    if (!isSemver(value.targetVersion)) {
        throw new Error('release surface targetVersion must be SemVer');
    }
    if (options.targetVersion && value.targetVersion !== options.targetVersion) {
        throw new Error(
            `release surface target ${value.targetVersion} does not match ${options.targetVersion}`
        );
    }
    for (const key of surfaceKeys) {
        assertSurface(value.surfaces[key], key, false);
    }
    if (
        value.surfaces.appServer.action !== 'publish' ||
        value.surfaces.appServer.version !== value.targetVersion
    ) {
        throw new Error('App/Server must publish at the target App version');
    }
    for (const key of ['desktop']) {
        const surface = value.surfaces[key];
        if (surface.action === 'publish' && surface.version !== value.targetVersion) {
            throw new Error(`${surfaceLabels[key]} must publish at the target App version`);
        }
    }
    return { complete: true, value };
}

export function formatReleaseSurfaceDecision(value) {
    return [
        '### Release surfaces',
        '',
        ...surfaceKeys.map((key) => {
            const surface = value.surfaces[key];
            const action = capitalize(surface.action);
            const version = surface.version ? ` v${surface.version}` : '';
            return `- ${surfaceLabels[key]}: ${action}${version}`;
        }),
    ].join('\n');
}

export function resetReleaseSurfaceDecision(targetVersion) {
    return {
        targetVersion,
        surfaces: Object.fromEntries(
            surfaceKeys.map((key) => [
                key,
                {
                    action: key === 'appServer' ? 'publish' : 'undecided',
                    version: key === 'appServer' ? targetVersion : null,
                },
            ])
        ),
    };
}

function assertSurface(value, key, allowUndecided) {
    assertExactObject(value, ['action', 'version']);
    const actions = allowUndecided ? ['undecided'] : ['publish', 'unchanged'];
    if (!actions.includes(value.action)) {
        throw new Error(`${surfaceLabels[key]} has no explicit publish/unchanged decision`);
    }
    if (value.action === 'publish' && !isSemver(value.version)) {
        throw new Error(`${surfaceLabels[key]} publish decision requires a SemVer`);
    }
    if (value.action !== 'publish' && value.version !== null) {
        throw new Error(`${surfaceLabels[key]} ${value.action} decision cannot have a version`);
    }
}

function assertExactObject(value, keys) {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        throw new Error('release surface decision is invalid');
    }
    const actual = Object.keys(value);
    if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) {
        throw new Error('release surface decision has unexpected fields');
    }
}

function capitalize(value) {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
