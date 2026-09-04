import type { TriggerFireErrorCode } from '@grotto/api';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import { requireChatWritable } from '../chats/chat-access.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { triggerFiresTable, triggersTable } from '../postgres/schema.ts';
import { requireActiveAgent, requireAgentAnchor } from '../reminders/reminder-model.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { triggerEnvelope } from './trigger-envelope.ts';
import { hashTriggerSecret, type TriggerClock } from './trigger-model.ts';

/** One trigger the caller has already proven the bearer secret for. */
export interface AuthenticatedTrigger {
    id: string;
    serverId: string;
    status: 'armed' | 'disabled';
}

export interface TriggerFireRequest {
    contentType: string | null;
    /** The caller's `Idempotency-Key`, or null when it sent none. */
    dedupeKey: string | null;
    payload: string;
    trigger: AuthenticatedTrigger;
}

export type TriggerFireOutcome =
    | { fireId: string; status: 'accepted'; triggerId: string }
    | { fireId: string; status: 'duplicate'; triggerId: string }
    | { code: TriggerFireErrorCode; status: 'refused' };

interface TriggerFireCommit {
    dispatch?: { agentId: string; serverId: string };
    outcome: TriggerFireOutcome;
}

/**
 * Resolves a bearer secret to its trigger. An unknown id and a wrong secret are
 * indistinguishable to the caller, so this returns null for both.
 */
export async function authenticateTrigger(
    db: Pick<GrottoDatabase, 'select'>,
    input: { secret: string; triggerId: string }
): Promise<AuthenticatedTrigger | null> {
    const [trigger] = await db
        .select({
            id: triggersTable.id,
            serverId: triggersTable.serverId,
            status: triggersTable.status,
        })
        .from(triggersTable)
        .where(
            and(
                eq(triggersTable.id, input.triggerId),
                eq(triggersTable.secretHash, hashTriggerSecret(input.secret))
            )
        )
        .limit(1);
    return trigger ?? null;
}

/**
 * Commits one accepted delivery atomically: the fire row, the Agent's pending
 * work, and the trigger counters. A fire writes nothing to the transcript; the
 * Agent's own reply, sent with `--cause`, is the chat-visible trace, and a fire
 * the Agent has nothing to say about stays visible only in Automations history.
 * The caller has already authenticated the trigger, so the only read here is
 * the locked one that pins the row for the transaction. Dispatch to the
 * Computer happens after the commit, so an offline Computer only delays the
 * wake — the ledger already holds it.
 */
