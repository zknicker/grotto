import { hausTrpc } from '../../lib/haus-server.tsx';
import type { BrowserTarget } from './use-browser-settings.ts';

export function useBrowserRestart(target: BrowserTarget) {
    const utils = hausTrpc.useUtils();

    return hausTrpc.browser.restart.useMutation({
        onSuccess: () => utils.browser.get.invalidate(target),
    });
}
