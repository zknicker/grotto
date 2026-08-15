import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { assertAvatarByteSize, avatarImageTransform } from './avatar-image-model.ts';

export interface PickedAvatarImage {
    bytesBase64: string;
    mediaType: 'image/jpeg';
}

export async function pickAvatarImage(): Promise<PickedAvatarImage | null> {
    const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 1,
    });
    const asset = result.assets?.[0];

    if (result.canceled || !asset) {
        return null;
    }

    const transform = avatarImageTransform(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri).crop(transform.crop);
    if (transform.outputSize < transform.crop.width) {
        context.resize({ height: transform.outputSize, width: transform.outputSize });
    }

    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
        base64: true,
        compress: 0.9,
        format: SaveFormat.JPEG,
    });
    if (!image.base64) {
        throw new Error('That photo could not be read.');
    }

    assertAvatarByteSize(image.base64);
    return { bytesBase64: image.base64, mediaType: 'image/jpeg' };
}