export async function fireTrigger(
    db: GrottoDatabase,
    delivery: AgentDelivery,
    request: TriggerFireRequest,
    clock: TriggerClock
): Promise<TriggerFireOutcome> {
    const now = clock.now();
    const fireId = createOpaqueId('trf');
    const committed = await db.transaction(async (tx): Promise<TriggerFireCommit> => {
        await lockServerRow(tx, request.trigger.serverId);
        const [locked] = await tx
            .select()
            .from(triggersTable)
            .where(
                and(
                    eq(triggersTable.serverId, request.trigger.serverId),
                    eq(triggersTable.id, request.trigger.id)
                )
            )
            .for('update');
        if (!locked) {
            // The trigger was deleted between authentication and the lock. An
            // unknown trigger and a wrong secret are the same answer: the route
            // must never confirm that a trigger exists.
            return { outcome: { code: 'unauthorized', status: 'refused' } as const };
        }
        if (locked.status === 'disabled') {
            return { outcome: { code: 'trigger_disabled', status: 'refused' } as const };
        }
        // The route already answered a replay it could see; this catches the
        // two concurrent deliveries that carry the same key.
        const duplicate = await findTriggerFireByDedupeKey(tx, {
            dedupeKey: request.dedupeKey,
            serverId: locked.serverId,
            triggerId: locked.id,
        });
        if (duplicate) {
            return {
                outcome: {
                    fireId: duplicate,
                    status: 'duplicate',
                    triggerId: locked.id,
                } as const,
            };
        }
        if (!(await anchorIsLive(tx, locked))) {
            await disableTrigger(tx, locked, now);
            return { outcome: { code: 'trigger_unavailable', status: 'refused' } as const };
        }

        const payloadBytes = Buffer.byteLength(request.payload);
        await tx.insert(triggerFiresTable).values({
            contentType: request.contentType,
            dedupeKey: request.dedupeKey,
            id: fireId,
            payload: request.payload,
            payloadBytes,
            receivedAt: now,
            serverId: locked.serverId,
            triggerId: locked.id,
        });
        await delivery.enqueue(tx, {
            agentId: locked.ownerAgentId,
            chatId: locked.anchorChatId,
            content: triggerEnvelope({
                contentType: request.contentType,
                fireId,
                instruction: locked.instruction,
                payload: request.payload,
                payloadBytes,
                title: locked.title,
                triggerId: locked.id,
            }),
            createdAt: now,
            dedupeKey: fireId,
            serverId: locked.serverId,
            source: 'trigger',
        });
        await tx
            .update(triggersTable)
            .set({
                fireCount: sql`${triggersTable.fireCount} + 1`,
                lastFiredAt: now,
                updatedAt: now,
                version: locked.version + 1,
            })
            .where(
                and(eq(triggersTable.serverId, locked.serverId), eq(triggersTable.id, locked.id))
            );
        return {
            dispatch: { agentId: locked.ownerAgentId, serverId: locked.serverId },
            outcome: { fireId, status: 'accepted', triggerId: locked.id } as const,
        };
    });

    if (committed.dispatch) {
        await delivery.dispatchAgent(committed.dispatch.agentId, committed.dispatch.serverId);
    }
    return committed.outcome;
}

/**
 * The fire an `Idempotency-Key` already recorded for this trigger, if any. The
 * route asks before spending rate-limit budget: replaying a delivery Grotto has
 * already accepted is not new traffic.
 */
export async function findTriggerFireByDedupeKey(
    db: Pick<GrottoDatabase, 'select'>,
    input: { dedupeKey: string | null; serverId: string; triggerId: string }
): Promise<string | null> {
    if (input.dedupeKey === null) {
        return null;
    }
    const [existing] = await db
        .select({ id: triggerFiresTable.id })
        .from(triggerFiresTable)
        .where(
            and(
                eq(triggerFiresTable.serverId, input.serverId),
                eq(triggerFiresTable.triggerId, input.triggerId),
                isNotNull(triggerFiresTable.dedupeKey),
                eq(triggerFiresTable.dedupeKey, input.dedupeKey)
            )
        )
        .limit(1);
    return existing?.id ?? null;
}

/** The owning Agent is still active and can still write the anchored Chat. */
async function anchorIsLive(
    db: GrottoDatabase,
    trigger: typeof triggersTable.$inferSelect
): Promise<boolean> {
    try {
        await requireActiveAgent(db, trigger.serverId, trigger.ownerAgentId);
        await requireAgentAnchor(db, {
            agentId: trigger.ownerAgentId,
            anchorChatId: trigger.anchorChatId,
            anchorMessageId: trigger.anchorMessageId,
            serverId: trigger.serverId,
        });
        await requireChatWritable(db, {
            chatId: trigger.anchorChatId,
            serverId: trigger.serverId,
        });
        return true;
    } catch {
        return false;
    }
}

/** Lazy auto-disable: a trigger nobody can deliver stops accepting deliveries. */
async function disableTrigger(
    db: GrottoDatabase,
    trigger: typeof triggersTable.$inferSelect,
    now: Date
): Promise<void> {
    await db
        .update(triggersTable)
        .set({
            disabledAt: now,
            status: 'disabled',
            updatedAt: now,
            version: trigger.version + 1,
        })
        .where(and(eq(triggersTable.serverId, trigger.serverId), eq(triggersTable.id, trigger.id)));
}
