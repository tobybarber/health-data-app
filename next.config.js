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
    serverComponentsExternalPackages: ['pdf-parse', 'sharp', 'tesseract.js'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.wasm', './node_modules/**/*.proto', './node_modules/tesseract.js/**/*']
    }
  },
  webpack: (config, { isServer }) => {
    // Fix for tesseract.js dependency issues
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Avoid worker script resolution issues by marking these as externals
    config.externals.push({
      'tesseract.js-core': 'commonjs tesseract.js-core',
      'worker-loader': 'commonjs worker-loader',
    });

    // Fixes npm packages that depend on node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        // Add any other Node.js built-ins that are used by dependencies
      };

      // Suppress React DevTools prompt
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_DISABLE_LOGS === 'true') {
        config.plugins.push(
          new webpack.DefinePlugin({
            '__REACT_DEVTOOLS_GLOBAL_HOOK__': '({ isDisabled: true })'
          })
        );
      }
    }

    // Exclude specific problematic node modules from the bundle
    config.module.rules.push({
      test: /node_modules[/\\](onnxruntime-node|sharp)[/\\].+/,
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