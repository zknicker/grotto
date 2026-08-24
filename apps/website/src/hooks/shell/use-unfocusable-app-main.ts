import * as React from 'react';

/**
 * Keeps the shell's main region out of the tab order.
 *
 * HeroUI Pro's AppLayout puts `tabIndex={0}` on `<main>` when `scrollMode` is
 * `content`, and exposes no prop to change it — extra props go to the internal
 * Sidebar.Provider, not to the element. It then ships CSS suppressing that
 * element's focus ring, which leaves a silent tab stop: reachable by keyboard
 * with nothing drawn. Structural chrome should not be a tab stop at all.
 *
 * Removing the attribute takes the tab stop and nothing else — the region keeps
 * its role and its `aria-label`, the content inside stays reachable, and a
 * scroll container with no focusable children is made keyboard-focusable by the
 * browser anyway. Done here rather than in a package patch so it stays visible
 * in our own code; remove it if AppLayout ever accepts the prop.
 */
export function useUnfocusableAppMain(): void {
    React.useEffect(() => {
        const main = document.querySelector<HTMLElement>('main.app-layout__main[tabindex]');
        main?.removeAttribute('tabindex');
    });
}
