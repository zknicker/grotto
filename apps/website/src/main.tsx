import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.tsx';
import { DevModeProvider } from './components/dev-mode-provider.tsx';
import { ThemeProvider } from './components/theme-provider.tsx';
import { DesktopEditContextMenuProvider } from './components/ui/edit-context-menu.tsx';
import { ToastProvider } from './components/ui/toast.tsx';
import { TavernClerkProvider } from './lib/clerk.tsx';
import { isElectronDesktopApp } from './lib/desktop-bridge.ts';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element not found.');
}

if (isElectronDesktopApp() && navigator.userAgent.includes('Mac')) {
    document.documentElement.classList.add('macos-electron');
}

createRoot(rootElement).render(
    <StrictMode>
        <TavernClerkProvider>
            <ThemeProvider>
                <DevModeProvider>
                    <ToastProvider>
                        <DesktopEditContextMenuProvider>
                            <App />
                        </DesktopEditContextMenuProvider>
                    </ToastProvider>
                </DevModeProvider>
            </ThemeProvider>
        </TavernClerkProvider>
    </StrictMode>
);
