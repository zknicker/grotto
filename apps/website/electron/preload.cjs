'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tavernDesktop', {
    authTokenGet: () => ipcRenderer.invoke('desktop:auth:token-get'),
    authTokenSet: (token) => ipcRenderer.invoke('desktop:auth:token-set', token),
    onSsoCallback: (listener) => {
        const handler = (_event, url) => listener(url);
        ipcRenderer.on('desktop:auth:sso-callback', handler);
        return () => ipcRenderer.off('desktop:auth:sso-callback', handler);
    },
    openExternal: (url) => ipcRenderer.invoke('desktop:open-external', url),
    onDevModeToggle: (listener) => {
        const handler = () => listener();
        ipcRenderer.on('desktop:dev-mode:toggle', handler);
        return () => ipcRenderer.off('desktop:dev-mode:toggle', handler);
    },
    checkForUpdate: () => ipcRenderer.invoke('desktop:update:check'),
    downloadUpdate: () => ipcRenderer.invoke('desktop:update:download'),
    closeWindow: () => ipcRenderer.invoke('desktop:window:close'),
    getInfo: () => ipcRenderer.invoke('desktop:get-info'),
    openWindow: (route) => ipcRenderer.invoke('desktop:window:open', route),
    onUpdateStatus: (listener) => {
        const handler = (_event, status) => listener(status);
        ipcRenderer.on('desktop:update:status', handler);
        return () => ipcRenderer.off('desktop:update:status', handler);
    },
    restartForUpdate: () => ipcRenderer.invoke('desktop:update:restart'),
    runEditCommand: (command) => ipcRenderer.invoke('desktop:edit:run', command),
    setTheme: (theme) => ipcRenderer.invoke('desktop:window:set-theme', theme),
    startWindowDrag: () => ipcRenderer.invoke('desktop:window:start-drag'),
});
