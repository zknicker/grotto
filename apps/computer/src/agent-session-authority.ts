import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const authorityFileName = 'session-authority.json';

export async function readAppliedSessionGeneration(agentRoot: string): Promise<number | null> {
    try {
        const value = JSON.parse(
            await readFile(join(agentRoot, authorityFileName), 'utf8')
        ) as unknown;
        return isRecord(value) &&
            Number.isInteger(value.generation) &&
            (value.generation as number) > 0
            ? (value.generation as number)
            : null;
    } catch {
        return null;
    }
}

export async function applyAuthoritativeSession(input: {
    agentRoot: string;
    generation: number;
    reset: () => Promise<void>;
}): Promise<'applied' | 'current' | 'stale'> {
    const current = await readAppliedSessionGeneration(input.agentRoot);
    if (current !== null && input.generation < current) {
        return 'stale';
    }
    if (current === input.generation) {
        return 'current';
    }
    // Generation one is a newborn Agent, not a reset. Every later generation
    // must apply the Server's reset intent before the marker advances.
    if (input.generation > 1) {
        await input.reset();
    }
    await mkdir(input.agentRoot, { mode: 0o700, recursive: true });
    const destination = join(input.agentRoot, authorityFileName);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ generation: input.generation })}\n`, {
        mode: 0o600,
    });
    await rename(temporary, destination);
    return 'applied';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
