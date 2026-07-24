import { queryPolicy } from '../../lib/query-policy.ts';
import { trpc } from '../../lib/trpc.tsx';

export function useBrowserSettings() {
    return trpc.browser.get.useQuery(undefined, queryPolicy.agentRuntimeSnapshot);
}

export function useSaveBrowserSettings() {
    const utils = trpc.useUtils();
    return trpc.browser.save.useMutation({
        async onSuccess() {
            await invalidateBrowserQueries(utils);
        },
    });
}

export function useOpenBrowser() {
    const utils = trpc.useUtils();
    return trpc.browser.open.useMutation({
        async onSuccess() {
            await utils.browser.get.invalidate();
        },
    });
}

export function useRestartBrowser() {
    const utils = trpc.useUtils();
    return trpc.browser.restart.useMutation({
        async onSuccess() {
            await utils.browser.get.invalidate();
        },
    });
}

async function invalidateBrowserQueries(utils: ReturnType<typeof trpc.useUtils>) {
    await Promise.all([
        utils.browser.get.invalidate(),
        utils.agentRuntime.get.invalidate(),
        utils.skill.list.invalidate(),
    ]);
}
