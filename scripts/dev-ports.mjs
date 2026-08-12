import { createHash } from 'node:crypto';

const defaultWebsitePort = '3100';
const defaultGrottoPort = '8090';
const devPortGroupBase = 20_000;
const devPortGroupCount = 8000;

export function resolveDevPorts({
    baseEnvironment = process.env,
    port,
    repositoryRoot,
    websitePort,
} = {}) {
    const useIsolatedGroup = Boolean(
        repositoryRoot ??
            baseEnvironment.TAVERN_DEV_PORT_BASE ??
            baseEnvironment.TAVERN_DEV_STACK_ID
    );
    const portBase = useIsolatedGroup
        ? resolveDevPortBase({ baseEnvironment, repositoryRoot: repositoryRoot ?? process.cwd() })
        : null;
    const resolvedWebsitePort =
        websitePort ??
        baseEnvironment.TAVERN_WEBSITE_PORT ??
        port ??
        (hasExplicitDevPortInput({ baseEnvironment, port, websitePort })
            ? defaultWebsitePort
            : portBase === null
              ? defaultWebsitePort
              : String(portBase));
    const resolvedGrottoPort =
        baseEnvironment.GROTTO_SERVER_PORT ??
        (port
            ? incrementPortBy(port, 3)
            : hasExplicitDevPortInput({ baseEnvironment, port, websitePort }) || portBase === null
              ? defaultGrottoPort
              : String(portBase + 3));
    return {
        grottoPort: parsePort(resolvedGrottoPort, 'hosted Server port'),
        websitePort: parsePort(resolvedWebsitePort, 'vite port'),
    };
}

export function getDevEnvironment({ baseEnvironment = process.env, port, websitePort } = {}) {
    const resolvedPorts = resolveDevPorts({
        baseEnvironment,
        port,
        websitePort,
    });

    return {
        ...baseEnvironment,
        GROTTO_SERVER_PORT: resolvedPorts.grottoPort,
        TAVERN_WEBSITE_PORT: resolvedPorts.websitePort,
    };
}

function resolveDevPortBase({ baseEnvironment, repositoryRoot }) {
    const explicitBase = baseEnvironment.TAVERN_DEV_PORT_BASE;
    if (explicitBase) {
        const parsed = Number(parsePort(explicitBase, 'dev port base'));
        if (parsed > 65_532) {
            throw new Error('Expected TAVERN_DEV_PORT_BASE to leave room for four dev ports.');
        }
        return parsed;
    }

    const portIdentity = baseEnvironment.TAVERN_DEV_STACK_ID
        ? `stack:${baseEnvironment.TAVERN_DEV_STACK_ID}`
        : repositoryRoot;
    const digest = createHash('sha256').update(portIdentity).digest();
    const bucket = digest.readUInt32BE(0) % devPortGroupCount;
    return devPortGroupBase + bucket * 4;
}

function hasExplicitDevPortInput({ baseEnvironment, port, websitePort }) {
    return Boolean(port ?? websitePort ?? baseEnvironment.TAVERN_WEBSITE_PORT);
}

function incrementPortBy(value, offset) {
    const numericValue = Number(parsePort(value, 'port'));

    if (numericValue + offset > 65_535) {
        throw new Error('Expected a valid port that leaves room for the dev stack port group.');
    }

    return String(numericValue + offset);
}

function parsePort(value, label) {
    if (!/^\d+$/u.test(value)) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65_535) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    return value;
}
