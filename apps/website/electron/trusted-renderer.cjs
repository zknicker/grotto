'use strict';

function assertTrustedRenderer(event, appUrl) {
    const senderUrl = event.senderFrame?.url ?? event.sender?.getURL?.();
    if (!isTrustedRendererUrl(senderUrl, appUrl)) {
        throw new Error('Untrusted page cannot use the Grotto desktop bridge.');
    }
}

function isTrustedRendererUrl(value, appUrl) {
    const url = parseUrl(value);
    const app = parseUrl(appUrl);
    return Boolean(url && app && url.origin === app.origin);
}

function parseUrl(value) {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}

module.exports = { assertTrustedRenderer, isTrustedRendererUrl };
