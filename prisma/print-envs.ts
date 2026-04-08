#!/usr/bin/env tsx
/**
 * Sanity check: print the DB endpoint each env file is pointing at, with
 * credentials masked. Useful for confirming that .env / .env.preview /
 * .env.production all expose both DATABASE_URL and DATABASE_URL_UNPOOLED
 * and that they point at the right Neon branches.
 */
import { ENV_NAMES, loadDbEnv } from './env'

function maskUrl(url: string): string {
  return url.replace(/:\/\/[^@]+@/, '://***@')
}

for (const name of ENV_NAMES) {
  console.log(`\n[${name}]`)
  try {
    const env = loadDbEnv(name)
    console.log(`  DATABASE_URL          ${maskUrl(env.pooled)}`)
    console.log(`  DATABASE_URL_UNPOOLED ${maskUrl(env.unpooled)}`)
  } catch (err) {
    console.error(`  ERROR: ${(err as Error).message}`)
    process.exitCode = 1
  }
}
