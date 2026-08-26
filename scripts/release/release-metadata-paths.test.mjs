import { expect, test } from 'bun:test';
import { releaseMetadataPaths } from './release-metadata-paths.mjs';

test('publisher accepts every file changed by the coordinated release bump', () => {
    expect(releaseMetadataPaths).toEqual([
        'CHANGELOG.md',
        'apps/ios-swift/project.yml',
        'apps/website/package.json',
        'release-surfaces.json',
    ]);
});
