const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro can resolve packages from the root
config.watchFolders = [monorepoRoot];

// Let Metro resolve modules from the monorepo root node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Proxy /api and /socket.io requests to the Express API on port 4000
// This allows the Expo web dev server to forward API calls, avoiding
// cross-origin issues when running in the preview environment.
config.server = config.server || {};
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const apiProxy = createProxyMiddleware({
    target: 'http://localhost:4000',
    changeOrigin: true,
    logLevel: 'silent',
  });

  return (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
      return apiProxy(req, res, next);
    }
    return metroMiddleware(req, res, next);
  };
};

// Mock react-native-reanimated on web to avoid native-only startup errors
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-reanimated') {
    return context.resolveRequest(context, 'react-native-reanimated/mock', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
