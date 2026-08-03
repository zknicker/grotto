'use strict';

const productionAppOrigin = 'https://grotto.sh';
const productionClerkOrigin = 'https://clerk.grotto.sh';

function resolveClerkAuthOrigins({ appUrl, clerkIssuerUrl, isPackaged }) {
    if (isPackaged) {
        return {
            appOrigin: productionAppOrigin,
            clerkOrigin: productionClerkOrigin,
        };
    }

    if (!clerkIssuerUrl) {
        throw new Error('Desktop development requires CLERK_ISSUER_URL.');
    }

    return {
        appOrigin: parseOrigin(appUrl, ['http:', 'https:']),
        clerkOrigin: parseOrigin(clerkIssuerUrl, ['https:']),
    };
}

function parseOrigin(value, allowedProtocols) {
    const url = new URL(value);
    if (!allowedProtocols.includes(url.protocol)) {
        throw new Error(`Unsupported Clerk auth origin protocol: ${url.protocol}`);
    }
    return url.origin;
}

module.exports = { resolveClerkAuthOrigins };
