import {
    agentRuntimeBrowserActionResultSchema,
    agentRuntimeBrowserSettingsSchema,
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
    agentRuntimeSaveBrowserSettingsSchema,
} from '@tavern/api';
import { refreshRuntimeCapabilities } from '../capabilities/store.ts';
import { badRequest, forbidden, json } from '../tavern/http.ts';
import {
    getBrowserSettings,
    openBrowser,
    restartBrowser,
    saveBrowserSettings,
} from './settings.ts';

export async function handleBrowserRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/browser')) {
        return null;
    }
    if (request.method === 'GET' && url.pathname === agentRuntimeRoutes.browserSettings) {
        return json(agentRuntimeBrowserSettingsSchema.parse(await getBrowserSettings()));
    }
    if (request.method === 'PUT' && url.pathname === agentRuntimeRoutes.browserSettings) {
        const denied = requireTavernMutation(request);
        if (denied) {
            return denied;
        }
        try {
            const settings = await saveBrowserSettings(
                agentRuntimeSaveBrowserSettingsSchema.parse(await request.json())
            );
            await refreshBrowserCapability();
            return json(agentRuntimeBrowserSettingsSchema.parse(settings));
        } catch (error) {
            return badRequest(error instanceof Error ? error.message : String(error));
        }
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.browserOpen) {
        return await runBrowserAction(request, openBrowser);
    }
    if (request.method === 'POST' && url.pathname === agentRuntimeRoutes.browserRestart) {
        return await runBrowserAction(request, restartBrowser);
    }
    return null;
}

async function runBrowserAction(
    request: Request,
    action: () => Promise<unknown>
): Promise<Response> {
    const denied = requireTavernMutation(request);
    if (denied) {
        return denied;
    }
    try {
        const result = await action();
        await refreshBrowserCapability();
        return json(agentRuntimeBrowserActionResultSchema.parse(result));
    } catch (error) {
        return badRequest(error instanceof Error ? error.message : String(error));
    }
}

function requireTavernMutation(request: Request) {
    return request.headers.get(agentRuntimeMutationHeaders.origin) ===
        agentRuntimeMutationOrigins.tavern
        ? null
        : forbidden('Browser changes require a Grotto caller.');
}

async function refreshBrowserCapability() {
    await refreshRuntimeCapabilities({
        ids: ['browser'],
        publishUpdated: true,
    });
}
