import { TRPCError } from '@trpc/server';
import { HostedBrowserDeniedError, requestHostedBrowser } from '../../hosted-browser/browser.ts';
import type { GrottoUser } from '../../users/grotto-user.ts';
import type { GrottoContext } from '../context.ts';
import { memberProcedure } from '../server/procedure.ts';
import { createRouter } from '../trpc.ts';
import {
    hostedBrowserActionInputSchema,
    hostedBrowserActionOutputSchema,
    hostedBrowserGetInputSchema,
    hostedBrowserSaveInputSchema,
    hostedBrowserSettingsOutputSchema,
} from './contracts.ts';

export const hostedBrowserRouter = createRouter({
    get: memberProcedure
        .input(hostedBrowserGetInputSchema)
        .output(hostedBrowserSettingsOutputSchema)
        .query(async ({ ctx, input }) => {
            const result = await relay(ctx, input, { kind: 'get' });
            if (result.kind !== 'settings') {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
            }
            return result.value;
        }),
    open: actionProcedure('open'),
    restart: actionProcedure('restart'),
    save: memberProcedure
        .input(hostedBrowserSaveInputSchema)
        .output(hostedBrowserSettingsOutputSchema)
        .mutation(async ({ ctx, input }) => {
            const result = await relay(ctx, input, { input: input.settings, kind: 'save' });
            if (result.kind !== 'settings') {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
            }
            return result.value;
        }),
});

function actionProcedure(kind: 'open' | 'restart') {
    return memberProcedure
        .input(hostedBrowserActionInputSchema)
        .output(hostedBrowserActionOutputSchema)
        .mutation(async ({ ctx, input }) => {
            const result = await relay(ctx, input, { kind });
            if (result.kind !== 'action') {
                throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
            }
            return result.value;
        });
}

async function relay(
    ctx: GrottoContext & { member: GrottoUser | null },
    input: { computerId: string; serverId: string },
    operation:
        | { kind: 'get' | 'open' | 'restart' }
        | { input: { enabled?: boolean; profileName?: string }; kind: 'save' }
) {
    try {
        return await requestHostedBrowser(ctx.grottoDb, ctx.computerConnections, ctx.member, {
            ...input,
            operation,
        });
    } catch (cause) {
        if (cause instanceof HostedBrowserDeniedError) {
            throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
        }
        throw cause;
    }
}
