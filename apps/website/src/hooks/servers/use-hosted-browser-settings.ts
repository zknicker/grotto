import type { AgentRuntimeSaveBrowserSettings } from '@tavern/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

interface HostedBrowserTarget {
    computerId: string;
    serverId: string;
}

export function useHostedBrowserSettings(target: HostedBrowserTarget) {
    return grottoTrpc.browser.get.useQuery(target, queryPolicy.agentRuntimeSnapshot);
}

export function useHostedBrowserCommands(target: HostedBrowserTarget) {
    const utils = grottoTrpc.useUtils();
    const refresh = () => utils.browser.get.invalidate(target);

    return {
        open: grottoTrpc.browser.open.useMutation({ onSuccess: refresh }),
        restart: grottoTrpc.browser.restart.useMutation({ onSuccess: refresh }),
        save: grottoTrpc.browser.save.useMutation({ onSuccess: refresh }),
    };
}

export function hostedBrowserSaveInput(
    target: HostedBrowserTarget,
    settings: AgentRuntimeSaveBrowserSettings
) {
    return { ...target, settings };
}
