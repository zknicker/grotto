import type { CloudAgentProviderReadiness } from '@grotto/api';
import { type CloudAgentProvider, unavailableCloudAgentProvider } from './provider.ts';

let installed: CloudAgentProvider = unavailableCloudAgentProvider();

/** The Cloud Agent provider this Computer can reach. */
export function cloudAgentProvider(): CloudAgentProvider {
    return installed;
}

/** Installs a provider adapter; returns the restore for tests and teardown. */
export function setCloudAgentProvider(provider: CloudAgentProvider): () => void {
    const previous = installed;
    installed = provider;
    return () => {
        installed = previous;
    };
}

/**
 * The Cloud Agent capability line in the Computer inventory. It is reported
 * separately from the runtime harnesses even when a provider shares a vendor
 * with one, because the two use different credential stores.
 */
export async function detectCloudAgentProviders(): Promise<CloudAgentProviderReadiness[]> {
    const provider = cloudAgentProvider();
    const readiness = await provider
        .readiness()
        .catch(() => ({ ready: false as const, reason: 'provider-unavailable' as const }));
    return [
        {
            provider: provider.provider,
            ready: readiness.ready,
            reason: readiness.ready ? null : readiness.reason,
        },
    ];
}
