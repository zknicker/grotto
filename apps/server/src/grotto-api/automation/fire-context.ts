import { automationFireContextInputSchema, automationFireContextSchema } from '@grotto/api';
import { readAutomationFireContext } from '../../automations/fire-context.ts';
import { automationProcedure } from './procedure.ts';

export const automationFireContextProcedure = automationProcedure
    .input(automationFireContextInputSchema)
    .output(automationFireContextSchema)
    .query(
        async ({ ctx, input }) => await readAutomationFireContext(ctx.grottoDb, ctx.member, input)
    );
