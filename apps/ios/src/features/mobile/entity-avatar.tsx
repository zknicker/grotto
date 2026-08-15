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

    return (
        <Avatar alt={`${name} avatar`} size="sm" style={{ height: size, width: size }}>
            {resolvedAvatarUrl ? <Avatar.Image source={{ uri: resolvedAvatarUrl }} /> : null}
            <Avatar.Fallback styles={{ text: { fontSize: Math.max(8, Math.round(size * 0.42)) } }}>
                {getEntityInitials(name)}
            </Avatar.Fallback>
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
