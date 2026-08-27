import type { DesktopUpdateStatus } from '../../hooks/desktop/use-desktop-update.ts';
import { useDesktopUpdate } from '../../hooks/desktop/use-desktop-update.ts';
import { DesktopUpdateStatusControl } from './desktop-update-status.tsx';

export function DesktopUpdateFooter() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();

    return (
        <DesktopUpdateFooterStatus
            onCheck={() => {
                void checkForUpdate();
            }}
            onUpdate={() => {
                void updateAndRestart();
            }}
            status={status}
        />
    );
}

export function DesktopUpdateFooterStatus({
    onCheck,
    onUpdate,
    status,
}: {
    onCheck: () => void;
    onUpdate: () => void;
    status: DesktopUpdateStatus;
}) {
    if (!isVisibleDesktopUpdateStatus(status)) {
        return null;
    }

    return (
        <section
            aria-label="Grotto app update"
            aria-live="polite"
            className="flex w-full flex-col items-start px-2"
        >
            <DesktopUpdateStatusControl onCheck={onCheck} onUpdate={onUpdate} status={status} />
        </section>
    );
}

function isVisibleDesktopUpdateStatus(status: DesktopUpdateStatus) {
    return !['checking', 'current', 'idle', 'unsupported'].includes(status.phase);
}
