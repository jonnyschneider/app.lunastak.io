#!/usr/bin/env tsx
/**
 * Replay captured pipeline-stage payloads against each model arm.
 *
 * Phase 2 of the model-bump experiment. Phase 1's live pass captures each
 * stage's resolved request (LUNASTAK_CAPTURE_DIR); this replays those exact
 * payloads against every arm in isolation, so a quality difference can be
 * attributed to a STAGE rather than to better input arriving from upstream.
 *
 * Dry-run by default — prints the matrix and the projected cost, sends nothing.
 * Use --apply to actually call the API.
 *
 * Usage:
 *   npm run experiment:replay -- --captures docs/_experiments/2026-08-26-model-bump/captures
 *   npm run experiment:replay -- --captures <dir> --apply
 *   npm run experiment:replay -- --captures <dir> --apply --n 3 --stage strategy_generation
 *
 * Design: docs/_plans/2026-08-26-model-bump-measurement-protocol-design.md
 */
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import Anthropic from '@anthropic-ai/sdk'
import { costUsd } from '../../src/lib/experiment/pricing'
import {
  stripUnsupportedParams,
  maxTokensFor,
  timeoutFor,
  DEFAULT_MODEL,
} from '../../src/lib/model-config'

const ARMS = [
  { arm: 'A-control', model: DEFAULT_MODEL },
  { arm: 'B-sonnet5', model: 'claude-sonnet-5' },
  { arm: 'C-opus5', model: 'claude-opus-5' },
]

interface Capture {
  context: string
  model: string | null
  request: { model: string; max_tokens: number; messages: unknown[]; system?: unknown }
  inputTokens: number
  outputTokens: number
}

interface Row {
  stage: string
  arm: string
  model: string
  run: number
  inputTokens: number
  outputTokens: number
  latencyMs: number
  stopReason: string
  truncated: boolean
  costUsd: number
  error?: string
}

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? fallback : process.argv[i + 1]
}
const has = (flag: string) => process.argv.includes(flag)

