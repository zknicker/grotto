import type { QueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Button } from '../../components/ui/button.tsx';
import { getDesktopBridge } from '../../lib/desktop-bridge.ts';
import {
    isUpdateRequiredError,
    type UpdateRequiredMode,
    updateRequiredMode,
} from '../../lib/app-update-required.ts';

/**
 * Watches every hosted query and mutation for the Server's protocol-mismatch
 * rejection. The gate covers the whole hosted App because `server.list` and the
 * open Server run on load, so a stale client trips it before showing product
 * data. A hosted browser tab is taught to reload; a packaged desktop App, which
 * cannot reload into a new contract, is taught to install a desktop update.
 */
export function UpdateRequiredGate({
    children,
    queryClient,
}: React.PropsWithChildren<{ queryClient: QueryClient }>) {
    const mismatched = useProtocolMismatch(queryClient);

    if (!mismatched) {
        return children;
    }

    return <UpdateRequiredScreen mode={updateRequiredMode()} />;
}

function useProtocolMismatch(queryClient: QueryClient): boolean {
    const [mismatched, setMismatched] = React.useState(false);

    React.useEffect(() => {
        if (mismatched) {
            return;
        }

        const flagIfMismatch = (error: unknown) => {
            if (isUpdateRequiredError(error)) {
                setMismatched(true);
            }
        };

        const queryCache = queryClient.getQueryCache();
        const mutationCache = queryClient.getMutationCache();

        const unsubscribeQueries = queryCache.subscribe((event) => {
            if (event.type === 'updated' && event.query.state.status === 'error') {
                flagIfMismatch(event.query.state.error);
            }
        });
        const unsubscribeMutations = mutationCache.subscribe((event) => {
            if (event.type === 'updated' && event.mutation?.state.status === 'error') {
                flagIfMismatch(event.mutation.state.error);
            }
        });

        // Catch errors already present when this effect mounts.
        for (const query of queryCache.getAll()) {
            flagIfMismatch(query.state.error);
        }

        return () => {
            unsubscribeQueries();
            unsubscribeMutations();
        };
    }, [mismatched, queryClient]);

    return mismatched;
}

function UpdateRequiredScreen({ mode }: { mode: UpdateRequiredMode }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="max-w-md space-y-4 text-center">
                <h1 className="font-semibold text-lg text-foreground">Update required</h1>
                {mode === 'reload' ? <ReloadBody /> : <DesktopUpdateBody />}
            </div>
        </div>
    );
}

function ReloadBody() {
    return (
        <>
            <p className="text-muted-foreground text-sm">
                Grotto was updated. Reload this tab to continue with the current version.
            </p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
        </>
    );
}

function DesktopUpdateBody() {
    const [checking, setChecking] = React.useState(false);

    const checkForUpdate = React.useCallback(async () => {
        setChecking(true);
        await getDesktopBridge()?.checkForUpdate();
    }, []);

    return (
        <>
            <p className="text-muted-foreground text-sm">
                This version of the Grotto desktop app no longer matches the Server. Install the
                latest desktop update to continue.
            </p>
            <Button disabled={checking} onClick={checkForUpdate}>
                {checking ? 'Checking…' : 'Check for updates'}
            </Button>
        </>
    );
}
