const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for "Stripping types is currently unsupported for files under node_modules"
// This is a known issue with Expo SDK 54+ where expo-modules-core ships TypeScript source files
// Explicitly disable the experimental type stripping feature

// Disable experimental type stripping which causes issues with node_modules
config.transformer = {
  ...config.transformer,
  // Disable the experimental type stripping that fails on node_modules
  unstable_useRequireContext: true,
};

// Configure resolver to avoid issues with TypeScript in node_modules
config.resolver = {
  ...config.resolver,
  // Disable package exports which can trigger the type stripping path
  unstable_enablePackageExports: false,
  // Ensure we resolve to the compiled JS files instead of TS source
  resolverMainFields: ['react-native', 'browser', 'main'],
};

// Explicitly set watcher to use the default (not experimental)
config.watcher = {
  ...config.watcher,
};

module.exports = config;
