import { expect, test } from 'bun:test';
import {
    formatChatPaneTargetLink,
    mergeChatPaneOpenTarget,
    parseChatPaneTargetLink,
} from './pane-links.ts';

test('parseChatPaneTargetLink parses workspace file links', () => {
    expect(parseChatPaneTargetLink('grotto://workspace/out/preview.html')).toEqual({
        kind: 'workspaceFile',
        path: 'out/preview.html',
    });
});

test('parseChatPaneTargetLink parses empty paths as directory targets', () => {
    expect(parseChatPaneTargetLink('grotto://workspace/')).toEqual({
        kind: 'workspaceDirectory',
        path: '',
    });
});

test('parseChatPaneTargetLink rejects unsafe or unsupported links', () => {
    expect(parseChatPaneTargetLink('https://example.com')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://settings/agents')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://workspace/../secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://workspace//secret.md')).toBeNull();
    expect(parseChatPaneTargetLink('grotto://workspace/docs/page.md?mode=raw')).toBeNull();
});

test('parseChatPaneTargetLink resolves encoded dot segments inside the root', () => {
    // URL normalization consumes %2e%2e against the root before parsing, so
    // encoded traversal can never surface a `..` segment in the parsed path.
    expect(parseChatPaneTargetLink('grotto://workspace/%2e%2e/secret.md')).toEqual({
        kind: 'workspaceFile',
        path: 'secret.md',
    });
});

const reportFile = { kind: 'workspaceFile', path: 'workbench/report.md' } as const;
const notesFile = { kind: 'workspaceFile', path: 'NOTES.md' } as const;
const workspaceRoot = { kind: 'workspaceRoot', path: '' } as const;

test('mergeChatPaneOpenTarget appends a workspace tab when none exists', () => {
    expect(mergeChatPaneOpenTarget([], reportFile)).toEqual({
        activeKey: 'workspaceFile:workbench/report.md',
        targets: [reportFile],
    });
});

test('mergeChatPaneOpenTarget focuses an existing target without duplicating it', () => {
    expect(mergeChatPaneOpenTarget([reportFile], reportFile)).toEqual({
        activeKey: 'workspaceFile:workbench/report.md',
        targets: [reportFile],
    });
});

test('mergeChatPaneOpenTarget replaces the one workspace tab on a new file open', () => {
    expect(mergeChatPaneOpenTarget([reportFile], notesFile)).toEqual({
        activeKey: 'workspaceFile:NOTES.md',
        targets: [notesFile],
    });
});

test('mergeChatPaneOpenTarget keeps the open file on a directory or root open', () => {
    expect(mergeChatPaneOpenTarget([reportFile], workspaceRoot)).toEqual({
        activeKey: 'workspaceFile:workbench/report.md',
        targets: [reportFile],
    });
});

test('formatChatPaneTargetLink formats clickable artifact links', () => {
    const href = formatChatPaneTargetLink({
        kind: 'workspaceFile',
        path: 'Demos/Artifact Panel Brief.md',
    });

    expect(href).toBe('grotto://workspace/Demos/Artifact%20Panel%20Brief.md');
    expect(parseChatPaneTargetLink(href)).toEqual({
        kind: 'workspaceFile',
        path: 'Demos/Artifact Panel Brief.md',
    });
});
