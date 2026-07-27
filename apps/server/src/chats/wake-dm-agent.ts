import type { ComputerConnections } from '../computers/connections.ts';
import { readDmAgentId } from '../computers/connections.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';

/**
 * Best-effort wake for the Agent seated in a DM after a human message commits.
 * Hosted collaboration never depends on a Computer, so this only sends a typed
 * start down an already-connected attachment; an offline, unconfigured, or busy
 * Agent is a quiet no-op and the durable message still stands.
 */
export async function wakeDmAgent(
    connections: ComputerConnections,
    db: GrottoDatabase,
    input: { chatId: string; content: string; serverId: string }
): Promise<void> {
    const agentId = await readDmAgentId(db, input.serverId, input.chatId);
    if (!agentId) {
        return;
    }
    await connections.startAgentTurn(db, {
        agentId,
        chatId: input.chatId,
        prompt: composeAgentTurnPrompt(input.content),
    });
}

/**
 * A compact drain prompt. The full inbox drain shape (specs/inbox.md) is the
 * delivery workstream; here one human message becomes one envelope plus the
 * standing instruction that the CLI is the only reply channel.
 */
function composeAgentTurnPrompt(content: string): string {
    return [
        '--- New messages ---',
        `[target=dm type=human] ${content}`,
        '',
        'Reply to the human by running `grotto message send`.',
    ].join('\n');
}
