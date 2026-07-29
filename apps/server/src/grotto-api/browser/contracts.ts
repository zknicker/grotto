import {
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeSaveBrowserSettingsSchema,
} from '@tavern/api';
import { z } from 'zod';
import { computerIdSchema } from '../../computers/contracts.ts';
import { serverIdSchema } from '../../servers/contracts.ts';

const browserTargetSchema = z
    .object({
        computerId: computerIdSchema,
        serverId: serverIdSchema,
    })
    .strict();

export const hostedBrowserGetInputSchema = browserTargetSchema;
export const hostedBrowserSaveInputSchema = browserTargetSchema
    .extend({ settings: agentRuntimeSaveBrowserSettingsSchema })
    .strict();
export const hostedBrowserActionInputSchema = browserTargetSchema;
export const hostedBrowserSettingsOutputSchema = agentRuntimeBrowserSettingsSchema;
export const hostedBrowserActionOutputSchema = agentRuntimeBrowserActionResultSchema;
