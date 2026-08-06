import { expect, test } from 'bun:test';
import { splitArtifactFences } from './artifact-message.tsx';

test('extracts valid artifact cards while preserving surrounding chat text', () => {
    expect(
        splitArtifactFences(
            'Here is the report.\n```artifact\n{"path":"reports/summary.html","title":"Summary"}\n```\nDone.'
        ).map(({ key: _, ...segment }) => segment)
    ).toEqual([
        { end: 20, kind: 'text', start: 0, text: 'Here is the report.\n' },
        {
            kind: 'artifact',
            props: { path: 'reports/summary.html', title: 'Summary' },
        },
        { end: 91, kind: 'text', start: 85, text: '\nDone.' },
    ]);
});

test('keeps malformed artifact fences visible as ordinary message text', () => {
    const content = '```artifact\n{"path":"notes.txt"}\n```';

    expect(splitArtifactFences(content).map(({ key: _, ...segment }) => segment)).toEqual([
        { end: content.length, kind: 'text', start: 0, text: content },
    ]);
});
