import type { Chat } from '@grotto/api';

export function orderChannels(channels: readonly Chat[], storedIds: readonly string[]): Chat[] {
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const ordered = storedIds.flatMap((id) => {
        const channel = channelById.get(id);
        if (!channel) {
            return [];
        }
        channelById.delete(id);
        return [channel];
    });
    return [...ordered, ...channelById.values()];
}

export function readChannelOrder(storage: Pick<Storage, 'getItem'>, key: string): string[] {
    try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? '[]');
        if (!Array.isArray(value)) {
            return [];
        }
        return [...new Set(value.filter((id): id is string => typeof id === 'string'))];
    } catch {
        return [];
    }
}

export function writeChannelOrder(
    storage: Pick<Storage, 'setItem'>,
    key: string,
    channels: readonly Chat[]
) {
    try {
        storage.setItem(key, JSON.stringify(channels.map((channel) => channel.id)));
    } catch {
        // Local presentation can still update when storage is unavailable.
    }
}
