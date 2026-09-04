import { triggerDedupeKeyMaxLength, triggerPayloadMaxBytes } from '@grotto/api';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { authenticateTrigger, findTriggerFireByDedupeKey, fireTrigger } from './trigger-fire.ts';
import { readBearerSecret, type TriggerClock } from './trigger-model.ts';
import { TriggerRateLimiter } from './trigger-rate-limit.ts';

/** PostgreSQL text cannot hold a NUL, so a body carrying one is not storable text. */
const NUL = String.fromCharCode(0);
/** Refuse well past the stored ceiling so the handler owns the 413, not Fastify. */
const routeBodyLimit = triggerPayloadMaxBytes * 4;

export interface TriggerRouteOptions {
    clock?: TriggerClock;
    db: GrottoDatabase;
    delivery: AgentDelivery;
    limiter?: TriggerRateLimiter;
}

/**
 * The public inbound edge. No Clerk, no session, no Computer: an outside system
 * proves one trigger's bearer secret and the Server records the delivery. The
 * body is captured raw for every content type — it is stored and relayed
 * verbatim, and the Server never parses it for meaning.
 */
export function registerTriggerRoutes(app: FastifyInstance, options: TriggerRouteOptions) {
    const clock = options.clock ?? { now: () => new Date() };
    const limiter = options.limiter ?? new TriggerRateLimiter();

    return app.register(async (scope) => {
        scope.removeAllContentTypeParsers();
        scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
            done(null, body);
        });
        scope.post<{ Params: { triggerId: string } }>(
            '/api/triggers/:triggerId',
            { bodyLimit: routeBodyLimit },
            async (request, reply) => {
                const secret = readBearerSecret(request.headers.authorization);
                if (!secret) {
                    return refuse(reply, 401, 'unauthorized');
                }
                const body = readPayload(request);
                if (body.refusal) {
                    return refuse(reply, body.status, body.refusal);
                }
                const dedupeKey = readDedupeKey(request);
                if (dedupeKey === 'invalid') {
                    return refuse(reply, 400, 'invalid_idempotency_key');
                }

                const trigger = await authenticateTrigger(options.db, {
                    secret,
                    triggerId: request.params.triggerId,
                });
                if (!trigger) {
                    return refuse(reply, 401, 'unauthorized');
                }
                // A replay of a delivery already recorded is answered from
                // history: it is not new traffic, so it spends no budget.
                const replayed = await findTriggerFireByDedupeKey(options.db, {
                    dedupeKey,
                    serverId: trigger.serverId,
                    triggerId: trigger.id,
                });
                if (replayed) {
                    return reply.code(200).send({
                        duplicate: true,
                        fireId: replayed,
                        triggerId: trigger.id,
                        type: 'trigger_fire',
                    });
                }
                // Every other authenticated request is metered, disabled
                // triggers included, so a caller cannot hammer one for free.
                const limited = limiter.admit(trigger.id, clock.now().getTime());
                if (limited) {
                    return reply
                        .code(429)
                        .header('retry-after', String(limited.retryAfterSeconds))
                        .send({ code: 'rate_limited' });
                }
                if (trigger.status === 'disabled') {
                    return refuse(reply, 409, 'trigger_disabled');
                }

                const outcome = await fireTrigger(
                    options.db,
                    options.delivery,
                    {
                        contentType: readContentType(request),
                        dedupeKey,
                        payload: body.payload,
                        trigger,
                    },
                    clock
                );
                if (outcome.status === 'refused') {
                    return refuse(reply, outcome.code === 'unauthorized' ? 401 : 409, outcome.code);
                }
                return reply.code(outcome.status === 'duplicate' ? 200 : 202).send({
                    ...(outcome.status === 'duplicate' ? { duplicate: true } : {}),
                    fireId: outcome.fireId,
                    triggerId: outcome.triggerId,
                    type: 'trigger_fire',
                });
            }
        );
        // Only Fastify's own body-reading failures get a trigger refusal: a
        // body it could not read is a body we cannot store. Anything else is a
        // Server fault and belongs to the default handler, which logs it and
        // answers 500 without leaking the cause.
        scope.setErrorHandler((error, request, reply) => {
            const refusal = bodyRefusal(error);
            if (!refusal) {
                return reply.send(error);
            }
            request.log.info({ err: error }, 'trigger delivery body refused');
            return refuse(reply, refusal.status, refusal.code);
        });
    });
}

function refuse(reply: FastifyReply, status: number, code: string) {
    return reply.code(status).send({ code });
}

/**
 * Maps one Fastify body-reading failure to its trigger refusal, or null when
 * the failure has nothing to do with the request body.
 */
export function bodyRefusal(
    error: unknown
):
    | { code: 'payload_too_large'; status: 413 }
    | { code: 'unsupported_media_type'; status: 415 }
    | null {
    const { code, statusCode } = (error ?? {}) as { code?: string; statusCode?: number };
    if (statusCode === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        return { code: 'payload_too_large', status: 413 };
    }
    // Every other content-type-parser failure is a body Fastify could not read.
    return code?.startsWith('FST_ERR_CTP_')
        ? { code: 'unsupported_media_type', status: 415 }
        : null;
}

/**
 * Reads the raw body as UTF-8 text. Binary bodies — anything that is not valid
 * UTF-8, NUL included, since PostgreSQL text cannot hold it — are refused rather
 * than mangled.
 */
function readPayload(
    request: FastifyRequest
):
    | { payload: string; refusal: null; status: 200 }
    | { payload: ''; refusal: 'payload_too_large'; status: 413 }
    | { payload: ''; refusal: 'unsupported_media_type'; status: 415 } {
    const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (raw.byteLength > triggerPayloadMaxBytes) {
        return { payload: '', refusal: 'payload_too_large', status: 413 };
    }
    try {
        const payload = new TextDecoder('utf-8', { fatal: true }).decode(raw);
        return payload.includes(NUL)
            ? { payload: '', refusal: 'unsupported_media_type', status: 415 }
            : { payload, refusal: null, status: 200 };
    } catch {
        return { payload: '', refusal: 'unsupported_media_type', status: 415 };
    }
}

function readDedupeKey(request: FastifyRequest): string | null | 'invalid' {
    const header = request.headers['idempotency-key'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    if (!value) {
        return null;
    }
    return value.length > triggerDedupeKeyMaxLength ? 'invalid' : value;
}

function readContentType(request: FastifyRequest): string | null {
    const header = request.headers['content-type'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    return value && value.length > 0 ? value : null;
}
