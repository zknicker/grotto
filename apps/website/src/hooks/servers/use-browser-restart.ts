import { grottoTrpc } from '../../lib/grotto-server.tsx';
import type { BrowserTarget } from './use-browser-settings.ts';

export function useBrowserRestart(target: BrowserTarget) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.browser.restart.useMutation({
        onSuccess: () => utils.browser.get.invalidate(target),
    });
}
