#!/usr/bin/env tsx
/**
 * Validate Fixtures
 *
 * Validates all fixture files against data contracts.
 * Run: npx tsx scripts/seed/validate.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  validateEmergentExtraction,
  validatePrescriptiveExtraction,
  isValidDimension,
} from '../../src/lib/contracts';
import type { Fixture } from './types';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

interface ValidationError {
  fixture: string;
  path: string;
  message: string;
}

function validateFixture(filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const fixtureName = path.basename(filePath);

  let fixture: Fixture;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    fixture = JSON.parse(content);
  } catch (e) {
    errors.push({
      fixture: fixtureName,
      path: 'root',
      message: `Failed to parse JSON: ${(e as Error).message}`,
    });
    return errors;
  }

  // Validate template
  if (!fixture.template?.name) {
    errors.push({
      fixture: fixtureName,
      path: 'template.name',
      message: 'Missing template name',
    });
  }

  // Validate user
  if (!fixture.user?.email) {
    errors.push({
      fixture: fixtureName,
      path: 'user.email',
      message: 'Missing user email placeholder',
    });
  }

  // Validate each project
  fixture.projects?.forEach((project, pIdx) => {
    const projectPath = `projects[${pIdx}]`;

    if (!project.id) {
      errors.push({
        fixture: fixtureName,
        path: `${projectPath}.id`,
        message: 'Missing project ID placeholder',
      });
    }

    // Validate fragments
    project.fragments?.forEach((fragment, fIdx) => {
      const fragPath = `${projectPath}.fragments[${fIdx}]`;

      // Check dimension tags
      fragment.dimensionTags?.forEach((tag, tIdx) => {
        if (!isValidDimension(tag.dimension)) {
          errors.push({
            fixture: fixtureName,
            path: `${fragPath}.dimensionTags[${tIdx}].dimension`,
            message: `Invalid dimension: ${tag.dimension}`,
          });
        }
      });
    });

    // Validate conversations
    project.conversations?.forEach((conv, cIdx) => {
      const convPath = `${projectPath}.conversations[${cIdx}]`;

      // Validate traces
      conv.traces?.forEach((trace, tIdx) => {
        const tracePath = `${convPath}.traces[${tIdx}]`;

        if (trace.extractedContext) {
          const variant = conv.experimentVariant || '';
          const isBaseline = variant.includes('baseline');

          if (isBaseline) {
            if (!validatePrescriptiveExtraction(trace.extractedContext)) {
              errors.push({
                fixture: fixtureName,
                path: `${tracePath}.extractedContext`,
                message: 'Invalid prescriptive extraction format',
              });
            }
          } else if (trace.extractedContext && Object.keys(trace.extractedContext).length > 0) {
            // Only validate emergent if there's actual content
            if (!validateEmergentExtraction(trace.extractedContext)) {
              errors.push({
                fixture: fixtureName,
                path: `${tracePath}.extractedContext`,
                message: 'Invalid emergent extraction format',
              });
            }
          }
        }
      });
    });

    // Validate documents
    project.documents?.forEach((doc, dIdx) => {
      const docPath = `${projectPath}.documents[${dIdx}]`;

      if (!['pending', 'processing', 'complete', 'failed'].includes(doc.status)) {
        errors.push({
          fixture: fixtureName,
          path: `${docPath}.status`,
          message: `Invalid document status: ${doc.status}`,
        });
      }
    });
  });

  return errors;
}

async function main() {
  console.log('\nValidating fixtures...\n');

  const fixtureFiles = fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.json'));

  if (fixtureFiles.length === 0) {
    console.log('No fixture files found in scripts/seed/fixtures/\n');
    process.exit(0);
  }

  let totalErrors = 0;

  for (const file of fixtureFiles) {
    const filePath = path.join(FIXTURES_DIR, file);
    const errors = validateFixture(filePath);

    if (errors.length === 0) {
      console.log(`[PASS] ${file}`);
    } else {
      console.log(`[FAIL] ${file}`);
      errors.forEach(err => {
        console.log(`   - ${err.path}: ${err.message}`);
      });
      totalErrors += errors.length;
    }
  }

  console.log();

  if (totalErrors > 0) {
    console.log(`Found ${totalErrors} validation error(s)\n`);
    process.exit(1);
  } else {
    console.log('All fixtures valid!\n');
    process.exit(0);
  }
}

main();
