import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    AgentRuntimeWorkspaceFileContent,
    AgentRuntimeWorkspaceFileEntry,
    AgentRuntimeWorkspaceFileList,
} from '@tavern/api';
import type { Database } from '../db/sqlite.ts';
import {
    isVisibleWorkspaceEntry,
    normalizeWorkspacePath,
    rejectSensitiveWorkspacePath,
    rejectUnbrowseableWorkspacePath,
    resolveWorkspaceChild,
} from './file-paths.ts';
import { getAgentWorkspaceSource } from './instructions.ts';
import { looksBinary } from './visibility.ts';

const imageExtensions = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const dataUrlReadMaxBytes = 16 * 1024 * 1024;
const textSourceMaxBytes = 64 * 1024 * 1024;
const textPreviewMaxBytes = 512 * 1024;
// HTML previews render whole documents in sandboxed iframes (the artifact
// pane), so they get a larger complete-read window.
const htmlPreviewMaxBytes = 5 * 1024 * 1024;

const languageByExtension: Record<string, string> = {
    '.c': 'c',
    '.conf': 'ini',
    '.cpp': 'cpp',
    '.css': 'css',
    '.csv': 'csv',
    '.go': 'go',
    '.graphql': 'graphql',
    '.h': 'c',
    '.hpp': 'cpp',
    '.html': 'html',
    '.java': 'java',
    '.js': 'javascript',
    '.json': 'json',
    '.jsx': 'jsx',
    '.log': 'text',
    '.lua': 'lua',
    '.md': 'markdown',
    '.mjs': 'javascript',
    '.py': 'python',
    '.rb': 'ruby',
    '.rs': 'rust',
    '.sh': 'shell',
    '.sql': 'sql',
    '.svg': 'xml',
    '.toml': 'toml',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.txt': 'text',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.zsh': 'shell',
};

const mediaTypeByExtension: Record<string, string> = {
    '.bmp': 'image/bmp',
    '.css': 'text/css',
    '.csv': 'text/csv',
    '.gif': 'image/gif',
    '.htm': 'text/html',
    '.html': 'text/html',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.mjs': 'text/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
    '.xml': 'application/xml',
};

export async function listWorkspaceFiles(
    db: Database,
    input: { agentId: string; includeHidden?: boolean; path?: string | null }
): Promise<AgentRuntimeWorkspaceFileList> {
    const root = await resolveWorkspaceRoot(db, input.agentId);
    const relativePath = normalizeWorkspacePath(input.path ?? '', { allowEmpty: true });
    const includeHidden = input.includeHidden ?? false;
    rejectUnbrowseableWorkspacePath(relativePath, { includeHidden });
    const directory = await resolveWorkspaceChild(root, relativePath);
    const stat = await fs.stat(directory).catch(() => null);
    if (!stat?.isDirectory()) {
        throw new Error('Workspace directory does not exist.');
    }

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const visibleEntries = await Promise.all(
        entries
            .filter((entry) => isVisibleWorkspaceEntry(entry, includeHidden))
            .map((entry) => toWorkspaceEntry(root, relativePath, entry))
    );

    return {
        entries: visibleEntries
            .filter((entry): entry is AgentRuntimeWorkspaceFileEntry => Boolean(entry))
            .sort(compareWorkspaceEntries),
        path: relativePath,
        workspaceRoot: root,
    };
}

// Existence probe with the same confinement rules as listing/reading; used to
// validate pane targets before they are persisted.
export async function workspacePathExists(
    db: Database,
    input: { agentId: string; kind: 'directory' | 'file'; path: string }
): Promise<boolean> {
    try {
        const root = await resolveWorkspaceRoot(db, input.agentId);
        const relativePath = normalizeWorkspacePath(input.path, {
            allowEmpty: input.kind === 'directory',
        });
        rejectUnbrowseableWorkspacePath(relativePath, { includeHidden: false });
        if (input.kind === 'file') {
            rejectSensitiveWorkspacePath(relativePath);
        }
        const absolutePath = await resolveWorkspaceChild(root, relativePath);
        const stat = await fs.stat(absolutePath).catch(() => null);
        return input.kind === 'file' ? Boolean(stat?.isFile()) : Boolean(stat?.isDirectory());
    } catch {
        return false;
    }
}

