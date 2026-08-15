import { describe, expect, test } from 'bun:test';
import { avatarMaxBytes, avatarPixelSize } from '@tavern/api/avatar';
import { assertAvatarByteSize, avatarImageTransform } from './avatar-image-model.ts';

describe('avatarImageTransform', () => {
    test('center-crops a landscape image and resizes it to the avatar contract', () => {
        expect(avatarImageTransform(1200, 800)).toEqual({
            crop: { height: 800, originX: 200, originY: 0, width: 800 },
            outputSize: avatarPixelSize,
        });
    });

    test('does not upscale a small portrait image', () => {
        expect(avatarImageTransform(120, 180)).toEqual({
            crop: { height: 120, originX: 0, originY: 30, width: 120 },
            outputSize: 120,
        });
    });
});

describe('assertAvatarByteSize', () => {
    test('accepts the upload ceiling and rejects larger encoded images', () => {
        expect(() =>
            assertAvatarByteSize('a'.repeat(Math.ceil((avatarMaxBytes * 4) / 3)))
        ).not.toThrow();
        expect(() =>
            assertAvatarByteSize('a'.repeat(Math.ceil(((avatarMaxBytes + 3) * 4) / 3)))
        ).toThrow('That photo is still too large. Please choose another image.');
    });
});
