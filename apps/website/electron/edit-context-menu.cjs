'use strict';

const { assertTrustedRenderer } = require('./trusted-renderer.cjs');

const editCommands = new Set(['copy', 'cut', 'paste', 'redo', 'selectAll', 'undo']);

function registerEditContextMenuHandlers({ appUrl, ipcMain }) {
    ipcMain.handle('desktop:edit:run', (event, command) => {
        assertTrustedRenderer(event, appUrl);
        if (!editCommands.has(command)) {
            return;
        }

        event.sender[command]();
    });
}

module.exports = {
    registerEditContextMenuHandlers,
};