export async function readWorkspaceFile(
    db: Database,
    input: { agentId: string; includeHidden?: boolean; path: string }
): Promise<AgentRuntimeWorkspaceFileContent> {
    const root = await resolveWorkspaceRoot(db, input.agentId);
    const relativePath = normalizeWorkspacePath(input.path, { allowEmpty: false });
    rejectSensitiveWorkspacePath(relativePath);
    rejectUnbrowseableWorkspacePath(relativePath, { includeHidden: input.includeHidden ?? false });
    const absolutePath = await resolveWorkspaceChild(root, relativePath);

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
        throw new Error('Workspace file does not exist.');
    }

    const extension = path.extname(relativePath).toLowerCase();
    const mediaType = mediaTypeForPath(relativePath);
    const updatedAt = stat.mtime.toISOString();

    if (imageExtensions.has(extension)) {
        if (stat.size > dataUrlReadMaxBytes) {
            throw new Error('Workspace image is too large to preview.');
        }
        return {
            binary: true,
            content: (await fs.readFile(absolutePath)).toString('base64'),
            encoding: 'base64',
            language: null,
            mediaType,
            path: relativePath,
            sizeBytes: stat.size,
            truncated: false,
            updatedAt,
            workspaceRoot: root,
        };
    }

    if (stat.size > textSourceMaxBytes) {
        throw new Error('Workspace file is too large to preview.');
    }

    const previewMaxBytes = mediaType === 'text/html' ? htmlPreviewMaxBytes : textPreviewMaxBytes;
    const handle = await fs.open(absolutePath, 'r');
    try {
        const bytesToRead = Math.min(stat.size, previewMaxBytes);
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
        const data = buffer.subarray(0, bytesRead);
        return {
            binary: looksBinary(data.subarray(0, Math.min(data.length, 4096))),
            content: data.toString('utf8'),
            encoding: 'utf8',
            language: languageByExtension[extension] ?? 'text',
            mediaType,
            path: relativePath,
            sizeBytes: stat.size,
            truncated: stat.size > previewMaxBytes,
            updatedAt,
            workspaceRoot: root,
        };
    } finally {
        await handle.close();
    }
}

async function resolveWorkspaceRoot(db: Database, agentId: string) {
    const source = getAgentWorkspaceSource(db, agentId);
    if (!source) {
        throw new Error(`No managed workspace is registered for agent "${agentId}".`);
    }
    return await fs.realpath(source.workspaceDir);
}

async function toWorkspaceEntry(
    root: string,
    parentPath: string,
    entry: Dirent
): Promise<AgentRuntimeWorkspaceFileEntry | null> {
    if (entry.isSymbolicLink()) {
        return null;
    }
    const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const absolutePath = await resolveWorkspaceChild(root, relativePath).catch(() => null);
    if (!absolutePath) {
        return null;
    }
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!(stat && (stat.isDirectory() || stat.isFile()))) {
        return null;
    }
    return {
        kind: stat.isDirectory() ? 'directory' : 'file',
        mediaType: stat.isFile() ? mediaTypeForPath(relativePath) : null,
        name: entry.name,
        path: relativePath,
        sizeBytes: stat.isFile() ? stat.size : null,
        updatedAt: stat.mtime.toISOString(),
    };
}

function compareWorkspaceEntries(
    left: AgentRuntimeWorkspaceFileEntry,
    right: AgentRuntimeWorkspaceFileEntry
) {
    if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
}

function mediaTypeForPath(filePath: string) {
    return mediaTypeByExtension[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}
