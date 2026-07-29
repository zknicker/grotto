'use strict';

function prepareNativeClerkRequest(details, clerkOrigin = 'https://clerk.grotto.sh') {
    if (!isNativeClerkRequest(details.url, clerkOrigin)) {
        return details.requestHeaders;
    }

    return Object.fromEntries(
        Object.entries(details.requestHeaders).filter(([name]) => name.toLowerCase() !== 'origin')
    );
}

function prepareNativeClerkResponse(
    details,
    clerkOrigin = 'https://clerk.grotto.sh',
    appOrigin = 'https://grotto.sh'
) {
    if (!isNativeClerkRequest(details.url, clerkOrigin)) {
        return details.responseHeaders;
    }

    return {
        ...details.responseHeaders,
        'Access-Control-Allow-Headers': ['authorization', 'content-type'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'Access-Control-Allow-Origin': [new URL(appOrigin).origin],
    };
}

function registerNativeClerkRequestHeaders(
    webRequest,
    clerkOrigin = 'https://clerk.grotto.sh',
    appOrigin = 'https://grotto.sh'
) {
    webRequest.onBeforeSendHeaders(
        { urls: [`${clerkOrigin.replace(/\/$/u, '')}/*`] },
        (details, callback) => {
            callback({
                requestHeaders: prepareNativeClerkRequest(details, clerkOrigin),
            });
        }
    );

    webRequest.onHeadersReceived(
        { urls: [`${clerkOrigin.replace(/\/$/u, '')}/*`] },
        (details, callback) => {
            callback({
                responseHeaders: prepareNativeClerkResponse(details, clerkOrigin, appOrigin),
            });
        }
    );
}

function isNativeClerkRequest(value, clerkOrigin) {
    try {
        const url = new URL(value);
        return (
            url.origin === new URL(clerkOrigin).origin && url.searchParams.get('_is_native') === '1'
        );
    } catch {
        return false;
    }
}

module.exports = {
    prepareNativeClerkRequest,
    prepareNativeClerkResponse,
    registerNativeClerkRequestHeaders,
};
