import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import {
    type OperatorTriggerInput,
    readOperatorHandle,
    requireTriggerOperator,
} from './operator-triggers.ts';
import { fireTrigger } from './trigger-fire.ts';
import { type TriggerClock, TriggerNotFoundError, TriggerRefusedError } from './trigger-model.ts';
import { readTrigger } from './trigger-queries.ts';
import type { TriggerRateLimiter } from './trigger-rate-limit.ts';

export interface TriggerTestDependencies {
    delivery: AgentDelivery;
    limiter: TriggerRateLimiter;
}

/**
 * Fires one trigger from the App. It rides the same path a real delivery takes
 * — the same rate limiter, the same transaction, the same envelope — so what an
 * operator sees is what an outside system would produce. It deliberately skips
 * the bearer secret: an operator who can rotate that secret can already fire the
 * trigger, so demanding it would only make them mint one first.
 */
export async function testOperatorTrigger(
    db: GrottoDatabase,
    dependencies: TriggerTestDependencies,
    member: GrottoUser | null,
    input: OperatorTriggerInput,
    clock: TriggerClock
): Promise<{ fireId: string }> {
    const operator = await requireTriggerOperator(db, member, input.serverId);
    const trigger = await readTrigger(db, input);
    if (trigger.status === 'disabled') {
        throw new TriggerRefusedError(
            'trigger_disabled',
            'This Trigger is disabled. Arm it before sending a test fire.'
        );
    }
    const limited = dependencies.limiter.admit(trigger.id, clock.now().getTime());
    if (limited) {
        throw new TriggerRefusedError(
            'rate_limited',
            `This Trigger is over its rate limit. Try again in ${limited.retryAfterSeconds}s.`
        );
    }

    const handle = await readOperatorHandle(db, {
        serverId: input.serverId,
        userId: operator.id,
    });
    const outcome = await fireTrigger(
        db,
        dependencies.delivery,
        {
            contentType: 'application/json',
            dedupeKey: null,
            payload: JSON.stringify({
                test: true,
                sentBy: handle ?? operator.id,
                sentAt: clock.now().toISOString(),
            }),
            trigger: {
                id: trigger.id,
                serverId: input.serverId,
                status: 'armed',
            },
        },
        clock
    );
    if (outcome.status === 'refused') {
        if (outcome.code === 'unauthorized') {
            throw new TriggerNotFoundError('That trigger does not exist in this Server.');
        }
        throw new TriggerRefusedError(
            outcome.code,
            outcome.code === 'trigger_disabled'
                ? 'This Trigger is disabled. Arm it before sending a test fire.'
                : 'This Trigger can no longer reach its Agent or its anchored Chat, so it was disabled.'
        );
    }
    return { fireId: outcome.fireId };
}
