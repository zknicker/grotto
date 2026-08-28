import { createHash } from 'node:crypto';
import type { HarnessV1, HarnessV1SandboxProvider } from '@ai-sdk/harness';
import { prepareSandboxForHarness } from '@ai-sdk/harness/agent';
import harnessPackage from '@ai-sdk/harness/package.json' with { type: 'json' };

const bootstrapFingerprintVersion = 1;

/**
 * Fingerprints the exact adapter-owned files and install commands that must be
 * present before a resumed bridge can receive current turn instructions.
 */
export async function fingerprintHarnessBootstrap(input: {
    abortSignal?: AbortSignal;
    frameworkVersion?: string;
    harness: HarnessV1;
}): Promise<string | null> {
    const recipe = await input.harness.getBootstrap?.({ abortSignal: input.abortSignal });
    if (!recipe) {
        return null;
    }
    const canonicalRecipe = {
        bootstrapDir: recipe.bootstrapDir,
        commands: recipe.commands,
        files: [...recipe.files].sort((left, right) => left.path.localeCompare(right.path)),
        frameworkVersion: input.frameworkVersion ?? harnessPackage.version,
        harnessId: recipe.harnessId,
        version: bootstrapFingerprintVersion,
    };
    return createHash('sha256').update(JSON.stringify(canonicalRecipe)).digest('hex');
}

/** Applies the current content-addressed bridge recipe before a stopped session resumes. */
export async function refreshHarnessBootstrap(input: {
    abortSignal?: AbortSignal;
    harness: HarnessV1;
    provider: HarnessV1SandboxProvider;
    sessionId: string;
    workDir: string;
}): Promise<void> {
    if (!input.provider.resumeSession) {
        throw new Error(
            `Sandbox provider ${JSON.stringify(input.provider.providerId)} cannot refresh a resumed harness.`
        );
    }
    const session = await input.provider.resumeSession({
        abortSignal: input.abortSignal,
        sessionId: input.sessionId,
    });
    try {
        await prepareSandboxForHarness({
            abortSignal: input.abortSignal,
            harnesses: [input.harness],
            sandboxConfig: { workDir: input.workDir },
            session: session.restricted(),
        });
    } finally {
        await session.stop();
    }
}
