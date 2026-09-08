import type { CloudAgentCapabilityRequest, CloudAgentCapabilityResult } from '@grotto/api';
import { cloudAgentCapabilityRequestSchema, cloudAgentCapabilityResultSchema } from '@grotto/api';
import {
    cloudAgentCapabilityState,
    cloudAgentProvider,
    readCloudAgentReadiness,
} from './registry.ts';

export function parseCloudAgentCapabilityRequest(
    value: unknown
): CloudAgentCapabilityRequest | null {
    const parsed = cloudAgentCapabilityRequestSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

/**
 * The Computer side of the Cloud Agent capability row in Computer settings.
 * `connect` runs the provider's own browser sign-in here, on the machine that
 * owns the credential store; nothing about the credential travels back. Only a
 * human action in settings reaches this path, never an Agent turn.
 */
export async function runCloudAgentCapabilityRequest(
    request: CloudAgentCapabilityRequest
): Promise<CloudAgentCapabilityResult> {
    const provider = cloudAgentProvider();
    try {
        if (provider.provider !== request.provider) {
            throw new Error(`This Computer has no ${request.provider} Cloud Agent provider.`);
        }
        const readiness = await resolve(request.operation.kind);
        return cloudAgentCapabilityResultSchema.parse({
            requestId: request.requestId,
            result: cloudAgentCapabilityState(provider, readiness),
            type: 'cloud-agent-capability-result',
        });
    } catch (error) {
        return cloudAgentCapabilityResultSchema.parse({
            error: safeCapabilityError(error),
            requestId: request.requestId,
            type: 'cloud-agent-capability-result',
        });
    }

    function resolve(kind: CloudAgentCapabilityRequest['operation']['kind']) {
        switch (kind) {
            case 'get':
                return readCloudAgentReadiness(provider);
            case 'connect':
                return provider.connect();
            case 'disconnect':
                return provider.disconnect();
        }
    }
}

/**
 * A provider error reaches settings as one bounded line. Provider errors can
 * quote request context, so the message is truncated rather than forwarded
 * whole, and nothing here ever touches the credential itself.
 */
function safeCapabilityError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'The Cloud Agent request failed.';
    return message.trim().slice(0, 500) || 'The Cloud Agent request failed.';
}
