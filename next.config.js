/** @type {import('next').NextConfig} */
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
  webpack: (config) => {
    // Fix for tesseract.js dependency issues
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Avoid worker script resolution issues by marking these as externals
    config.externals.push({
      'tesseract.js-core': 'commonjs tesseract.js-core',
      'worker-loader': 'commonjs worker-loader',
    });

    return config;
  },
  env: {
    // Set Tesseract data directory location
    TESSDATA_PREFIX: 'C:\\Program Files\\Tesseract-OCR\\tessdata',
  },
}

module.exports = nextConfig 