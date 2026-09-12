export function normalizeHttpOrigin(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Haus Server origin must use HTTP(S).');
    }
    return url.origin;
}
