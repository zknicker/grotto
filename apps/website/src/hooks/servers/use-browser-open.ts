import { grottoTrpc } from '../../lib/grotto-server.tsx';
import type { BrowserTarget } from './use-browser-settings.ts';

export function useBrowserOpen(target: BrowserTarget) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.browser.open.useMutation({
        onSuccess: () => utils.browser.get.invalidate(target),
    });
}
