export function resolveAvatarUrl(avatarUrl: string | null, serverOrigin: string): string | null {
    return avatarUrl ? new URL(avatarUrl, serverOrigin).href : null;
}
