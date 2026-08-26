import { useDesktopUpdate } from '../../hooks/desktop/use-desktop-update.ts';
import { DesktopUpdateStatusControl } from './desktop-update-status.tsx';

export function DesktopUpdateFooter() {
    const { checkForUpdate, status, updateAndRestart } = useDesktopUpdate();

    return (
        // Two corrections, both against neighbours rather than round numbers.
        // `mb-2` lifts the pill onto the composer's midline: the two already
        // share one floor, so their bottom edges agreed, but a 30px pill
        // against the 46px composer put its center 8px lower and the eye reads
        // the center. And no horizontal padding — Sidebar.Footer already
        // carries the sidebar's gutter, so the `px-1` that used to sit here
        // stacked on it and pushed the pill 5px right of every row above.
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
