export function hausOrigin(origin: string): string {
    return origin === 'https://grotto.sh' ? 'https://haus.chat' : origin;
}

export function normalizeHttpOrigin(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Haus Server origin must use HTTP(S).');
    }
    return hausOrigin(url.origin);
}
