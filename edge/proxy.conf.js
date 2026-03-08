// HiSense TV API Insights for NPM Terminal
// All API parameter analysis visible in your "npm start" console

const PROXY_CONFIG = {
  '/api/**': {
    target: 'http://localhost:3005',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: { '^/api': '/api' },
  },
};

module.exports = PROXY_CONFIG;
