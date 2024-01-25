/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,

  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      config.devtool = 'source-map';

      // For the server code, Next.js doesn't generate source maps by default. Enable them if needed:
      if (isServer) {
        config.devtool = 'source-map';
      }
    }
    return config;
  }
}

module.exports = nextConfig
