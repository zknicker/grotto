/** Derives a valid Server address while keeping name-to-address typing predictable. */
export function slugifyServerName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '')
        .slice(0, 32)
        .replace(/-+$/gu, '');
}
