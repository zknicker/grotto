import { Avatar } from 'heroui-native/avatar';

export function EntityAvatar({
    avatarUrl,
    name,
    size = 24,
}: {
    avatarUrl: string | null;
    name: string;
    size?: number;
}) {
    return (
        <Avatar alt={`${name} avatar`} size="sm" style={{ height: size, width: size }}>
            {avatarUrl ? <Avatar.Image source={{ uri: avatarUrl }} /> : null}
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
