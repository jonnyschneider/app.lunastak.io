const packageJson = require('./package.json')

// Dynamic NEXTAUTH_URL based on environment
const getNextAuthUrl = () => {
  // Production uses custom domain
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://app.lunastak.io'
  }
  // Preview deployments use dynamic Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Localhost fallback
  return 'http://localhost:3000'
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXTAUTH_URL: getNextAuthUrl(),
  },
  experimental: {
    // Include fixture files for runtime seeding
    outputFileTracingIncludes: {
      '/api/auth/[...nextauth]': ['./scripts/seed/fixtures/**/*.json'],
    },
  },
}

module.exports = nextConfig