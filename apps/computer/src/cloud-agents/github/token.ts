/**
 * The GitHub credential a Computer already has. Grotto mints, delivers, and
 * stores nothing: it asks the locally installed `gh` CLI for the token the
 * human already signed in with, exactly once per process, and holds it only in
 * memory. The value is never logged, written to disk, or reported to Server —
 * it is handled like the Cursor API key. A Computer without `gh`, or one whose
 * `gh` is signed out, resolves nothing and reads public pull requests
 * unauthenticated.
 */

const tokenTimeoutMs = 5000;

let resolved: Promise<string | null> | null = null;

/** One `gh auth token` per process, cached including the negative answer. */
export function githubToken(
    read: () => Promise<string | null> = readGhAuthToken
): Promise<string | null> {
    resolved ??= read().catch(() => null);
    return resolved;
}

/** Only tests reach this; a process resolves its token once and keeps it. */
export function resetGithubToken(): void {
    resolved = null;
}

async function readGhAuthToken(): Promise<string | null> {
    try {
        const child = Bun.spawn(['gh', 'auth', 'token'], {
            stderr: 'ignore',
            stdin: 'ignore',
            stdout: 'pipe',
        });
        const timer = setTimeout(() => child.kill(), tokenTimeoutMs);
        try {
            const [exitCode, output] = await Promise.all([
                child.exited,
                new Response(child.stdout).text(),
            ]);
            const token = output.trim();
            return exitCode === 0 && token ? token : null;
        } finally {
            clearTimeout(timer);
        }
    } catch {
        // No `gh` on this Computer. Public pull requests still read.
        return null;
    }
}
