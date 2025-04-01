/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.wasm', './node_modules/**/*.proto']
    }
  },
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
      };

      // Suppress React DevTools prompt in production
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_DISABLE_LOGS === 'true') {
        config.plugins.push(
          new webpack.DefinePlugin({
            '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })'
          })
        );
      }
    }

    // Exclude sharp from the bundle as it's used server-side
    config.module.rules.push({
      test: /node_modules[/\\]sharp[/\\].+/,
      use: 'null-loader',
    });

    return config;
  },
  env: {
    // Disable console logging in browser
    NEXT_PUBLIC_DISABLE_LOGS: 'true',
  },
}

module.exports = nextConfig 