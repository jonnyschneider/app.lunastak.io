const packageJson = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  }
}

module.exports = nextConfig