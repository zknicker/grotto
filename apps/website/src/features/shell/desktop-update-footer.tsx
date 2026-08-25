import { useDesktopUpdate } from '../../hooks/desktop/use-desktop-update.ts';
import { DesktopUpdateStatusControl } from './desktop-update-status.tsx';

export function DesktopUpdateFooter() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();

    return (
        <section
            aria-label="Grotto app update"
            aria-live="polite"
            className="flex w-full flex-col items-start gap-1 px-1"
        >
            <DesktopUpdateStatusControl
                onCheck={() => {
                    void checkForUpdate();
                }}
                onUpdate={() => {
                    void updateAndRestart();
                }}
                status={status}
            />
        </section>
    );
}
