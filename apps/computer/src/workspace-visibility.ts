import path from 'node:path';

// Ported from Tavern Runtime's workspace visibility boundary. Computer now
// owns these reads, so the same exclusions travel with the files.
const skippedDirectoryNames = new Set([
    '.git',
    '.hg',
    '.svn',
    '.turbo',
    '.venv',
    '.vite',
    '__pycache__',
    'build',
    'coverage',
    'dist',
    'node_modules',
    'target',
    'venv',
]);

const skippedDirectoryPatterns = [/^(?:claude-code|codex)-ags_/u];
const sensitiveFileNames = new Set([
    '.env',
    '.netrc',
    '.npmrc',
    'auth.json',
    'credentials',
    'credentials.json',
    'token.json',
]);
const sensitiveDirectoryNames = new Set(['.gnupg', '.ssh']);

export function isHiddenWorkspaceName(name: string) {
    return name.startsWith('.') && name !== '.github';
}

export function isSkippedWorkspaceDirectory(name: string) {
    return (
        skippedDirectoryNames.has(name) ||
        skippedDirectoryPatterns.some((pattern) => pattern.test(name))
    );
}

export function isSensitiveWorkspacePath(relativePath: string) {
    const normalized = relativePath.toLowerCase();
    const segments = normalized.split('/').filter(Boolean);
    const basename = path.posix.basename(normalized);
    const extension = path.posix.extname(basename);
    if (
        sensitiveFileNames.has(basename) ||
        segments.some((segment) => sensitiveDirectoryNames.has(segment))
    ) {
        return true;
    }
    if (basename.startsWith('.env.') && !/\.(example|sample|template)$/u.test(basename)) {
        return true;
    }
    return extension === '.pem' || extension === '.p12' || extension === '.pfx';
}

export function looksBinary(data: Buffer) {
    if (data.length === 0) {
        return false;
    }
    if (data.includes(0)) {
        return true;
    }
    let suspicious = 0;
    for (const byte of data) {
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
            suspicious += 1;
        }
    }
    return suspicious / data.length > 0.12;
}
