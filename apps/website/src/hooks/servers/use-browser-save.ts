import type { AgentRuntimeSaveBrowserSettings } from '@grotto/api';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import type { BrowserTarget } from './use-browser-settings.ts';

export function useBrowserSave(target: BrowserTarget) {
    const utils = grottoTrpc.useUtils();

    return grottoTrpc.browser.save.useMutation({
        onSuccess: () => utils.browser.get.invalidate(target),
    });
}

export function browserSaveInput(target: BrowserTarget, settings: AgentRuntimeSaveBrowserSettings) {
    return { ...target, settings };
}
