/** Where the App reads avatar bytes. Ids are opaque, so the route is public. */
export const avatarRoutePrefix = '/api/avatars';

/** The `<img src>` for one stored avatar, or nothing when none is set. */
export function avatarUrlFor(avatarId: null | string): null | string {
    return avatarId ? `${avatarRoutePrefix}/${avatarId}` : null;
}
