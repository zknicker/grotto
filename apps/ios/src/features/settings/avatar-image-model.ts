import { avatarMaxBytes, avatarPixelSize } from '@tavern/api/avatar';

export function avatarImageTransform(width: number, height: number) {
    const cropSize = Math.min(width, height);
    const outputSize = Math.min(cropSize, avatarPixelSize);

    return {
        crop: {
            height: cropSize,
            originX: Math.floor((width - cropSize) / 2),
            originY: Math.floor((height - cropSize) / 2),
            width: cropSize,
        },
        outputSize,
    };
}

export function assertAvatarByteSize(base64: string) {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const byteSize = Math.floor((base64.length * 3) / 4) - padding;

    if (byteSize > avatarMaxBytes) {
        throw new Error('That photo is still too large. Please choose another image.');
    }
}
