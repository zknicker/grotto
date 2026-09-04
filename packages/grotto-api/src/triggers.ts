import * as z from 'zod';
import { idSchema } from './chat.ts';

const timestampSchema = z.iso.datetime({ offset: true });

/** Largest inbound trigger payload the Server stores verbatim. */
export const triggerPayloadMaxBytes = 65_536;
/** Largest payload excerpt the Agent envelope carries. */
export const triggerPayloadExcerptMaxChars = 8192;
/** Largest agent-authored standing instruction on one trigger. */
export const triggerInstructionMaxBytes = 4096;
export const triggerTitleMaxLength = 200;
export const triggerDedupeKeyMaxLength = 200;
/** Fire history page size: the default and the ceiling for `log --limit`. */
export const triggerLogLimitDefault = 50;
export const triggerLogLimitMax = 100;
/** Minted secret prefix. The rest is 32 random bytes, base64url. */
export const triggerSecretPrefix = 'grtt_';

/**
 * The instruction ceiling is UTF-8 bytes, matching the PostgreSQL
 * `octet_length` CHECK on `triggers.instruction`. Zod's `.max()` counts UTF-16
 * code units, so a multibyte instruction under that count would pass here and
 * fail at insert.
 */
const triggerInstructionSchema = z
    .string()
    .trim()
    .refine(
        (value) => new TextEncoder().encode(value).length <= triggerInstructionMaxBytes,
        `Instruction must be at most ${triggerInstructionMaxBytes} bytes.`
    );

export const triggerStatusSchema = z.enum(['armed', 'disabled']);
export type TriggerStatus = z.infer<typeof triggerStatusSchema>;

/**
 * What kind of outside stimulus wakes the Agent. Webhook is the only kind
 * today; a second kind is a new member here and a new row in the App's picker,
 * never a branch in the fire path.
 */
export const triggerKindSchema = z.enum(['webhook']);
export type TriggerKind = z.infer<typeof triggerKindSchema>;

/**
 * One agent-owned inbound webhook. Never carries the secret: it exists only in
 * the create and rotate responses, and only as a sha256 hash at rest.
 */
export const triggerSchema = z
    .object({
        anchorChatId: idSchema,
        /**
         * The asking message an Agent anchored on, or null when a human wired
         * the Trigger: a human Trigger anchors on the DM chat itself.
         */
        anchorMessageId: idSchema.nullable(),
        createdAt: timestampSchema,
        /** The creating human's Server handle, null when an Agent created it or the human has none. */
        createdByHandle: z.string().min(1).nullable(),
        /** The creating human, or null when the owning Agent created it itself. */
        createdByUserId: idSchema.nullable(),
        disabledAt: timestampSchema.nullable(),
        fireCount: z.number().int().nonnegative(),
        id: idSchema,
        instruction: z.string().min(1).nullable(),
        kind: triggerKindSchema,
        lastFiredAt: timestampSchema.nullable(),
        ownerAgentId: idSchema,
        ownerHandle: z.string().min(1),
        status: triggerStatusSchema,
        title: z.string().min(1).max(triggerTitleMaxLength),
        updatedAt: timestampSchema,
        /** The public address an outside system POSTs to. Never carries the secret. */
        url: z.string().min(1),
        version: z.number().int().positive(),
    })
    .strict();

export type Trigger = z.infer<typeof triggerSchema>;

/** One recorded inbound fire, without its stored payload. */
export const triggerFireSchema = z
    .object({
        contentType: z.string().nullable(),
        dedupeKey: z.string().nullable(),
        id: idSchema,
        payloadBytes: z.number().int().nonnegative(),
        /** The legacy chat receipt; fires stopped writing one. */
        receivedAt: timestampSchema,
        triggerId: idSchema,
    })
    .strict();

export type TriggerFire = z.infer<typeof triggerFireSchema>;

/** One fire with the verbatim payload the Server stored. */
export const triggerFireDetailSchema = triggerFireSchema.extend({ payload: z.string() }).strict();

export type TriggerFireDetail = z.infer<typeof triggerFireDetailSchema>;

export const triggerListInputSchema = z
    .object({
        agentId: idSchema.optional(),
        serverId: idSchema,
        status: triggerStatusSchema.optional(),
    })
    .strict();

export const triggerListSchema = z.array(triggerSchema);

/** Every per-trigger operator procedure addresses the row the same way. */
export const triggerIdInputSchema = z
    .object({
        serverId: idSchema,
        triggerId: idSchema,
    })
    .strict();

export const triggerRunsInputSchema = triggerIdInputSchema;

export const triggerRunsSchema = z.array(triggerFireSchema);

