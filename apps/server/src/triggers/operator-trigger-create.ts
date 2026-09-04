import type { Trigger, TriggerKind } from '@grotto/api';
import { requireChatWritable } from '../chats/chat-access.ts';
import { ensureAgentDmRecord } from '../chats/ensure-agent-dm.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { requireActiveAgent } from '../reminders/reminder-model.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { requireTriggerOperator } from './operator-triggers.ts';
import type { TriggerClock } from './trigger-model.ts';
import { triggerCurlCommand } from './trigger-url.ts';
import { createTriggerRow } from './trigger-writes.ts';

export interface CreateOperatorTriggerInput {
    agentId: string;
    instruction?: string;
    kind: TriggerKind;
    origin: string;
    serverId: string;
    title: string;
}

/**
 * Creates one trigger on behalf of a Server Owner or Admin. A human has no
 * asking message to anchor to, so the trigger anchors on the DM between the
 * creator and the owning Agent and carries no anchor message at all: nothing is
 * written to the transcript. Every later fire lands in that DM, which is
 * exactly where the person who wired it will look.
 */
export async function createOperatorTrigger(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: CreateOperatorTriggerInput,
    clock: TriggerClock
): Promise<{ curl: string; secret: string; trigger: Trigger; url: string }> {
    const operator = await requireTriggerOperator(db, member, input.serverId);
    const created = await createTriggerRow(
        db,
        {
            createdByUserId: operator.id,
            instruction: input.instruction?.trim() || null,
            kind: input.kind,
            origin: input.origin,
            ownerAgentId: input.agentId,
            serverId: input.serverId,
            title: input.title,
        },
        async (tx) => {
            await requireTriggerOperator(tx, member, input.serverId);
            await requireActiveAgent(tx, input.serverId, input.agentId);
            const dm = await ensureAgentDmRecord(tx, {
                agentId: input.agentId,
                serverId: input.serverId,
                userId: operator.id,
            });
            await requireChatWritable(tx, { chatId: dm.id, serverId: input.serverId });
            return { chatId: dm.id, messageId: null };
        },
        clock
    );

    return {
        curl: triggerCurlCommand(created.trigger.url, created.secret),
        secret: created.secret,
        trigger: created.trigger,
        url: created.trigger.url,
    };
}
