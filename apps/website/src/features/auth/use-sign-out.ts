import { useClerk } from '@clerk/clerk-react';
import { useCallback } from 'react';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';

/**
 * Ending the session, from wherever the product offers it.
 *
 * The desktop shell passes a no-op redirect because Clerk's default is a
 * browser navigation, which in a packaged app would leave the window on a URL
 * the shell does not own.
 */
export function useSignOut(): () => void {
    const clerk = useClerk();

    return useCallback(() => {
        if (isElectronDesktopApp()) {
            void clerk.signOut(() => undefined);
            return;
        }
        void clerk.signOut();
    }, [clerk]);
}
