import { hausTrpc } from '../../lib/haus-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';

export interface BrowserTarget {
    computerId: string;
    serverId: string;
}

export function useBrowserSettings(target: BrowserTarget) {
    return hausTrpc.browser.get.useQuery(target, queryPolicy.computerSnapshot);
}