function loadCaptures(dir: string): Capture[] {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Capture dir not found: ${dir}`)
    console.error('   Run Phase 1 first with LUNASTAK_CAPTURE_DIR set.')
    process.exit(1)
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  return files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Capture)
}

/** One capture per stage — the first. Later runs of the same stage are near-duplicates. */
function oneStagePerContext(caps: Capture[], only?: string): Capture[] {
  const seen = new Set<string>()
  const out: Capture[] = []
  for (const c of caps) {
    if (only && c.context !== only) continue
    if (seen.has(c.context)) continue
    seen.add(c.context)
    out.push(c)
  }
  return out
}

async function main() {
  const capturesDir = arg('--captures')
  if (!capturesDir) {
    console.error('❌ --captures <dir> is required')
    process.exit(1)
  }

  const outDir = arg('--out', path.join(path.dirname(capturesDir), 'outputs'))!
  const apply = has('--apply')
  const n = Number(arg('--n', '1'))
  const stage = arg('--stage')

  const captures = oneStagePerContext(loadCaptures(capturesDir), stage)

  if (captures.length === 0) {
    console.error('❌ No captures matched. Nothing to replay.')
    process.exit(1)
  }

  console.log(`\n📼 ${captures.length} stage(s) × ${ARMS.length} arm(s) × ${n} run(s) = ${captures.length * ARMS.length * n} calls`)
  console.log(`   captures: ${capturesDir}`)
  console.log(`   outputs:  ${outDir}`)

  // Cost estimate from the observed token counts of the live pass.
  let estimate = 0
  for (const c of captures) {
    for (const { model } of ARMS) {
      estimate += costUsd(model, c.inputTokens || 0, c.outputTokens || 0) * n
    }
  }
  console.log(`   estimated cost: $${estimate.toFixed(4)} (from Phase 1 observed token counts)\n`)

  for (const c of captures) {
    console.log(`   • ${c.context.padEnd(32)} in≈${c.inputTokens} out≈${c.outputTokens}`)
  }

  if (!apply) {
    console.log('\n🔍 Dry run — nothing sent. Re-run with --apply to execute.\n')
    return
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 })
  const rows: Row[] = []

  for (const cap of captures) {
    for (const { arm, model } of ARMS) {
      for (let run = 1; run <= n; run++) {
        // Re-shape for the target arm using the SAME logic production uses, so
        // the replay is not a special case that could diverge from the app.
        const request = stripUnsupportedParams({
          ...cap.request,
          model,
          max_tokens: maxTokensFor(model, cap.request.max_tokens),
        })

        const label = `${cap.context} · ${arm} · run ${run}`
        process.stdout.write(`   → ${label} … `)

        const startedAt = Date.now()
        try {
          const res = await client.messages.create(request as never, { timeout: timeoutFor(model) })
          const latencyMs = Date.now() - startedAt

          const text = res.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map(b => b.text)
            .join('')

          const truncated = res.stop_reason === 'max_tokens'

          rows.push({
            stage: cap.context,
            arm,
            model: res.model,
            run,
            inputTokens: res.usage.input_tokens,
            outputTokens: res.usage.output_tokens,
            latencyMs,
            stopReason: res.stop_reason ?? '',
            truncated,
            costUsd: costUsd(res.model, res.usage.input_tokens, res.usage.output_tokens),
          })

          const dir = path.join(outDir, arm)
          fs.mkdirSync(dir, { recursive: true })
          const suffix = n > 1 ? `-run${run}` : ''
          fs.writeFileSync(
            path.join(dir, `${cap.context}${suffix}.md`),
            // Front-matter free of the arm name would be better for blind scoring,
            // but the file lives under outputs/<arm>/ anyway — strip on collation.
            `<!-- stage: ${cap.context} | run: ${run} -->\n\n${text}\n`
          )

          console.log(`${latencyMs}ms · ${res.usage.output_tokens} out${truncated ? ' · ⚠ TRUNCATED' : ''}`)
          if (truncated) {
            console.log(`     ⚠ ${cap.context}/${arm} hit max_tokens — INVALID for scoring. Raise LUNASTAK_THINKING_HEADROOM and re-run this stage.`)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.log(`❌ ${message}`)
          rows.push({
            stage: cap.context, arm, model, run,
            inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - startedAt,
            stopReason: 'error', truncated: false, costUsd: 0, error: message,
          })
        }
      }
    }
  }

  // metrics.csv
  fs.mkdirSync(outDir, { recursive: true })
  const csvPath = path.join(path.dirname(outDir), 'metrics.csv')
  const header = 'stage,arm,model,run,input_tokens,output_tokens,latency_ms,stop_reason,truncated,cost_usd,error'
  const lines = rows.map(r => [
    r.stage, r.arm, r.model, r.run, r.inputTokens, r.outputTokens, r.latencyMs,
    r.stopReason, r.truncated, r.costUsd.toFixed(6), (r.error ?? '').replace(/[,\n]/g, ' '),
  ].join(','))
  fs.writeFileSync(csvPath, [header, ...lines].join('\n') + '\n')

  // Summary
  console.log('\n📊 Cost by arm:')
  for (const { arm } of ARMS) {
    const armRows = rows.filter(r => r.arm === arm)
    const total = armRows.reduce((s, r) => s + r.costUsd, 0)
    const meanLatency = armRows.length
      ? Math.round(armRows.reduce((s, r) => s + r.latencyMs, 0) / armRows.length)
      : 0
    console.log(`   ${arm.padEnd(12)} $${total.toFixed(4)}  mean ${meanLatency}ms`)
  }

  const truncations = rows.filter(r => r.truncated)
  const errors = rows.filter(r => r.error)
  if (truncations.length) {
    console.log(`\n⚠ ${truncations.length} truncated call(s) — those stage/arm pairs are INVALID for scoring:`)
    for (const t of truncations) console.log(`   ${t.stage} · ${t.arm}`)
  }
  if (errors.length) {
    console.log(`\n❌ ${errors.length} failed call(s):`)
    for (const e of errors) console.log(`   ${e.stage} · ${e.arm}: ${e.error}`)
  }

  console.log(`\n✅ metrics → ${csvPath}`)
  console.log(`   outputs → ${outDir}/<arm>/<stage>.md\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
