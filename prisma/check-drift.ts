#!/usr/bin/env tsx
/**
 * Schema drift check.
 *
 * For each known environment (dev / preview / prod), runs
 *   prisma migrate diff --from-url <env> --to-schema-datamodel ./prisma/schema.prisma --script
 * which produces the SQL needed to make the live DB match schema.prisma. The
 * normalised output is compared to a checked-in baseline at
 * `prisma/drift-baseline/<env>.sql`.
 *
 * - If the diff matches the baseline → no unexpected drift, exit 0.
 * - If the diff differs from the baseline → drift the user hasn't acked,
 *   print both side and exit 1 so pre-push fails.
 * - If the baseline file doesn't exist → fail with instructions to run
 *   `npm run db:approve-drift`.
 *
 * "No drift" is represented by an empty baseline file. Known/intentional
 * drift (e.g. legacy tables awaiting a final drop) lives in the baseline
 * SQL — that way the file *itself* is the audit trail of what's still out
 * of sync and why.
 *
 * The script also accepts `--write` which captures the current diffs to
 * the baseline files instead of comparing. That's the implementation behind
 * `npm run db:approve-drift` — never call it manually unless you mean it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

interface EnvSpec {
  name: 'dev' | 'preview' | 'prod'
  envFile: string
  varName: string
}

const ENVS: EnvSpec[] = [
  { name: 'dev',     envFile: '.env',            varName: 'DATABASE_URL_UNPOOLED' },
  { name: 'preview', envFile: '.env.preview',    varName: 'DATABASE_URL_UNPOOLED' },
  { name: 'prod',    envFile: '.env.production', varName: 'DATABASE_URL_UNPOOLED' },
]

const BASELINE_DIR = join(process.cwd(), 'prisma', 'drift-baseline')

function readEnvVar(file: string, key: string): string | null {
  if (!existsSync(file)) return null
  const txt = readFileSync(file, 'utf8')
  const m = txt.match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
  return m ? m[1] : null
}

function diffEnv(url: string): string {
  // prisma migrate diff prints the SQL to stdout. With --exit-code, exit 2
  // means "diff is non-empty" — which is the *normal* case for an env we
  // expect to be in sync (it'd exit 0 then). We don't want that to crash
  // execFileSync, so we catch and read .stdout off the error.
  try {
    const out = execFileSync(
      'npx',
      [
        'prisma', 'migrate', 'diff',
        '--from-url', url,
        '--to-schema-datamodel', './prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return normalise(out)
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string }
    if (e.stdout != null) return normalise(e.stdout)
    throw new Error(`prisma migrate diff failed: ${e.stderr || String(err)}`)
  }
}

function normalise(sql: string): string {
  // Strip prisma's "-- This is an empty migration." marker so an in-sync env
  // produces a literally empty string.
  return sql
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l !== '' && l !== '-- This is an empty migration.')
    .join('\n')
    .trimEnd()
}

function loadBaseline(envName: string): string | null {
  const path = join(BASELINE_DIR, `${envName}.sql`)
  if (!existsSync(path)) return null
  return normalise(readFileSync(path, 'utf8'))
}

function writeBaseline(envName: string, sql: string): void {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true })
  const path = join(BASELINE_DIR, `${envName}.sql`)
  // Always end with a newline so the file is sane in editors.
  writeFileSync(path, sql ? sql + '\n' : '')
}

async function main() {
  const writeMode = process.argv.includes('--write')
  let failed = false

  for (const env of ENVS) {
    const url = readEnvVar(env.envFile, env.varName)
    if (!url) {
      console.error(`[${env.name}] no ${env.varName} in ${env.envFile} — skipping`)
      continue
    }

    const actual = diffEnv(url)

    if (writeMode) {
      writeBaseline(env.name, actual)
      console.log(`[${env.name}] baseline written (${actual.length} chars)`)
      continue
    }

    const baseline = loadBaseline(env.name)
    if (baseline === null) {
      console.error(`[${env.name}] FAIL: no baseline at prisma/drift-baseline/${env.name}.sql`)
      console.error(`  current diff (${actual.length} chars):`)
      console.error(actual ? indent(actual) : '  (empty — env is in sync)')
      console.error(`  run \`npm run db:approve-drift\` to capture this as the baseline`)
      failed = true
      continue
    }

    if (actual === baseline) {
      console.log(`[${env.name}] ok (${actual.length === 0 ? 'in sync' : `${actual.length} chars of approved drift`})`)
      continue
    }

    console.error(`[${env.name}] FAIL: drift differs from baseline`)
    console.error(`  baseline (${baseline.length} chars):`)
    console.error(indent(baseline) || '  (empty)')
    console.error(`  actual (${actual.length} chars):`)
    console.error(indent(actual) || '  (empty)')
    console.error(`  if this drift is intentional, run \`npm run db:approve-drift\``)
    failed = true
  }

  if (failed) {
    console.error('\nschema drift check FAILED. push blocked.')
    process.exit(1)
  }
}

function indent(s: string): string {
  return s.split('\n').map((l) => '    ' + l).join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
