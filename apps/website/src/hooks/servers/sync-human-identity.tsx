import { useUser } from '@clerk/clerk-react';
import * as React from 'react';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/**
 * Reports the signed-in human's Clerk identity once per session so other
 * members see a name instead of an opaque id. The Server only fills blanks, so
 * this never overwrites a name the human has chosen.
 */
export function SyncHumanIdentity({ serverId }: { serverId: string | undefined }) {
    if (!isClerkEnabled) {
        return null;
    }

    return <ClerkHumanIdentitySync serverId={serverId} />;
}

function ClerkHumanIdentitySync({ serverId }: { serverId: string | undefined }) {
    const { isSignedIn, user } = useUser();
    const sync = grottoTrpc.member.syncIdentity.useMutation();
    const syncMutate = sync.mutate;
    const syncedRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!(serverId && isSignedIn && user) || syncedRef.current === serverId) {
            return;
        }

        syncedRef.current = serverId;
        syncMutate({
            email: user.primaryEmailAddress?.emailAddress ?? null,
            name: user.fullName ?? null,
        });
    }, [isSignedIn, serverId, syncMutate, user]);

    return null;
}
