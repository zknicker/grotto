import { Avatar } from 'heroui-native/avatar';
import { appConfig } from '../../lib/app-config.ts';
import { resolveAvatarUrl } from './avatar-url.ts';

export function EntityAvatar({
    avatarUrl,
    name,
    size = 24,
}: {
    avatarUrl: string | null;
    name: string;
    size?: number;
}) {
    const resolvedAvatarUrl = resolveAvatarUrl(avatarUrl, appConfig.serverOrigin);
    const avatarSize = size >= 64 ? 'lg' : size >= 48 ? 'md' : 'sm';

    return (
        <Avatar alt={`${name} avatar`} size={avatarSize} style={{ height: size, width: size }}>
            {resolvedAvatarUrl ? <Avatar.Image source={{ uri: resolvedAvatarUrl }} /> : null}
            <Avatar.Fallback>{getEntityInitials(name)}</Avatar.Fallback>
        </Avatar>
    );
}

export function getEntityInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return '?';
    }
    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
    }
    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}
