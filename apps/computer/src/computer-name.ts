import { hostname, platform } from 'node:os';

const maximumComputerNameLength = 100;

/** Reads the human-facing macOS Computer Name, with hostname as the platform fallback. */
export async function readComputerName() {
    if (platform() === 'darwin') {
        try {
            const child = Bun.spawn(['scutil', '--get', 'ComputerName'], {
                stderr: 'ignore',
                stdout: 'pipe',
            });
            const [exitCode, output] = await Promise.all([
                child.exited,
                new Response(child.stdout).text(),
            ]);
            const name = normalizeComputerName(output);
            if (exitCode === 0 && name) {
                return name;
            }
        } catch {
            // Hostname remains available when macOS has no configured Computer Name.
        }
    }

    return normalizeComputerName(hostname()) ?? 'Computer';
}

export function normalizeComputerName(value: string) {
    const name = value.trim().replace(/\.local$/iu, '');
    return name ? name.slice(0, maximumComputerNameLength) : null;
}
