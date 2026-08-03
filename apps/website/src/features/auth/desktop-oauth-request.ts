export function desktopGoogleOAuthRequest(redirectUrl: string) {
    return {
        redirectUrl,
        strategy: 'oauth_google',
    } as const;
}

export async function getDesktopOAuthCallbackUrl(bridge: {
    prepareSsoCallback?: () => Promise<string>;
}) {
    return bridge.prepareSsoCallback ? await bridge.prepareSsoCallback() : 'grotto://sso-callback';
}
