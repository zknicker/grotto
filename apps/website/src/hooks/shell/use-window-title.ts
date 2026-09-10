import { useEffect } from 'react';

const baseTitle = 'Haus';

/**
 * Titles the window/tab "<title> — Haus" while mounted. Electron windows
 * follow document.title, so this names windows in the Window menu, ⌘`
 * cycling, and Mission Control.
 */
export function useWindowTitle(title: string | null | undefined) {
    useEffect(() => {
        if (!title) {
            return;
        }

        document.title = `${title} — ${baseTitle}`;
        return () => {
            document.title = baseTitle;
        };
    }, [title]);
}
