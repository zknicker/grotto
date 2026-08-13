import {
    type BrowserRequest,
    type BrowserResult,
    browserRequestSchema,
    browserResultSchema,
} from '@tavern/api';
import {
    getComputerBrowserSettings,
    openComputerBrowser,
    restartComputerBrowser,
    saveComputerBrowserSettings,
} from './settings.ts';

export function parseBrowserRequest(value: unknown): BrowserRequest | null {
    const parsed = browserRequestSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

export async function runBrowserRequest(
    root: string,
    request: BrowserRequest
): Promise<BrowserResult> {
    try {
        const result =
            request.operation.kind === 'get'
                ? {
                      kind: 'settings' as const,
                      value: await getComputerBrowserSettings(root),
                  }
                : request.operation.kind === 'save'
                  ? {
                        kind: 'settings' as const,
                        value: await saveComputerBrowserSettings(root, request.operation.input),
                    }
                  : {
                        kind: 'action' as const,
                        value:
                            request.operation.kind === 'open'
                                ? await openComputerBrowser(root)
                                : await restartComputerBrowser(root),
                    };

        return browserResultSchema.parse({
            requestId: request.requestId,
            result,
            type: 'browser-result',
        });
    } catch (error) {
        return browserResultSchema.parse({
            error: safeBrowserError(error),
            requestId: request.requestId,
            type: 'browser-result',
        });
    }
}

function safeBrowserError(error: unknown) {
    const message = error instanceof Error ? error.message : 'The Browser request failed.';
    return message.slice(0, 500) || 'The Browser request failed.';
}
