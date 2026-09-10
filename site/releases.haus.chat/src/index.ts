export const releaseOrigin = new URL(
    'https://punchpress-electron-app-209596837609-us-east-1-an.s3.us-east-1.amazonaws.com/tavern/mac/'
);

const publicNamespaces = ['/computer/', '/haus/', '/grotto/'];

export function handleReleaseRequest(request: Request): Response {
    const requested = new URL(request.url);
    if (!publicNamespaces.some((namespace) => requested.pathname.startsWith(namespace))) {
        return new Response('Not found.\n', {
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            status: 404,
        });
    }

    // Published S3 keys are immutable; the Haus URL maps to their existing namespace.
    const artifactPath = requested.pathname.replace(/^\/haus\//u, '/grotto/');
    const destination = new URL(`.${artifactPath}`, releaseOrigin);
    destination.search = requested.search;
    return new Response(null, {
        headers: {
            'cache-control': 'no-store',
            location: destination.toString(),
        },
        status: 307,
    });
}

export default {
    fetch: handleReleaseRequest,
};
