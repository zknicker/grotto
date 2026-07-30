import { expect, test } from 'bun:test';
import { splitHostedArtifactFences } from './hosted-artifact-message.tsx';

test('extracts valid artifact cards while preserving surrounding chat text', () => {
    expect(
        splitHostedArtifactFences(
            'Here is the report.\n```artifact\n{"path":"reports/summary.html","title":"Summary"}\n```\nDone.'
        ).map(({ key: _, ...segment }) => segment)
    ).toEqual([
        { kind: 'text', text: 'Here is the report.\n' },
        {
            kind: 'artifact',
            props: { path: 'reports/summary.html', title: 'Summary' },
        },
        { kind: 'text', text: '\nDone.' },
    ]);
});

test('keeps malformed artifact fences visible as ordinary message text', () => {
    const content = '```artifact\n{"path":"notes.txt"}\n```';

    expect(splitHostedArtifactFences(content).map(({ key: _, ...segment }) => segment)).toEqual([
        { kind: 'text', text: content },
    ]);
});
