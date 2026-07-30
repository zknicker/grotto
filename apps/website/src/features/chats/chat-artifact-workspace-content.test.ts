import { expect, test } from 'bun:test';
import {
    buildWorkspaceTreePaths,
    filterWorkspaceTreePaths,
} from './chat-artifact-workspace-model.ts';

test('buildWorkspaceTreePaths keeps root files when a child directory is loaded', () => {
    const paths = buildWorkspaceTreePaths({
        '': [
            {
                kind: 'directory',
                mediaType: null,
                name: 'out',
                path: 'out',
                sizeBytes: null,
                updatedAt: null,
            },
            {
                kind: 'file',
                mediaType: 'text/markdown',
                name: 'NOTES.md',
                path: 'NOTES.md',
                sizeBytes: 123,
                updatedAt: '2026-06-25T00:00:00.000Z',
            },
        ],
        out: [
            {
                kind: 'file',
                mediaType: 'text/html',
                name: 'preview.html',
                path: 'out/preview.html',
                sizeBytes: 456,
                updatedAt: '2026-06-25T00:00:00.000Z',
            },
        ],
    });

    expect(paths).toContain('out/');
    expect(paths).toContain('NOTES.md');
    expect(paths).toContain('out/preview.html');
});

test('filterWorkspaceTreePaths keeps ancestors for matching files', () => {
    const paths = ['out/', 'out/nested/', 'out/nested/preview.html', 'NOTES.md'];

    expect(filterWorkspaceTreePaths(paths, 'preview')).toEqual([
        'out/',
        'out/nested/',
        'out/nested/preview.html',
    ]);
});
