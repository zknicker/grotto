import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { OAuthClientInformation } from '@ai-sdk/mcp';

export async function readGoogleMcpOAuthClient(): Promise<OAuthClientInformation> {
    const clientId = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.TAVERN_GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    if (clientId && clientSecret) {
        return { client_id: clientId, client_secret: clientSecret };
    }
    const path = join(
        dirname(process.execPath),
        '..',
        'share',
        'grotto',
        'runtime-assets',
        'google',
        'oauth-client.json'
    );
    try {
        const parsed = JSON.parse(await readFile(path, 'utf8')) as {
            clientId?: string;
            clientSecret?: string;
        };
        if (parsed.clientId?.trim() && parsed.clientSecret?.trim()) {
            return {
                client_id: parsed.clientId.trim(),
                client_secret: parsed.clientSecret.trim(),
            };
        }
    } catch {
        // The error below is the stable product-facing failure.
    }
    throw new Error('The packaged Google Calendar OAuth client is unavailable on this Computer.');
}
