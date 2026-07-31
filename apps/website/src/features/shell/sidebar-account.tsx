import { SignedIn, SignedOut, useClerk, useUser } from '@clerk/clerk-react';
import { Button } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Logout01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { useDesktopOAuth } from '../auth/use-desktop-oauth.ts';
import { MemberInitialsAvatar } from '../members/member-initials-avatar.tsx';

/**
 * Account row for the sidebar footer, shaped as a stock sidebar menu row so
 * it aligns with every other row. No prebuilt Clerk UI components here: the
 * Electron surface runs headless native clerk-js, which has none, and the
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
                <AccountRow />
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
            Sign In
        </Button>
    );
}

function AccountRow() {
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
        <Sidebar.Menu aria-label="Account">
            <Sidebar.MenuItem id="account" textValue={displayName}>
                <Sidebar.MenuIcon>
                    <MemberInitialsAvatar
                        imageUrl={user?.imageUrl}
                        label={displayName.slice(0, 1).toUpperCase()}
                    />
                </Sidebar.MenuIcon>
                <Sidebar.MenuItemContent>
                    <Sidebar.MenuLabel>{displayName}</Sidebar.MenuLabel>
                    <Sidebar.MenuActions>
                        <Sidebar.MenuAction aria-label="Sign Out" onPress={signOut}>
                            <Icon aria-hidden="true" icon={Logout01Icon} size={16} />
                        </Sidebar.MenuAction>
                    </Sidebar.MenuActions>
                </Sidebar.MenuItemContent>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    );
}
