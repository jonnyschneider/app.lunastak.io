/**
 * Validate one or more Project Bundle JSON files against the schema.
 *
 *   npm run bundle:validate                        # all files in src/data/demos/
 *   npm run bundle:validate -- src/data/demos/ferrari.json
 *   npm run bundle:validate -- a.json b.json
 *
 * Exits 0 if all files parse cleanly, 1 if any fail.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { safeParseBundle } from './schema'

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const files = args.length > 0
    ? args
    : readdirSync('src/data/demos').filter((f) => f.endsWith('.json')).map((f) => join('src/data/demos', f))

  let failed = 0
  for (const file of files) {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const result = safeParseBundle(raw)
    if (result.success) {
      console.log(`✓ ${file}`)
    } else {
      failed++
      console.error(`✗ ${file}`)
      for (const issue of result.error.issues) {
        console.error(`    [${issue.path.join('.')}] ${issue.message}`)
      }
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${files.length} bundle(s) failed validation.`)
    process.exit(1)
  }
  console.log(`\nAll ${files.length} bundle(s) valid.`)
}

main()
