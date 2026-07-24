import { createRouter } from '../trpc.ts';
import { getBrowserSettingsProcedure } from './browser-settings.ts';
import { openBrowserProcedure } from './open-browser.ts';
import { restartBrowserProcedure } from './restart-browser.ts';
import { saveBrowserSettingsProcedure } from './save-browser-settings.ts';

export const browserRouter = createRouter({
    get: getBrowserSettingsProcedure,
    open: openBrowserProcedure,
    restart: restartBrowserProcedure,
    save: saveBrowserSettingsProcedure,
});
