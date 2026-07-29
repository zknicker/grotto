import { TavernUpdateIcon } from '../../components/desktop-update-indicator.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SidebarMenuItem } from '../../components/ui/sidebar.tsx';
import { useTavernUpdateIndicator } from '../../hooks/desktop/use-tavern-update-indicator.ts';

export function SidebarUpdateMenuItem() {
    const update = useTavernUpdateIndicator();

    if (!update) {
        return null;
    }

    const isIssue =
        update.status.phase === 'app-update-required' ||
        update.status.phase === 'failed' ||
        update.status.phase === 'runtime-disconnected';

    return (
        <SidebarMenuItem>
            <Button
                aria-label={`${update.sidebarLabel}: ${update.status.detail}`}
                className="w-full max-w-full justify-start overflow-hidden px-2"
                disabled={!update.canAct}
                onClick={update.activate}
                variant={isIssue ? 'destructive-soft' : 'brand-soft'}
            >
                <TavernUpdateIcon phase={update.status.phase} progress={update.progress} />
                <span className="min-w-0 truncate">{update.sidebarLabel}</span>
            </Button>
        </SidebarMenuItem>
    );
}
