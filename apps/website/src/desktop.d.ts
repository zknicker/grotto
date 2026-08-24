import type { GrottoDesktopBridge } from './lib/desktop-bridge.ts';

declare global {
    interface Window {
        grottoDesktop?: GrottoDesktopBridge;
    }
}
