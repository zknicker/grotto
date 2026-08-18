'use strict';

const { desktopRuntimeDependencies } = require('./electron/runtime-dependencies.cjs');

const releaseBaseUrl = process.env.TAVERN_RELEASE_BASE_URL?.replace(/\/+$/u, '');

module.exports = {
    appId: 'build.grotto.desktop',
    productName: 'Grotto',
    protocols: [
        {
            name: 'Grotto',
            schemes: ['grotto'],
        },
    ],
    directories: {
        output: 'electron-dist',
    },
    files: [
        'electron/clerk-auth.cjs',
        'electron/clerk-auth-origins.cjs',
        'electron/clerk-loopback-callback.cjs',
        'electron/clerk-native-requests.cjs',
        'electron/edit-context-menu.cjs',
        'electron/external-link-handlers.cjs',
        'electron/main.cjs',
        'electron/preload.cjs',
        'electron/trusted-renderer.cjs',
        'electron/window-routing.cjs',
        'electron/window-state.cjs',
        'package.json',
        '!node_modules/**',
        `node_modules/{${desktopRuntimeDependencies.join(',')}}/**`,
    ],
    extraResources: [
        {
            from: 'electron/generated-icons/Assets.car',
            to: 'Assets.car',
        },
    ],
    mac: {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder artifact macros are literal strings.
        artifactName: '${productName}_${version}_${arch}.${ext}',
        category: 'public.app-category.productivity',
        darkModeSupport: true,
        entitlements: 'electron/Entitlements.plist',
        entitlementsInherit: 'electron/Entitlements.plist',
        extendInfo: {
            CFBundleIconName: 'AppIcon',
            LSMultipleInstancesProhibited: true,
        },
        gatekeeperAssess: false,
        hardenedRuntime: true,
        icon: 'electron/icons/AppIcon.icns',
        notarize: process.env.TAVERN_ELECTRON_NOTARIZE !== '0',
        target: ['dmg', 'zip'],
    },
    publish: releaseBaseUrl
        ? [
              {
                  provider: 'generic',
                  url: releaseBaseUrl,
              },
          ]
        : null,
};
