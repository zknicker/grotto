import { randomBytes } from 'node:crypto';
import type { Trigger, TriggerFireErrorCode, TriggerKind, TriggerStatus } from '@grotto/api';
import { triggerSecretPrefix } from '@grotto/api';
import { hashComputerSecret } from '../computers/service.ts';
import type { triggersTable } from '../postgres/schema.ts';
import { triggerUrl } from './trigger-url.ts';

export interface TriggerClock {
    now(): Date;
}

/** The trigger does not exist, or does not belong to the calling Agent. */
export class TriggerNotFoundError extends Error {
    constructor(message = 'That trigger is not owned by this Agent.') {
        super(message);
        this.name = 'TriggerNotFoundError';
    }
}

/**
 * The trigger exists but cannot take this request right now: it is disabled,
 * its owner or anchor is gone, or it is over its rate limit. The code is the
 * same vocabulary the public route answers with.
 */
export class TriggerRefusedError extends Error {
    constructor(
        readonly code: TriggerFireErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'TriggerRefusedError';
    }
}

/** The caller may not operate triggers in this Server. */
export class TriggerAccessDeniedError extends Error {
    constructor() {
        super('A Server Owner or Admin is required to operate triggers.');
        this.name = 'TriggerAccessDeniedError';
    }
}

/**
 * Mints one bearer secret. The plaintext is returned to the creating Agent
 * exactly once; only the hash is ever stored.
 */
export function mintTriggerSecret(): string {
    return `${triggerSecretPrefix}${randomBytes(32).toString('base64url')}`;
}

export function hashTriggerSecret(secret: string): string {
    return hashComputerSecret(secret);
}

export function readBearerSecret(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;
    if (typeof value !== 'string' || !value.startsWith('Bearer ')) {
        return null;
    }
    const secret = value.slice(7).trim();
    return secret.startsWith(triggerSecretPrefix) && secret.length > triggerSecretPrefix.length
        ? secret
        : null;
}

/**
 * The wire view of one stored trigger. `url` is derived per request rather than
 * stored, so every reader passes the origin the caller actually reached.
 */
export function toTrigger(
    trigger: typeof triggersTable.$inferSelect,
    context: { createdByHandle: string | null; origin: string; ownerHandle: string }
): Trigger {
    return {
        anchorChatId: trigger.anchorChatId,
        anchorMessageId: trigger.anchorMessageId,
        createdAt: trigger.createdAt.toISOString(),
        createdByHandle: trigger.createdByUserId ? context.createdByHandle : null,
        createdByUserId: trigger.createdByUserId,
        disabledAt: trigger.disabledAt?.toISOString() ?? null,
        fireCount: trigger.fireCount,
        id: trigger.id,
        instruction: trigger.instruction,
        kind: trigger.kind as TriggerKind,
        lastFiredAt: trigger.lastFiredAt?.toISOString() ?? null,
        ownerAgentId: trigger.ownerAgentId,
        ownerHandle: context.ownerHandle,
        status: trigger.status as TriggerStatus,
        title: trigger.title,
        updatedAt: trigger.updatedAt.toISOString(),
        url: triggerUrl(context.origin, trigger.id),
        version: trigger.version,
    };
}
