'use strict';

const assetCatalogPath = 'electron/generated-icons/Assets.car';

function macAppIconConfiguration(hasAssetCatalog) {
    return {
        extendInfo: {
            ...(hasAssetCatalog ? { CFBundleIconName: 'AppIcon' } : {}),
            LSMultipleInstancesProhibited: true,
        },
        extraResources: hasAssetCatalog
            ? [
                  {
                      from: assetCatalogPath,
                      to: 'Assets.car',
                  },
              ]
            : [],
    };
}

module.exports = { assetCatalogPath, macAppIconConfiguration };
