import type { ComputerInventory } from '@tavern/api';
import { and, eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { computersTable } from '../postgres/schema.ts';
import { AgentConfigDeniedError } from './agent-config-errors.ts';

interface AssignedComputer {
    health: 'degraded' | 'healthy' | 'offline' | 'update-required';
    inventory: ComputerInventory | null;
}

/**
 * Resolves the Agent's own Computer within its own Server. A Computer id that
 * belongs to another Server — or to no attached Computer — fails closed, so
 * configuration can never reference another Server's compute.
 */
export async function resolveAssignedComputer(
    db: Pick<GrottoDatabase, 'select'>,
    input: { computerId: string; serverId: string }
): Promise<AssignedComputer> {
    const [computer] = await db
        .select({
            health: computersTable.health,
            inventory: computersTable.reportedInventory,
        })
        .from(computersTable)
        .where(
            and(
                eq(computersTable.serverId, input.serverId),
                eq(computersTable.id, input.computerId)
            )
        )
        .limit(1);

    if (!computer) {
        throw new AgentConfigDeniedError('That Computer is not attached to this Server.');
    }

    return { health: computer.health, inventory: computer.inventory ?? null };
}

/**
 * Validates a desired runtime/model pair against exactly one Computer's
 * last-reported inventory. A missing inventory, an unreported runtime, or an
 * unreported model is rejected; the Server never substitutes another resource.
 */
export function assertRuntimeModelReported(
    inventory: ComputerInventory | null,
    runtimeId: string,
    modelId: string
): void {
    if (!inventory) {
        throw new AgentConfigDeniedError(
            'This Computer has not reported its runtimes yet. Wait for it to connect.'
        );
    }

    const runtime = inventory.runtimes.find((candidate) => candidate.id === runtimeId);

    if (!runtime) {
        throw new AgentConfigDeniedError(
            `This Computer does not report the runtime "${runtimeId}".`
        );
    }

    if (!runtime.models.some((model) => model.id === modelId)) {
        throw new AgentConfigDeniedError(
            `The runtime "${runtimeId}" does not report the model "${modelId}" on this Computer.`
        );
    }
}
