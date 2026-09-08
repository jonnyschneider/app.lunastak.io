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
  /**
   * A verification build must not clobber a running dev server.
   *
   * `next build` and `next dev` share `.next` by default, so running a build to check something
   * compiles leaves the dev server serving a production manifest — every route 404s until it is
   * restarted. That happened twice in two days (2026-09-08, 2026-09-09) and cost more time each
   * time than the build it was checking.
   *
   * Vercel and `npm run build` are unaffected: the variable is unset there, so this is `.next`.
   * To check a build locally while dev is up:  NEXT_BUILD_DIR=.next-verify npx next build
   */
  distDir: process.env.NEXT_BUILD_DIR || '.next',
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