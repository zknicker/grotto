import { computerBootstrapHelloSchema, computerUpdateProgressSchema } from '@tavern/api';
import { z } from 'zod';
import { serverIdSchema, serverSlugSchema } from '../servers/contracts.ts';

export const computerIdSchema = z.string().regex(/^cmp_[A-Za-z0-9_-]{16}$/u);
export const computerCredentialHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const computerApprovalSecretSchema = z.string().min(32).max(256);
export const computerApprovalIdSchema = z.string().regex(/^cap_[A-Za-z0-9_-]{16}$/u);
export const computerHandshakeSchema = computerBootstrapHelloSchema.omit({
    bootstrapProtocolVersion: true,
    credential: true,
    type: true,
});

export const beginComputerSetupSchema = z
    .object({ credentialHash: computerCredentialHashSchema, slug: serverSlugSchema })
    .strict();
export const computerSetupStatusSchema = z
    .object({ approvalId: computerApprovalIdSchema, secret: computerApprovalSecretSchema })
    .strict();
export const validateComputerCredentialSchema = z
    .object({ credentialHash: computerCredentialHashSchema, serverId: serverIdSchema })
    .strict();
export const approveComputerSetupSchema = z
    .object({ approvalId: computerApprovalIdSchema, secret: computerApprovalSecretSchema })
    .strict();

export const computerUpdateInputSchema = z
    .object({ computerId: computerIdSchema, serverId: serverIdSchema })
    .strict();

export type ComputerHandshake = z.infer<typeof computerHandshakeSchema>;
export const computerProgressSchema = computerUpdateProgressSchema;
