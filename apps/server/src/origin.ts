export function isAllowedAppOrigin(origin: string | undefined, appOrigin: string) {
    if (!origin) {
        return true;
    }

    if (origin === appOrigin) {
        return true;
    }

    try {
        const url = new URL(origin);

        return (
            origin === 'file://' ||
            url.protocol === 'file:' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === 'localhost'
        );
    } catch {
        return false;
    }
}
