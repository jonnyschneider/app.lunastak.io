/**
 * Project Bundle Contract Tests
 *
 * Two guarantees:
 *
 *   1. Every committed bundle file (src/data/demos/*.json) is a valid bundle.
 *      Catches drift between the bundles on disk and the schema.
 *
 *   2. The schema's JSON Schema representation is snapshot-tested.
 *      Any structural change to the bundle shape fails the snapshot, forcing
 *      an intentional `BUNDLE_VERSION` bump and `npm test -- -u` to update.
 *
 * Both gates exist to keep the egress/ingress boundary stable. External tooling
 * (LLM connectors, manual editing, future user-facing import) all depend on
 * this contract.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  BUNDLE_VERSION,
  ProjectBundleSchema,
  parseBundle,
  safeParseBundle,
} from '../../../../tools/project-bundle/schema'

const DEMOS_DIR = join(process.cwd(), 'src', 'data', 'demos')

describe('Project Bundle contracts', () => {
  describe('committed bundles', () => {
    const files = readdirSync(DEMOS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(DEMOS_DIR, f))

    test('at least one bundle exists in src/data/demos/', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    test.each(files)('%s parses as a valid ProjectBundle', (file) => {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const result = safeParseBundle(raw)
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `  [${i.path.join('.')}] ${i.message}`)
          .join('\n')
        throw new Error(`Bundle ${file} failed validation:\n${issues}`)
      }
      expect(result.data.bundleVersion).toBe(BUNDLE_VERSION)
    })
  })

  describe('schema shape', () => {
    test('JSON Schema is stable (snapshot)', () => {
      const json = zodToJsonSchema(ProjectBundleSchema, {
        name: 'ProjectBundle',
        $refStrategy: 'none',
      })
      expect(json).toMatchSnapshot()
    })

    test('round-trip: parse → serialise → parse equals original', () => {
      // Use the smallest committed bundle as a fixture
      const files = readdirSync(DEMOS_DIR).filter((f) => f.endsWith('.json'))
      expect(files.length).toBeGreaterThan(0)
      const file = join(DEMOS_DIR, files[0])
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const parsed = parseBundle(raw)
      const serialised = JSON.stringify(parsed)
      const reparsed = parseBundle(JSON.parse(serialised))
      expect(reparsed).toEqual(parsed)
    })

    test('rejects bundles missing bundleVersion', () => {
      const result = safeParseBundle({ projectId: 'x', projectName: 'y' })
      expect(result.success).toBe(false)
    })

    test('rejects bundles with wrong bundleVersion', () => {
      const valid = parseBundle(
        JSON.parse(readFileSync(join(DEMOS_DIR, readdirSync(DEMOS_DIR).find((f) => f.endsWith('.json'))!), 'utf8')),
      )
      const result = safeParseBundle({ ...valid, bundleVersion: 999 })
      expect(result.success).toBe(false)
    })

    test('rejects components missing id', () => {
      const valid = parseBundle(
        JSON.parse(readFileSync(join(DEMOS_DIR, readdirSync(DEMOS_DIR).find((f) => f.endsWith('.json'))!), 'utf8')),
      )
      const broken = {
        ...valid,
        decisionStack: {
          ...valid.decisionStack,
          objectives: [{ title: 'no id here' }],
        },
      }
      const result = safeParseBundle(broken)
      expect(result.success).toBe(false)
    })
  })
})
