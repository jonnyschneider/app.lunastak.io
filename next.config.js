
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  }
}

module.exports = nextConfig