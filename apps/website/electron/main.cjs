'use strict';

const {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    nativeTheme,
    safeStorage,
    session,
    shell,
    webContents,
} = require('electron');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { existsSync } = require('node:fs');
const electronUpdater = require('electron-updater');
const { registerClerkAuth } = require('./clerk-auth.cjs');
const { resolveClerkAuthOrigins } = require('./clerk-auth-origins.cjs');
const { registerNativeClerkRequestHeaders } = require('./clerk-native-requests.cjs');
const { registerEditContextMenuHandlers } = require('./edit-context-menu.cjs');
const { registerExternalLinkHandlers } = require('./external-link-handlers.cjs');
const { assertTrustedRenderer } = require('./trusted-renderer.cjs');
const { buildWindowUrl, isSafeWindowRoute, nextWindowBounds } = require('./window-routing.cjs');

// A broken stdout/stderr pipe (e.g. the dev launcher's reader went away, or a logging
// library writes after the pipe closed) must never crash the app with an uncaught EPIPE.
for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (error) => {
        if (error.code !== 'EPIPE') {
            throw error;
        }
    });
}

const updateCheckIntervalMs = 10 * 60 * 1000;
const openDevtoolsMenuId = 'open-devtools';
const productionAppUrl = 'https://grotto.sh';
// Matches --topbar-height in the renderer so the traffic lights center in
// the shell's headroom band.
const topbarHeightPx = 48;
const macosTrafficLightDiameterPx = 12;
const macosTrafficLightPosition = {
    x: 17,
    y: (topbarHeightPx - macosTrafficLightDiameterPx) / 2 - 1,
};
const { autoUpdater } = electronUpdater;
const useMockUpdater = !app.isPackaged && process.env.TAVERN_ELECTRON_UPDATER_MOCK === '1';
const appUrl = app.isPackaged
    ? productionAppUrl
    : (process.env.TAVERN_ELECTRON_DEV_URL ?? productionAppUrl);
const clerkAuthOrigins = resolveClerkAuthOrigins({
    appUrl,
    clerkIssuerUrl: process.env.CLERK_ISSUER_URL,
    isPackaged: app.isPackaged,
});

const windows = new Set();
let mainWindow = null;
let updateCheckInterval = null;
let availableDesktopUpdateVersion = null;
const newWindowOffsetPx = 36;

if (process.env.TAVERN_ELECTRON_DEV_URL) {
    const stackId = (process.env.TAVERN_DEV_STACK_ID || 'default').replace(
        /[^a-zA-Z0-9._-]/gu,
        '-'
    );
    app.setPath('userData', path.join(app.getPath('appData'), 'Grotto Dev', stackId));
}

app.setName('Grotto');
app.setAppUserModelId('build.grotto.desktop');

registerClerkAuth({ app, appUrl, BrowserWindow, ipcMain, safeStorage, shell, webContents });

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

if (process.env.TAVERN_ELECTRON_UPDATE_FEED_URL) {
    autoUpdater.setFeedURL({
        provider: 'generic',
        url: process.env.TAVERN_ELECTRON_UPDATE_FEED_URL,
    });
}

if (useMockUpdater) {
    autoUpdater.forceDevUpdateConfig = true;
}

function createWindow({ route, openerBounds } = {}) {
    const bounds = nextWindowBounds(openerBounds, { offset: newWindowOffsetPx });
    const window = new BrowserWindow({
        title: 'Grotto',
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        minWidth: 1100,
        minHeight: 760,
        resizable: true,
        show: false,
        backgroundColor: '#00000000',
        transparent: process.platform === 'darwin',
        titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
        trafficLightPosition: process.platform === 'darwin' ? macosTrafficLightPosition : undefined,
        vibrancy: process.platform === 'darwin' ? 'menu' : undefined,
        visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.cjs'),
            sandbox: false,
        },
    });

    windows.add(window);
    mainWindow ??= window;

    window.once('ready-to-show', () => {
        window.show();
    });

    window.on('closed', () => {
        windows.delete(window);

        if (mainWindow === window) {
            mainWindow = windows.values().next().value ?? null;
        }
    });

    registerExternalLinkHandlers(window, {
        appUrl,
        openExternal: (url) => shell.openExternal(url),
    });

    void loadWindow(window, route);

    return window;
}

function installDevelopmentDockIcon() {
    if (process.platform !== 'darwin' || app.isPackaged || !app.dock) {
        return;
    }

    const iconPath = path.join(__dirname, 'icons', 'AppIcon.png');
    if (existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
    }
}

async function loadWindow(window, route) {
    await window.loadURL(buildWindowUrl(appUrl, route));
}

