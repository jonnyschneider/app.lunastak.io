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
 *
 * ⚠ Blanket `--write` is the blunt instrument: it rewrites EVERY env's baseline,
 * so accidental drift on one env gets blessed alongside the change you meant.
 * That is why SCHEMA_CHANGELOG entries have had to say "must NOT be approved
 * away" — the only available tool was too broad to trust.
 *
 * For drift that is deliberate and pending a deploy, scope it and say why:
 *
 *   npm run db:approve-drift -- --env prod --reason "Evidence table + two
 *     Fragment columns; applied to dev+preview, prod lands at deploy"
 *
 * That writes only `prod.sql` and records the reason in `prod.why.md`. Every
 * later run prints the reason next to the approved drift, so a pending
 * migration announces itself on every push instead of going quiet.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ENV_NAMES, loadDbEnv, type EnvName } from './env'

const BASELINE_DIR = join(process.cwd(), 'prisma', 'drift-baseline')

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

function loadBaseline(envName: EnvName): string | null {
  const path = join(BASELINE_DIR, `${envName}.sql`)
  if (!existsSync(path)) return null
  return normalise(readFileSync(path, 'utf8'))
}

function whyPath(envName: EnvName): string {
  return join(BASELINE_DIR, `${envName}.why.md`)
}

function loadWhy(envName: EnvName): string | null {
  const p = whyPath(envName)
  if (!existsSync(p)) return null
  const first = readFileSync(p, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#'))
  return first ? first.trim() : null
}

function writeWhy(envName: EnvName, reason: string): void {
  const today = new Date().toISOString().slice(0, 10)
  writeFileSync(
    whyPath(envName),
    `# Why \`${envName}\` has approved drift\n\n${reason}\n\n` +
      `Approved ${today}. Clears when the migration is applied to ${envName} — ` +
      `re-run \`npm run db:approve-drift -- --env ${envName} --reason "in sync"\` ` +
      `or, once every env is in sync, plain \`npm run db:approve-drift\`.\n`,
  )
}

function writeBaseline(envName: EnvName, sql: string): void {
  if (!existsSync(BASELINE_DIR)) mkdirSync(BASELINE_DIR, { recursive: true })
  const path = join(BASELINE_DIR, `${envName}.sql`)
  // Always end with a newline so the file is sane in editors.
  writeFileSync(path, sql ? sql + '\n' : '')
}

async function main() {
  const argv = process.argv
  const writeMode = argv.includes('--write')
  const envFlagIdx = argv.indexOf('--env')
  const onlyEnv = envFlagIdx !== -1 ? (argv[envFlagIdx + 1] as EnvName | undefined) : undefined
  const reasonIdx = argv.indexOf('--reason')
  const reason = reasonIdx !== -1 ? argv[reasonIdx + 1] : undefined

  if (onlyEnv && !ENV_NAMES.includes(onlyEnv)) {
    console.error(`unknown --env "${onlyEnv}" (expected one of ${ENV_NAMES.join(', ')})`)
    process.exit(1)
  }
  // A scoped approval must say why. The reason is the whole point: it turns a
  // silent baseline into a pending-deploy note that every future push prints.
  if (writeMode && onlyEnv && !reason) {
    console.error('--env requires --reason "<why this drift is intentional>"')
    process.exit(1)
  }

  let failed = false

  for (const name of ENV_NAMES) {
    if (onlyEnv && name !== onlyEnv) continue
    let env
    try {
      env = loadDbEnv(name)
    } catch (err) {
      console.error(`[${name}] ${(err as Error).message} — skipping`)
      continue
    }

    const actual = diffEnv(env.unpooled)

    if (writeMode) {
      writeBaseline(name, actual)
      if (reason) writeWhy(name, reason)
      console.log(`[${name}] baseline written (${actual.length} chars)${reason ? ' + reason recorded' : ''}`)
      continue
    }

    const baseline = loadBaseline(name)
    if (baseline === null) {
      console.error(`[${name}] FAIL: no baseline at prisma/drift-baseline/${name}.sql`)
      console.error(`  current diff (${actual.length} chars):`)
      console.error(actual ? indent(actual) : '  (empty — env is in sync)')
      console.error(`  run \`npm run db:approve-drift\` to capture this as the baseline`)
      failed = true
      continue
    }

    if (actual === baseline) {
      if (actual.length === 0) {
        console.log(`[${name}] ok (in sync)`)
      } else {
        const why = loadWhy(name)
        console.log(`[${name}] ok (${actual.length} chars of approved drift)`)
        console.log(`  pending: ${why ?? `no reason recorded — see prisma/drift-baseline/${name}.why.md`}`)
      }
      continue
    }

    console.error(`[${name}] FAIL: drift differs from baseline`)
    console.error(`  baseline (${baseline.length} chars):`)
    console.error(indent(baseline) || '  (empty)')
    console.error(`  actual (${actual.length} chars):`)
    console.error(indent(actual) || '  (empty)')
    console.error(`  if this drift is intentional and PENDING A DEPLOY, scope it and say why:`)
    console.error(`    npm run db:approve-drift -- --env ${name} --reason "<why>"`)
    console.error(`  blanket \`npm run db:approve-drift\` rewrites every env — only when all are settled.`)
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
