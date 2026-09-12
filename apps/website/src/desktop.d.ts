import type { HausDesktopBridge } from './lib/desktop-bridge.ts';

declare global {
    interface Window {
        hausDesktop?: HausDesktopBridge;
    }
}
