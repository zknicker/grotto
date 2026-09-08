import {
    type BrowserRequest,
    type BrowserResult,
    browserRequestSchema,
    browserResultSchema,
} from '@grotto/api';
import { type EffectRuntime, tracePromise } from '@grotto/effect';
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
    request: BrowserRequest,
    runtime: EffectRuntime<never>
): Promise<BrowserResult> {
    try {
        return await tracePromise(
            runtime,
            'grotto.browser.operation',
            {
                'grotto.operation': `browser.${request.operation.kind}`,
                'grotto.request.id': request.requestId,
            },
            () => runBrowserOperation(root, request, runtime),
            request.traceContext
        );
    } catch (error) {
        return browserResultSchema.parse({
            error: safeBrowserError(error),
            requestId: request.requestId,
            type: 'browser-result',
        });
    }
}

async function runBrowserOperation(
    root: string,
    request: BrowserRequest,
    runtime: EffectRuntime<never>
): Promise<BrowserResult> {
    const result =
        request.operation.kind === 'get'
            ? {
                  kind: 'settings' as const,
                  value: await getComputerBrowserSettings(root),
              }
            : request.operation.kind === 'save'
              ? {
                    kind: 'settings' as const,
                    value: await saveComputerBrowserSettings(
                        root,
                        request.operation.input,
                        runtime
                    ),
                }
              : {
                    kind: 'action' as const,
                    value:
                        request.operation.kind === 'open'
                            ? await openComputerBrowser(root, runtime)
                            : await restartComputerBrowser(root, runtime),
                };

    return browserResultSchema.parse({
        requestId: request.requestId,
        result,
        type: 'browser-result',
    });
}

function safeBrowserError(error: unknown) {
    const message = error instanceof Error ? error.message : 'The Browser request failed.';
    return message.slice(0, 500) || 'The Browser request failed.';
}
