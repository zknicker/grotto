import { getDesktopBridge } from './desktop-bridge.ts';

/**
 * Open an http(s) link outside the App. In the desktop shell that is the
 * bridge, which hands the URL to the operating system browser rather than
 * navigating the renderer away from Haus; in a browser tab it is an ordinary
 * new tab.
 */
export async function openExternalLink(url: string) {
    const bridge = getDesktopBridge();

    if (bridge) {
        await bridge.openExternal(url);
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}