/** Rotate, delete, and test each address one existing trigger and nothing else. */
export const triggerRotateInputSchema = triggerIdInputSchema;
export const triggerDeleteInputSchema = triggerIdInputSchema;
export const triggerTestInputSchema = triggerIdInputSchema;

/**
 * Operator create. The trigger anchors on a creation receipt posted in the DM
 * between the creating human and the owning Agent, so fires land there.
 */
export const triggerCreateInputSchema = z
    .object({
        agentId: idSchema,
        instruction: triggerInstructionSchema.min(1).optional(),
        kind: triggerKindSchema,
        serverId: idSchema,
        title: z.string().trim().min(1).max(triggerTitleMaxLength),
    })
    .strict();

/**
 * Update at least one editable field. `instruction: null` (or an empty string)
 * clears the standing instruction; omitting it leaves it alone.
 */
export const triggerUpdateInputSchema = z
    .object({
        instruction: triggerInstructionSchema.nullable().optional(),
        serverId: idSchema,
        title: z.string().trim().min(1).max(triggerTitleMaxLength).optional(),
        triggerId: idSchema,
    })
    .strict()
    .refine(
        (input) => input.title !== undefined || input.instruction !== undefined,
        'Provide a title or an instruction to update.'
    );

export const triggerSetStatusInputSchema = z
    .object({
        serverId: idSchema,
        status: triggerStatusSchema,
        triggerId: idSchema,
    })
    .strict();

export const triggerResultSchema = z.object({ trigger: triggerSchema }).strict();

/** Operator create and rotate: the only tRPC responses that ever carry a secret. */
export const triggerSecretResultSchema = z
    .object({
        curl: z.string().min(1),
        secret: z.string().min(1),
        trigger: triggerSchema,
        url: z.string().min(1),
    })
    .strict();

export const triggerDeleteResultSchema = z
    .object({ deleted: z.literal(true), id: idSchema })
    .strict();

/** A test fire rides the same path as a real one, so it answers with a fire id. */
export const triggerTestResultSchema = z.object({ fireId: idSchema }).strict();

/** The agent-facing view: the operator shape plus where the trigger is anchored. */
export const agentTriggerSchema = triggerSchema
    .extend({ anchorTarget: z.string().min(1) })
    .strict();

export type AgentTrigger = z.infer<typeof agentTriggerSchema>;

export const agentTriggerCreateInputSchema = z
    .object({
        instruction: triggerInstructionSchema.min(1).optional(),
        kind: triggerKindSchema.default('webhook'),
        messageId: idSchema,
        title: z.string().trim().min(1).max(triggerTitleMaxLength),
    })
    .strict();

/** Create and rotate: the only responses that ever contain a secret. */
export const agentTriggerSecretResultSchema = z
    .object({
        curl: z.string().min(1),
        secret: z.string().min(1),
        trigger: agentTriggerSchema,
        url: z.string().min(1),
    })
    .strict();

export type AgentTriggerSecretResult = z.infer<typeof agentTriggerSecretResultSchema>;

export const agentTriggerResultSchema = z.object({ trigger: agentTriggerSchema }).strict();
export const agentTriggerListSchema = z.object({ triggers: z.array(agentTriggerSchema) }).strict();
export const agentTriggerDeleteResultSchema = z
    .object({ deleted: z.literal(true), id: idSchema })
    .strict();
/**
 * A log read is either the history or one fire, never both and never neither:
 * the `kind` tag makes the empty answer unrepresentable.
 */
export const agentTriggerLogSchema = z.discriminatedUnion('kind', [
    z.object({ fires: z.array(triggerFireSchema), kind: z.literal('fires') }).strict(),
    z.object({ fire: triggerFireDetailSchema, kind: z.literal('fire') }).strict(),
]);

export type AgentTriggerLog = z.infer<typeof agentTriggerLogSchema>;

/** 202 for a new fire; 200 with `duplicate` when an Idempotency-Key replays. */
export const triggerFireAcceptedSchema = z
    .object({
        duplicate: z.literal(true).optional(),
        fireId: idSchema,
        triggerId: idSchema,
        type: z.literal('trigger_fire'),
    })
    .strict();

export type TriggerFireAccepted = z.infer<typeof triggerFireAcceptedSchema>;

export const triggerFireErrorCodeSchema = z.enum([
    'invalid_idempotency_key',
    'payload_too_large',
    'rate_limited',
    'trigger_disabled',
    'trigger_unavailable',
    'unauthorized',
    'unsupported_media_type',
]);

export type TriggerFireErrorCode = z.infer<typeof triggerFireErrorCodeSchema>;

export const triggerFireErrorSchema = z.object({ code: triggerFireErrorCodeSchema }).strict();
