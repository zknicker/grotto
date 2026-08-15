import { useAuth, useSSO } from '@clerk/expo';
import { GoogleIcon } from '@hugeicons-pro/core-solid-rounded';
import { Button } from 'heroui-native/button';
import { Spinner } from 'heroui-native/spinner';
import { Surface } from 'heroui-native/surface';
import { type ReactNode, useState } from 'react';
import { Text, View } from 'react-native';
import { GrottoLogo } from '@/components/grotto-logo';
import { appConfig } from '@/lib/app-config';
import { GrottoServerProvider } from '@/lib/grotto-server-provider';
import { AppIcon } from '../../components/app-icon.tsx';
import { startGoogleSignIn } from './google-sign-in';

export function AuthBoundary({ children }: { children: ReactNode }) {
    const { getToken, isLoaded, isSignedIn, userId } = useAuth({
        treatPendingAsSignedOut: false,
    });

    if (!isLoaded) {
        return <CenteredSpinner />;
    }

    if (!(isSignedIn && userId)) {
        return <SignIn />;
    }

    return (
        <GrottoServerProvider key={userId} readSessionToken={getToken}>
            {children}
        </GrottoServerProvider>
    );
}

function CenteredSpinner() {
    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Spinner />
        </View>
    );
}

function SignIn() {
    const { startSSOFlow } = useSSO();
    const [error, setError] = useState<string | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    const signIn = async () => {
        setError(null);
        setIsSigningIn(true);
        try {
            await startGoogleSignIn({
                redirectUrl: appConfig.clerkRedirectUrl,
                startSSOFlow,
            });
        } catch (caught) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Google sign-in failed', caught);
            }
            setError('Google sign-in could not finish. Please try again.');
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <Surface className="flex-1 items-center justify-center gap-6 rounded-none px-8">
            <GrottoLogo size={72} />
            <View className="items-center gap-2">
                <Text className="font-semibold text-2xl text-foreground">Welcome to Grotto</Text>
                <Text className="text-center text-base text-muted">
                    Sign in to open your team and agents.
                </Text>
            </View>
            <View className="w-full gap-3">
                <Button
                    accessibilityLabel="Continue with Google"
                    isDisabled={isSigningIn}
                    onPress={signIn}
                    size="lg"
                    variant="primary"
                >
                    {isSigningIn ? (
                        <Spinner size="sm" />
                    ) : (
                        <>
                            <AppIcon icon={GoogleIcon} tone="accent-foreground" />
                            <Button.Label>Continue with Google</Button.Label>
                        </>
                    )}
                </Button>
                {error ? <Text className="text-center text-danger text-sm">{error}</Text> : null}
            </View>
        </Surface>
    );
}
