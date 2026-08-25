import type { GrottoDesktopBridge } from './lib/desktop-bridge.ts';

declare global {
    interface Window {
        grottoDesktop?: GrottoDesktopBridge;
        /** Pre-Grotto global, still injected by shells older than v1.8.20. */
        tavernDesktop?: GrottoDesktopBridge;
    }
}
