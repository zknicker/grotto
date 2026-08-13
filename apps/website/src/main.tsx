import { Toast } from '@heroui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import { DevModeProvider } from './components/dev-mode-provider.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import { DesktopEditContextMenuProvider } from './features/shell/desktop-edit-context-menu.tsx';
import { TavernClerkProvider } from './lib/clerk.tsx';
import { getDesktopBridge, isElectronDesktopApp } from './lib/desktop-bridge.ts';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found.');
}

if (isElectronDesktopApp() && navigator.userAgent.includes('Mac')) {
    document.documentElement.classList.add('macos-electron');

    // Native windows dim their chrome when unfocused. Window focus comes from
    // the main process: renderer blur also fires when focus moves into an
    // iframe (artifact panes), which must not dim the window.
    getDesktopBridge()?.onWindowFocusChanged?.((focused) => {
        document.documentElement.classList.toggle('window-blurred', !focused);
    });
}

createRoot(rootElement).render(
    <StrictMode>
        <TavernClerkProvider>
            <ThemeProvider>
                <DevModeProvider>
                    <DesktopEditContextMenuProvider>
                        <App />
                    </DesktopEditContextMenuProvider>
                    <Toast.Provider placement="bottom end" />
                </DevModeProvider>
            </ThemeProvider>
        </TavernClerkProvider>
    </StrictMode>
);
