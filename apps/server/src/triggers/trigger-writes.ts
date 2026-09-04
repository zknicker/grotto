import type { ServerDurableEvent, Trigger, TriggerKind, TriggerStatus } from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { retireQueuedItemsByDedupeKeys } from '../agent-delivery/store.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { triggerFiresTable, triggersTable } from '../postgres/schema.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import {
    hashTriggerSecret,
    mintTriggerSecret,
    type TriggerClock,
    TriggerNotFoundError,
} from './trigger-model.ts';
import { readTrigger } from './trigger-queries.ts';

/**
 * The row-level trigger mutations, shared by the Agent path and the operator
 * path. Neither authorization model lives here: each caller passes the check it
 * owns, and this module owns the transaction, the server lock, the secret, the
 * version bump, and the wire view.
 */

type Transaction = GrottoDatabase;

/** Runs inside the transaction, behind the server lock. Throws to refuse. */
export type TriggerAuthorization = (tx: Transaction) => Promise<unknown>;

export interface TriggerAnchor {
    chatId: string;
    /** A durable event the anchor resolution wrote, to emit once the trigger commits. */
    event?: Extract<ServerDurableEvent, { type: 'message.created' }>;
    /** The asking message, or null when the anchor is the Chat itself. */
    messageId: string | null;
}

export interface CreateTriggerRowInput {
    /** The human who created it, or null when the owning Agent created it itself. */
    createdByUserId: string | null;
    instruction: string | null;
    kind: TriggerKind;
    origin: string;
    ownerAgentId: string;
    serverId: string;
    title: string;
}

/**
 * Creates one armed trigger and mints its bearer secret. `resolveAnchor` runs
 * inside the transaction: it authorizes the caller and answers where fires
 * land — the asking message for an Agent, the bare DM Chat for a human, which
 * writes nothing to the transcript. It is handed the trigger's id.
 */
export async function createTriggerRow(
    db: GrottoDatabase,
    input: CreateTriggerRowInput,
    resolveAnchor: (tx: Transaction, triggerId: string) => Promise<TriggerAnchor>,
    clock: TriggerClock
): Promise<{
    event: Extract<ServerDurableEvent, { type: 'message.created' }> | null;
    secret: string;
    trigger: Trigger;
}> {
    const now = clock.now();
    const secret = mintTriggerSecret();
    const triggerId = createOpaqueId('trg');
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        const anchor = await resolveAnchor(tx, triggerId);
        await tx.insert(triggersTable).values({
            anchorChatId: anchor.chatId,
            anchorMessageId: anchor.messageId,
            createdAt: now,
            createdByUserId: input.createdByUserId,
            id: triggerId,
            instruction: input.instruction,
            kind: input.kind,
            ownerAgentId: input.ownerAgentId,
            secretHash: hashTriggerSecret(secret),
            serverId: input.serverId,
            status: 'armed',
            title: input.title.trim(),
            updatedAt: now,
        });
        return {
            event: anchor.event ?? null,
            secret,
            trigger: await readTrigger(tx, {
                origin: input.origin,
                serverId: input.serverId,
                triggerId,
            }),
        };
    });
}

/**
 * Arms or disables one trigger. Setting the status it already has changes
 * nothing, so a kill switch pressed twice does not churn the version.
 */
export async function setTriggerStatusRow(
    db: GrottoDatabase,
    input: { origin: string; serverId: string; status: TriggerStatus; triggerId: string },
    authorize: TriggerAuthorization,
    clock: TriggerClock
): Promise<Trigger> {
    return await writeTrigger(
        db,
        input,
        authorize,
        (current, now) =>
            current.status === input.status
                ? null
                : {
                      disabledAt: input.status === 'disabled' ? now : null,
                      status: input.status,
                  },
        clock
    );
}

/** Edits the human-authored fields. `instruction: null` clears the instruction. */
export async function updateTriggerRow(
    db: GrottoDatabase,
    input: {
        instruction?: string | null;
        origin: string;
        serverId: string;
        title?: string;
        triggerId: string;
    },
    authorize: TriggerAuthorization,
    clock: TriggerClock
): Promise<Trigger> {
    return await writeTrigger(
        db,
        input,
        authorize,
        () => ({
            ...(input.title === undefined ? {} : { title: input.title.trim() }),
            ...(input.instruction === undefined
                ? {}
                : { instruction: input.instruction?.trim() || null }),
        }),
        clock
    );
}

/** Replaces the bearer secret. The previous secret stops working immediately. */
export async function rotateTriggerSecretRow(
    db: GrottoDatabase,
    input: { origin: string; serverId: string; triggerId: string },
    authorize: TriggerAuthorization,
    clock: TriggerClock
): Promise<{ secret: string; trigger: Trigger }> {
    const secret = mintTriggerSecret();
    const trigger = await writeTrigger(
        db,
        input,
        authorize,
        () => ({ secretHash: hashTriggerSecret(secret) }),
        clock
    );
    return { secret, trigger };
}

/**
 * Deletes one trigger and its fire history, and retires the owner's queued
 * fires with it: a fire envelope lives only in the delivery queue, so a fire
 * left queued for a deleted trigger would wake its Agent forever.
 */
export async function deleteTriggerRow(
    db: GrottoDatabase,
    input: { serverId: string; triggerId: string },
    authorize: TriggerAuthorization
): Promise<void> {
    await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await authorize(tx);
        const fires = await tx
            .select({ id: triggerFiresTable.id })
            .from(triggerFiresTable)
            .where(
                and(
                    eq(triggerFiresTable.serverId, input.serverId),
                    eq(triggerFiresTable.triggerId, input.triggerId)
                )
            );
        await retireQueuedItemsByDedupeKeys(tx, {
            dedupeKeys: fires.map((fire) => fire.id),
            serverId: input.serverId,
        });
        const deleted = await tx
            .delete(triggersTable)
            .where(
                and(
                    eq(triggersTable.serverId, input.serverId),
                    eq(triggersTable.id, input.triggerId)
                )
            )
            .returning({ id: triggersTable.id });
        if (deleted.length === 0) {
            throw new TriggerNotFoundError();
        }
    });
}

/**
 * One authorized edit of one trigger row. `patch` sees the current trigger and
 * answers the columns to write, or null when the request is already satisfied.
 * Every write here stamps `updated_at` and bumps `version`.
 */
async function writeTrigger(
    db: GrottoDatabase,
    input: { origin: string; serverId: string; triggerId: string },
    authorize: TriggerAuthorization,
    patch: (current: Trigger, now: Date) => Partial<typeof triggersTable.$inferInsert> | null,
    clock: TriggerClock
): Promise<Trigger> {
    const now = clock.now();
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, input.serverId);
        await authorize(tx);
        const current = await readTrigger(tx, input);
        const columns = patch(current, now);
        if (!columns) {
            return current;
        }
        await tx
            .update(triggersTable)
            .set({ ...columns, updatedAt: now, version: current.version + 1 })
            .where(
                and(
                    eq(triggersTable.serverId, input.serverId),
                    eq(triggersTable.id, input.triggerId)
                )
            );
        return await readTrigger(tx, input);
    });
}