function installAppMenu() {
    const template = [
        ...(process.platform === 'darwin'
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { role: 'about' },
                          { type: 'separator' },
                          { role: 'services' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' },
                      ],
                  },
              ]
            : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'Developer',
            submenu: [
                {
                    accelerator: 'CmdOrCtrl+Alt+I',
                    click: () =>
                        (BrowserWindow.getFocusedWindow() ?? mainWindow)?.webContents.openDevTools({
                            mode: 'detach',
                        }),
                    id: openDevtoolsMenuId,
                    label: 'Open Web Inspector',
                },
                {
                    accelerator: 'CmdOrCtrl+Alt+D',
                    click: () => {
                        // Broadcast to every window and content view so all
                        // surfaces flip together; the renderer owns the state.
                        for (const contents of webContents.getAllWebContents()) {
                            contents.send('desktop:dev-mode:toggle');
                        }
                    },
                    id: 'toggle-dev-mode',
                    label: 'Toggle Dev Mode',
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpcHandlers() {
    registerEditContextMenuHandlers({ appUrl, ipcMain });

    ipcMain.handle('desktop:get-info', (event) => {
        assertTrustedRenderer(event, appUrl);
        return {
            isPackaged: app.isPackaged,
            platform: process.platform,
            version: app.getVersion(),
        };
    });

    ipcMain.handle('desktop:window:start-drag', (event) => {
        assertTrustedRenderer(event, appUrl);
    });

    ipcMain.handle('desktop:window:open', (event, route) => {
        assertTrustedRenderer(event, appUrl);
        if (!isSafeWindowRoute(route)) {
            return;
        }

        const opener = BrowserWindow.fromWebContents(event.sender);
        createWindow({ route, openerBounds: opener?.getBounds() });
    });

    ipcMain.handle('desktop:window:close', (event) => {
        assertTrustedRenderer(event, appUrl);
        BrowserWindow.fromWebContents(event.sender)?.close();
    });

    ipcMain.handle('desktop:window:set-theme', (event, theme) => {
        assertTrustedRenderer(event, appUrl);
        nativeTheme.themeSource = theme === 'dark' || theme === 'light' ? theme : 'system';
    });

    ipcMain.handle('desktop:update:check', async (event) => {
        assertTrustedRenderer(event, appUrl);
        await checkForUpdates();
    });

    ipcMain.handle('desktop:update:download', async (event) => {
        assertTrustedRenderer(event, appUrl);
        if (useMockUpdater) {
            await runMockUpdateDownload();
            return;
        }

        await autoUpdater.downloadUpdate();
    });

    ipcMain.handle('desktop:update:restart', (event) => {
        assertTrustedRenderer(event, appUrl);
        if (useMockUpdater) {
            sendUpdateStatus({ phase: 'restarting', version: '999.0.0' });
            return;
        }

        autoUpdater.quitAndInstall(false, true);
    });
}

function startUpdateMonitor() {
    if (useMockUpdater) {
        sendUpdateStatus({ phase: 'available', version: '999.0.0' });
        return;
    }

    if (!app.isPackaged) {
        sendUpdateStatus({ phase: 'unsupported' });
        return;
    }

    void checkForUpdates();
    updateCheckInterval = setInterval(() => {
        void checkForUpdates();
    }, updateCheckIntervalMs);
}

async function checkForUpdates() {
    if (useMockUpdater) {
        sendUpdateStatus({ phase: 'available', version: '999.0.0' });
        return;
    }

    sendUpdateStatus({ phase: 'checking' });

    try {
        const result = await autoUpdater.checkForUpdates();
        if (!result?.updateInfo) {
            sendUpdateStatus({ phase: 'current' });
        }
    } catch (error) {
        sendUpdateStatus({ message: getErrorMessage(error), phase: 'error' });
    }
}

async function runMockUpdateDownload() {
    for (const progress of [0.2, 0.55, 0.85, 1]) {
        sendUpdateStatus({ phase: 'downloading', progress, version: '999.0.0' });
        await new Promise((resolve) => setTimeout(resolve, 120));
    }

    sendUpdateStatus({ phase: 'ready', version: '999.0.0' });
}

autoUpdater.on('update-available', (updateInfo) => {
    availableDesktopUpdateVersion = updateInfo.version;
    sendUpdateStatus({ phase: 'available', version: updateInfo.version });
});

autoUpdater.on('update-not-available', () => {
    availableDesktopUpdateVersion = null;
    sendUpdateStatus({ phase: 'current' });
});

autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
        phase: 'downloading',
        progress: Math.max(0, Math.min(progress.percent / 100, 1)),
        version: availableDesktopUpdateVersion ?? app.getVersion(),
    });
});

autoUpdater.on('update-downloaded', (updateInfo) => {
    availableDesktopUpdateVersion = updateInfo.version;
    sendUpdateStatus({ phase: 'ready', version: updateInfo.version });
});

autoUpdater.on('error', (error) => {
    sendUpdateStatus({ message: getErrorMessage(error), phase: 'error' });
});

function sendUpdateStatus(status) {
    for (const window of windows) {
        window.webContents.send('desktop:update:status', status);
    }
}

function cleanupDevPortsOnce() {
    if (app.isPackaged) {
        return;
    }

    for (const key of ['TAVERN_WEBSITE_PORT']) {
        const port = readPort(key);
        if (port) {
            killProcessesListeningOnPort(port);
        }
    }
}

function readPort(key) {
    const value = Number.parseInt(process.env[key] ?? '', 10);
    return Number.isInteger(value) && value > 0 ? value : null;
}

function killProcessesListeningOnPort(port) {
    execFile('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], (_error, stdout) => {
        for (const pid of stdout
            .toString()
            .split(/\s+/u)
            .map((value) => value.trim())
            .filter(Boolean)) {
            if (pid !== String(process.pid)) {
                process.kill(Number(pid), 'SIGTERM');
            }
        }
    });
}

function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error) {
        return error;
    }

    return 'Grotto could not check for updates.';
}

app.whenReady().then(() => {
    installDevelopmentDockIcon();
    registerNativeClerkRequestHeaders(
        session.defaultSession.webRequest,
        clerkAuthOrigins.clerkOrigin,
        clerkAuthOrigins.appOrigin
    );
    registerIpcHandlers();
    installAppMenu();
    createWindow();
    startUpdateMonitor();
});

app.on('window-all-closed', () => {
    cleanupDevPortsOnce();
    app.quit();
});

app.on('before-quit', () => {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
    }

    cleanupDevPortsOnce();
});
