'use strict';

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
        'dist/**',
        'electron/clerk-auth.cjs',
        'electron/edit-context-menu.cjs',
        'electron/external-link-handlers.cjs',
        'electron/main.cjs',
        'electron/preload.cjs',
        'electron/window-routing.cjs',
        'package.json',
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
