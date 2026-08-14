const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// Metro loads this file as CommonJS; __dirname is the stable app-root contract here.
// biome-ignore lint/correctness/noGlobalDirnameFilename: Metro config is CommonJS.
const config = getDefaultConfig(__dirname);
const reanimatedConfig = wrapWithReanimatedMetroConfig(config);

module.exports = withUniwindConfig(reanimatedConfig, {
    cssEntryFile: './src/global.css',
    dtsFile: './src/uniwind-types.d.ts',
});
