import { SignedIn, SignedOut, useClerk, useUser } from '@clerk/clerk-react';
import { Avatar, Button, Dropdown, Label } from '@heroui/react';
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
                <AccountMenu />
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

function AccountMenu() {
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
        <Dropdown>
            <Button className="justify-start" fullWidth size="sm" variant="ghost">
                <Avatar className="size-5 shrink-0">
                    {user?.imageUrl ? <Avatar.Image alt="" src={user.imageUrl} /> : null}
                    <Avatar.Fallback>{displayName.slice(0, 1).toUpperCase()}</Avatar.Fallback>
                </Avatar>
                <span className="min-w-0 truncate">{displayName}</span>
            </Button>
            <Dropdown.Popover placement="top start">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === 'sign-out') {
                            signOut();
                        }
                    }}
                >
                    <Dropdown.Item id="sign-out" textValue="Sign Out">
                        <Label>Sign Out</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
