import { SignedIn, SignedOut, useClerk, useUser } from '@clerk/clerk-react';
import { Button, Tooltip } from '@heroui/react';
import { Logout01Icon, UserCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { useDesktopOAuth } from '../auth/use-desktop-oauth.ts';

/**
 * Account row for the sidebar footer — no prebuilt Clerk UI components here:
 * the Electron surface runs headless native clerk-js, which has none, and the
 * web surface stays consistent with it.
 */
export function SidebarAccount() {
    if (!isClerkEnabled) {
        return null;
    }
    return (
        <>
            <SignedOut>
                <SignInButton />
            </SignedOut>
            <SignedIn>
                <SignedInRow />
            </SignedIn>
        </>
    );
}

function SignInButton() {
    const clerk = useClerk();
    const { startGoogleSignIn } = useDesktopOAuth();
    const onPress = () => {
        if (isElectronDesktopApp()) {
            startGoogleSignIn().catch(() => {
                // The sign-in gate is the primary surface; failures surface there.
            });
            return;
        }
        void clerk.openSignIn({});
    };
    return (
        <Button fullWidth onPress={onPress} size="sm" variant="secondary">
            Sign in
        </Button>
    );
}

function SignedInRow() {
    const clerk = useClerk();
    const { user } = useUser();
    const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Account';
    const signOut = () => {
        if (isElectronDesktopApp()) {
            void clerk.signOut(() => undefined);
            return;
        }
        void clerk.signOut();
    };
    return (
        <div className="flex items-center gap-2 px-2 py-1">
            {user?.imageUrl ? (
                <img
                    alt=""
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded-full"
                    height={20}
                    src={user.imageUrl}
                    width={20}
                />
            ) : (
                <Icon aria-hidden="true" className="shrink-0" icon={UserCircleIcon} size={18} />
            )}
            <span className="min-w-0 flex-1 truncate text-foreground text-sm">{displayName}</span>
            <Tooltip delay={0}>
                <Button
                    aria-label="Sign out"
                    isIconOnly
                    onPress={signOut}
                    size="sm"
                    variant="ghost"
                >
                    <Icon aria-hidden="true" icon={Logout01Icon} size={16} />
                </Button>
                <Tooltip.Content placement="top">Sign out</Tooltip.Content>
            </Tooltip>
        </div>
    );
}
