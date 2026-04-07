/**
 * Single source of truth for loading per-environment DB credentials from
 * the local .env files. Use this instead of grepping env files yourself.
 *
 * Convention (every env file has the same shape):
 *   DATABASE_URL           — pooled connection (used by the running app)
 *   DATABASE_URL_UNPOOLED  — direct connection (used by CLI tools, DDL, DDL diffs)
 *
 * Always prefer DATABASE_URL_UNPOOLED for CLI work — the pgbouncer pooler
 * does not support all DDL operations and tends to drop schema-change
 * statements silently.
 *
 *   import { loadDbEnv, ENV_NAMES } from './env'
 *   const dev = loadDbEnv('dev')        // { pooled, unpooled }
 *   for (const env of ENV_NAMES) { ... } // run a script across all envs
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type EnvName = 'dev' | 'preview' | 'prod'

export const ENV_NAMES: readonly EnvName[] = ['dev', 'preview', 'prod'] as const

interface EnvSpec {
  file: string
  label: EnvName
}

const ENV_FILES: Record<EnvName, EnvSpec> = {
  dev:     { file: '.env',            label: 'dev' },
  preview: { file: '.env.preview',    label: 'preview' },
  prod:    { file: '.env.production', label: 'prod' },
}

export interface DbEnv {
  name: EnvName
  pooled: string
  unpooled: string
}

/**
 * Parse a single env file into a key/value map. Supports the basic dotenv
 * syntax used in this repo: `KEY=value` or `KEY="value"`, comments start
 * with `#`. Does not support escapes, multi-line values, or expansion.
 */
function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {}
  const txt = readFileSync(path, 'utf8')
  const out: Record<string, string> = {}
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function loadDbEnv(name: EnvName): DbEnv {
  const spec = ENV_FILES[name]
  const path = join(process.cwd(), spec.file)
  if (!existsSync(path)) {
    throw new Error(`env file not found: ${spec.file} (for env "${name}")`)
  }
  const parsed = parseEnvFile(path)
  const pooled = parsed.DATABASE_URL
  const unpooled = parsed.DATABASE_URL_UNPOOLED
  if (!pooled || !unpooled) {
    throw new Error(
      `env "${name}" (${spec.file}) is missing DATABASE_URL or DATABASE_URL_UNPOOLED. ` +
      `Both are required — see prisma/drift-baseline/README.md for the convention.`,
    )
  }
  return { name: spec.label, pooled, unpooled }
}

export function loadAllDbEnvs(): DbEnv[] {
  return ENV_NAMES.map((n) => loadDbEnv(n))
}
