import type { StartSSOFlowParams, StartSSOFlowReturnType } from '@clerk/expo/types';

type StartSSOFlow = (params: StartSSOFlowParams) => Promise<StartSSOFlowReturnType>;

export async function startGoogleSignIn({
    redirectUrl,
    startSSOFlow,
}: {
    redirectUrl: string;
    startSSOFlow: StartSSOFlow;
}): Promise<'canceled' | 'complete'> {
    const result = await startSSOFlow({
        redirectUrl,
        strategy: 'oauth_google',
    });

    if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        return 'complete';
    }

    if (
        result.authSessionResult?.type === 'cancel' ||
        result.authSessionResult?.type === 'dismiss'
    ) {
        return 'canceled';
    }

    throw new Error('Google sign-in did not create a Grotto session.');
}
