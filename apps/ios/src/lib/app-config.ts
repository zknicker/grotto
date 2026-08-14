import Constants from 'expo-constants';

const productionClerkPublishableKey = 'pk_live_Y2xlcmsuZ3JvdHRvLnNoJA';
const productionServerOrigin = 'https://grotto.sh';

export const appConfig = {
    clerkPublishableKey:
        process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? productionClerkPublishableKey,
    clerkRedirectUrl: 'grotto://sso-callback',
    productVersion: Constants.expoConfig?.version ?? '0.0.0-dev',
    serverOrigin: resolveServerOrigin(
        process.env.EXPO_PUBLIC_GROTTO_SERVER_ORIGIN ?? productionServerOrigin
    ),
};

function resolveServerOrigin(value: string) {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('EXPO_PUBLIC_GROTTO_SERVER_ORIGIN must be an HTTP(S) origin.');
    }
    return url.origin;
}
