const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Proxy /api and /socket.io requests to the API server on port 4000
  config.devServer = config.devServer || {};
  config.devServer.proxy = {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:4000',
      changeOrigin: true,
      ws: true,
    },
  };

  return config;
};
