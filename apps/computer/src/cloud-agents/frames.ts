import type { CloudAgentCancelCommand, CloudAgentReconcileCommand } from '@haus/api';
import { cloudAgentCancelCommandSchema, cloudAgentReconcileCommandSchema } from '@haus/api';

/** Validates the Server→Computer cancel command. Fails closed to null. */
export function parseCloudAgentCancelCommand(frame: unknown): CloudAgentCancelCommand | null {
    const parsed = cloudAgentCancelCommandSchema.safeParse(frame);
    return parsed.success ? parsed.data : null;
}

/** Validates the reconnect reconciliation command. Fails closed to null. */
export function parseCloudAgentReconcileCommand(frame: unknown): CloudAgentReconcileCommand | null {
    const parsed = cloudAgentReconcileCommandSchema.safeParse(frame);
    return parsed.success ? parsed.data : null;
}
