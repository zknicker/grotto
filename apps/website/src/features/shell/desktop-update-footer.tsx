import { useDesktopUpdate } from '../../hooks/desktop/use-desktop-update.ts';
import { DesktopUpdateStatusControl } from './desktop-update-status.tsx';

export function DesktopUpdateFooter() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();

    return (
        // The compact status circle shares the composer's visual midline.
        <section
            aria-label="Grotto app update"
            aria-live="polite"
            className="mb-2 flex w-full flex-col items-start gap-1"
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
