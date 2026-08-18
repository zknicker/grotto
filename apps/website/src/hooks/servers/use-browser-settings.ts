import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export interface BrowserTarget {
    computerId: string;
    serverId: string;
}

export function useBrowserSettings(target: BrowserTarget) {
    return grottoTrpc.browser.get.useQuery(target, queryPolicy.computerSnapshot);
}
