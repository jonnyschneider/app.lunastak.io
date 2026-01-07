# Test Data Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish environment isolation with Vercel Postgres and a fixture-based test data system for demos, development, and testing.

**Architecture:** Three Vercel Postgres databases (prod/preview/dev) with JSON fixtures in `scripts/seed/fixtures/`. Hydration and export scripts validate against existing data contracts. CLI-driven with safety flags.

**Tech Stack:** Vercel Postgres, Prisma, TypeScript (tsx), existing data contracts from `src/lib/contracts/`

---

## Phase 1: Environment Separation

### Task 1: Create Vercel Postgres Databases

**Context:** Currently all environments share one Prisma Postgres database. We need three separate databases.

**Step 1: Create production database**

1. Go to Vercel Dashboard → Storage → Create Database → Postgres
2. Name: `lunastak-prod`
3. Region: Same as your deployment (likely `syd1` for Australia)
4. Copy the connection string - you'll need it in Step 4

**Step 2: Create preview database**

1. Vercel Dashboard → Storage → Create Database → Postgres
2. Name: `lunastak-preview`
3. Same region as production
4. Copy the connection string

**Step 3: Create development database**

1. Vercel Dashboard → Storage → Create Database → Postgres
2. Name: `lunastak-dev`
3. Same region as production
4. Copy the connection string

**Step 4: Document connection strings**

Create a temporary local file (DO NOT COMMIT):

```bash
# /tmp/lunastak-db-urls.txt
PROD: postgres://...
PREVIEW: postgres://...
DEV: postgres://...
```

---

### Task 2: Configure Vercel Environment Variables

**Step 1: Set production DATABASE_URL**

1. Vercel Dashboard → Project Settings → Environment Variables
2. Add `DATABASE_URL` with value from `lunastak-prod`
3. Scope: Production only

**Step 2: Set preview DATABASE_URL**

1. Same page, add another `DATABASE_URL`
2. Value from `lunastak-preview`
3. Scope: Preview only

**Step 3: Verify configuration**

In Vercel Environment Variables, you should see:
- `DATABASE_URL` (Production) → lunastak-prod connection string
- `DATABASE_URL` (Preview) → lunastak-preview connection string

---

### Task 3: Update Local Environment

**Files:**
- Modify: `.env.local`

**Step 1: Update DATABASE_URL to dev database**

Edit `.env.local`:

```bash
# Old (remove these):
# DATABASE_URL="postgres://...prisma.io..."
# POSTGRES_URL="postgres://...prisma.io..."
# PRISMA_DATABASE_URL="prisma+postgres://..."

# New (add this):
DATABASE_URL="postgres://[YOUR_LUNASTAK_DEV_CONNECTION_STRING]"
```

**Step 2: Remove Prisma-specific variables**

Delete these lines from `.env.local`:
- `POSTGRES_URL`
- `PRISMA_DATABASE_URL`
- `VERCEL_OIDC_TOKEN` (if present, regenerate via Vercel CLI if needed)

---

### Task 4: Push Schema to All Databases

**Step 1: Push schema to dev database**

```bash
npx prisma db push
```

Expected: Schema created successfully

**Step 2: Push schema to preview database**

```bash
DATABASE_URL="[PREVIEW_CONNECTION_STRING]" npx prisma db push
```

Expected: Schema created successfully

**Step 3: Push schema to production database**

```bash
DATABASE_URL="[PROD_CONNECTION_STRING]" npx prisma db push
```

Expected: Schema created successfully

**Step 4: Verify all databases**

```bash
# Check dev
npx prisma studio
# Should open browser showing empty tables

# Check preview (in another terminal)
DATABASE_URL="[PREVIEW_CONNECTION_STRING]" npx prisma studio
```

**Step 5: Commit environment changes**

```bash
git add -A
git commit -m "chore: configure environment separation for Vercel Postgres"
```

---

## Phase 2: Fixture System Foundation

### Task 5: Create Directory Structure and Types

**Files:**
- Create: `scripts/seed/fixtures/.gitkeep`
- Create: `scripts/seed/types.ts`

**Step 1: Create directory structure**

```bash
mkdir -p scripts/seed/fixtures
touch scripts/seed/fixtures/.gitkeep
```

**Step 2: Create fixture type definitions**

Create `scripts/seed/types.ts`:

```typescript
/**
 * Fixture Types
 *
 * Defines the shape of JSON fixture files for test data hydration.
 */

// Fixture metadata
export interface FixtureTemplate {
  name: string;
  description: string;
}

// User in fixture (email is placeholder)
export interface FixtureUser {
  name: string;
  email: string; // "{{EMAIL}}" placeholder
}

// Message in fixture
export interface FixtureMessage {
  role: 'assistant' | 'user';
  content: string;
  stepNumber: number;
  confidenceScore?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceReasoning?: string;
}

// Trace in fixture
export interface FixtureTrace {
  extractedContext: Record<string, unknown>;
  dimensionalCoverage?: Record<string, unknown>;
  output: Record<string, unknown>;
  claudeThoughts?: string;
  modelUsed: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  starred?: boolean;
}

// Conversation in fixture
export interface FixtureConversation {
  id: string; // "{{CONV_N_ID}}" placeholder
  title?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  currentPhase: string;
  selectedLens?: string;
  questionCount: number;
  experimentVariant?: string;
  messages: FixtureMessage[];
  traces: FixtureTrace[];
}

// Fragment in fixture
export interface FixtureFragment {
  id: string; // "{{FRAG_N_ID}}" placeholder
  content: string;
  contentType: 'theme';
  status: 'active';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  conversationId?: string; // Reference to "{{CONV_N_ID}}"
  documentId?: string;
  dimensionTags: Array<{
    dimension: string;
    confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

// Deep dive in fixture
export interface FixtureDeepDive {
  id: string; // "{{DD_N_ID}}" placeholder
  topic: string;
  notes?: string;
  status: 'pending' | 'active' | 'resolved';
  origin: 'manual' | 'message' | 'document';
}

// Document in fixture
export interface FixtureDocument {
  id: string; // "{{DOC_N_ID}}" placeholder
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  uploadContext?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  deepDiveId?: string;
}

// Project in fixture
export interface FixtureProject {
  id: string; // "{{PROJECT_ID}}" placeholder
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  knowledgeSummary?: string;
  suggestedQuestions: string[];
  conversations: FixtureConversation[];
  fragments: FixtureFragment[];
  deepDives: FixtureDeepDive[];
  documents: FixtureDocument[];
}

// Complete fixture file
export interface Fixture {
  template: FixtureTemplate;
  user: FixtureUser;
  projects: FixtureProject[];
}

// Hydration options
export interface HydrateOptions {
  fixture: string;
  email: string;
  variantOverride?: string;
  reset?: boolean;
  dryRun?: boolean;
  production?: boolean;
}

// Export options
export interface ExportOptions {
  email?: string;
  conversationId?: string;
  output: string;
}
```

**Step 3: Commit**

```bash
git add scripts/seed/
git commit -m "feat(seed): add fixture types and directory structure"
```

---

### Task 6: Create Fixture Validation Script

**Files:**
- Create: `scripts/seed/validate.ts`

**Step 1: Create validation script**

Create `scripts/seed/validate.ts`:

```typescript
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
  validateFragment,
  validateDocument,
  validateEmergentExtraction,
  validatePrescriptiveExtraction,
  isValidDimension,
} from '../../src/lib/contracts';
import type { Fixture, FixtureFragment, FixtureConversation } from './types';

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
  console.log('\n🔍 Validating fixtures...\n');

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
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file}`);
      errors.forEach(err => {
        console.log(`   └─ ${err.path}: ${err.message}`);
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
```

**Step 2: Test with empty fixtures directory**

```bash
npx tsx scripts/seed/validate.ts
```

Expected: "No fixture files found in scripts/seed/fixtures/"

**Step 3: Commit**

```bash
git add scripts/seed/validate.ts
git commit -m "feat(seed): add fixture validation script"
```

---

### Task 7: Create Hydration Script

**Files:**
- Create: `scripts/seed/hydrate.ts`

**Step 1: Create hydration script**

Create `scripts/seed/hydrate.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Hydrate Database from Fixture
 *
 * Usage:
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com --reset
 *   npx tsx scripts/seed/hydrate.ts --fixture demo-dogfood --email demo@example.com --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../src/lib/db';
import type { Fixture, HydrateOptions } from './types';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function generateCuid(): string {
  // Simple CUID-like generator for placeholders
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

function parseArgs(): HydrateOptions {
  const args = process.argv.slice(2);
  const options: Partial<HydrateOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fixture':
        options.fixture = args[++i];
        break;
      case '--email':
        options.email = args[++i];
        break;
      case '--variant':
        options.variantOverride = args[++i];
        break;
      case '--reset':
        options.reset = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--production':
        options.production = true;
        break;
    }
  }

  if (!options.fixture || !options.email) {
    console.error('\n❌ Missing required arguments\n');
    console.log('Usage: npx tsx scripts/seed/hydrate.ts --fixture <name> --email <email>\n');
    console.log('Options:');
    console.log('  --fixture <name>    Fixture name (without .json)');
    console.log('  --email <email>     Email for the user account');
    console.log('  --variant <variant> Override experiment variant');
    console.log('  --reset             Delete existing user data first');
    console.log('  --dry-run           Preview without writing');
    console.log('  --production        Allow running against production DB\n');
    process.exit(1);
  }

  return options as HydrateOptions;
}

async function checkEnvironment(options: HydrateOptions): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes('lunastak-prod') ||
                       process.env.VERCEL_ENV === 'production';

  if (isProduction && !options.production) {
    console.error('\n❌ Refusing to run against production database');
    console.error('Use --production flag if you really mean it\n');
    process.exit(1);
  }

  if (isProduction && options.production) {
    console.log('\n⚠️  WARNING: Running against PRODUCTION database\n');
  }
}

async function hydrate(options: HydrateOptions): Promise<void> {
  const fixturePath = path.join(FIXTURES_DIR, `${options.fixture}.json`);

  if (!fs.existsSync(fixturePath)) {
    console.error(`\n❌ Fixture not found: ${fixturePath}\n`);
    process.exit(1);
  }

  console.log(`\n📦 Loading fixture: ${options.fixture}\n`);

  const fixture: Fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  // Generate ID mappings
  const idMap = new Map<string, string>();

  // Map project IDs
  fixture.projects.forEach((p, i) => {
    idMap.set(p.id, generateCuid());
  });

  // Map conversation IDs
  fixture.projects.forEach(p => {
    p.conversations.forEach((c, i) => {
      idMap.set(c.id, generateCuid());
    });
  });

  // Map fragment IDs
  fixture.projects.forEach(p => {
    p.fragments.forEach((f, i) => {
      idMap.set(f.id, generateCuid());
    });
  });

  // Map deep dive IDs
  fixture.projects.forEach(p => {
    p.deepDives?.forEach((dd, i) => {
      idMap.set(dd.id, generateCuid());
    });
  });

  // Map document IDs
  fixture.projects.forEach(p => {
    p.documents?.forEach((d, i) => {
      idMap.set(d.id, generateCuid());
    });
  });

  const resolveId = (id: string): string => idMap.get(id) || id;
  const resolveEmail = (email: string): string =>
    email === '{{EMAIL}}' ? options.email : email;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: options.email },
  });

  if (existingUser && !options.reset) {
    console.error(`\n❌ User already exists: ${options.email}`);
    console.error('Use --reset flag to delete and recreate\n');
    process.exit(1);
  }

  if (options.dryRun) {
    console.log('🔍 DRY RUN - No changes will be made\n');
    console.log(`Would create user: ${options.email}`);
    console.log(`Would create ${fixture.projects.length} project(s)`);
    fixture.projects.forEach(p => {
      console.log(`  - ${p.name}: ${p.conversations.length} conversations, ${p.fragments.length} fragments`);
    });
    console.log('\n✅ Dry run complete\n');
    return;
  }

  // Delete existing user if reset
  if (existingUser && options.reset) {
    console.log(`🗑️  Deleting existing user: ${options.email}`);
    await prisma.user.delete({ where: { email: options.email } });
  }

  // Create user
  console.log(`👤 Creating user: ${options.email}`);
  const user = await prisma.user.create({
    data: {
      email: options.email,
      name: fixture.user.name,
    },
  });

  // Create projects
  for (const projectFixture of fixture.projects) {
    const projectId = resolveId(projectFixture.id);
    console.log(`📁 Creating project: ${projectFixture.name}`);

    const project = await prisma.project.create({
      data: {
        id: projectId,
        userId: user.id,
        name: projectFixture.name,
        description: projectFixture.description,
        status: projectFixture.status,
        knowledgeSummary: projectFixture.knowledgeSummary,
        suggestedQuestions: projectFixture.suggestedQuestions || [],
      },
    });

    // Create deep dives first (conversations may reference them)
    for (const ddFixture of projectFixture.deepDives || []) {
      const ddId = resolveId(ddFixture.id);
      await prisma.deepDive.create({
        data: {
          id: ddId,
          projectId: project.id,
          topic: ddFixture.topic,
          notes: ddFixture.notes,
          status: ddFixture.status,
          origin: ddFixture.origin,
        },
      });
    }

    // Create documents
    for (const docFixture of projectFixture.documents || []) {
      const docId = resolveId(docFixture.id);
      await prisma.document.create({
        data: {
          id: docId,
          projectId: project.id,
          fileName: docFixture.fileName,
          fileType: docFixture.fileType,
          fileSizeBytes: docFixture.fileSizeBytes,
          uploadContext: docFixture.uploadContext,
          status: docFixture.status,
          deepDiveId: docFixture.deepDiveId ? resolveId(docFixture.deepDiveId) : undefined,
        },
      });
    }

    // Create conversations
    for (const convFixture of projectFixture.conversations) {
      const convId = resolveId(convFixture.id);
      const variant = options.variantOverride || convFixture.experimentVariant;

      console.log(`  💬 Creating conversation: ${convFixture.title || 'Untitled'}`);

      const conversation = await prisma.conversation.create({
        data: {
          id: convId,
          userId: user.id,
          projectId: project.id,
          title: convFixture.title,
          status: convFixture.status,
          currentPhase: convFixture.currentPhase,
          selectedLens: convFixture.selectedLens,
          questionCount: convFixture.questionCount,
          experimentVariant: variant,
        },
      });

      // Create messages
      for (const msgFixture of convFixture.messages) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: msgFixture.role,
            content: msgFixture.content,
            stepNumber: msgFixture.stepNumber,
            confidenceScore: msgFixture.confidenceScore,
            confidenceReasoning: msgFixture.confidenceReasoning,
          },
        });
      }

      // Create traces
      for (const traceFixture of convFixture.traces) {
        await prisma.trace.create({
          data: {
            conversationId: conversation.id,
            userId: user.id,
            extractedContext: traceFixture.extractedContext,
            dimensionalCoverage: traceFixture.dimensionalCoverage,
            output: traceFixture.output,
            claudeThoughts: traceFixture.claudeThoughts,
            modelUsed: traceFixture.modelUsed,
            totalTokens: traceFixture.totalTokens,
            promptTokens: traceFixture.promptTokens,
            completionTokens: traceFixture.completionTokens,
            latencyMs: traceFixture.latencyMs,
            starred: traceFixture.starred,
            starredAt: traceFixture.starred ? new Date() : undefined,
          },
        });
      }
    }

    // Create fragments
    for (const fragFixture of projectFixture.fragments) {
      const fragId = resolveId(fragFixture.id);
      const convId = fragFixture.conversationId ? resolveId(fragFixture.conversationId) : undefined;
      const docId = fragFixture.documentId ? resolveId(fragFixture.documentId) : undefined;

      const fragment = await prisma.fragment.create({
        data: {
          id: fragId,
          projectId: project.id,
          conversationId: convId,
          documentId: docId,
          content: fragFixture.content,
          contentType: fragFixture.contentType,
          status: fragFixture.status,
          confidence: fragFixture.confidence,
        },
      });

      // Create dimension tags
      for (const tagFixture of fragFixture.dimensionTags || []) {
        await prisma.fragmentDimensionTag.create({
          data: {
            fragmentId: fragment.id,
            dimension: tagFixture.dimension,
            confidence: tagFixture.confidence,
          },
        });
      }
    }

    console.log(`  ✅ Project complete: ${projectFixture.conversations.length} conversations, ${projectFixture.fragments.length} fragments`);
  }

  console.log(`\n✅ Hydration complete for ${options.email}\n`);
}

// Main
const options = parseArgs();

checkEnvironment(options)
  .then(() => hydrate(options))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
```

**Step 2: Commit**

```bash
git add scripts/seed/hydrate.ts
git commit -m "feat(seed): add hydration script"
```

---

## Phase 3: Export Script

### Task 8: Create Export Script

**Files:**
- Create: `scripts/seed/export.ts`

**Step 1: Create export script**

Create `scripts/seed/export.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Export User Data to Fixture
 *
 * Usage:
 *   npx tsx scripts/seed/export.ts --email jonny@example.com --output demo-dogfood.json
 *   npx tsx scripts/seed/export.ts --conversation clxyz123 --output baseline-conversation.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../src/lib/db';
import type { Fixture, ExportOptions } from './types';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

function parseArgs(): ExportOptions {
  const args = process.argv.slice(2);
  const options: Partial<ExportOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
        options.email = args[++i];
        break;
      case '--conversation':
        options.conversationId = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
    }
  }

  if (!options.output) {
    console.error('\n❌ Missing --output argument\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/seed/export.ts --email <email> --output <file.json>');
    console.log('  npx tsx scripts/seed/export.ts --conversation <id> --output <file.json>\n');
    process.exit(1);
  }

  if (!options.email && !options.conversationId) {
    console.error('\n❌ Must specify --email or --conversation\n');
    process.exit(1);
  }

  return options as ExportOptions;
}

function createPlaceholder(type: string, index: number): string {
  const typeMap: Record<string, string> = {
    project: 'PROJECT',
    conversation: 'CONV',
    fragment: 'FRAG',
    deepDive: 'DD',
    document: 'DOC',
  };
  const prefix = typeMap[type] || type.toUpperCase();
  return index === 0 ? `{{${prefix}_ID}}` : `{{${prefix}_${index}_ID}}`;
}

async function exportByEmail(email: string): Promise<Fixture> {
  console.log(`\n📤 Exporting user: ${email}\n`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      projects: {
        include: {
          conversations: {
            include: {
              messages: { orderBy: { stepNumber: 'asc' } },
              traces: { orderBy: { timestamp: 'asc' } },
            },
          },
          fragments: {
            include: {
              dimensionTags: true,
            },
          },
          deepDives: true,
          documents: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  // Create ID mappings
  const idMap = new Map<string, string>();
  let convIndex = 0;
  let fragIndex = 0;
  let ddIndex = 0;
  let docIndex = 0;

  user.projects.forEach((p, pIdx) => {
    idMap.set(p.id, createPlaceholder('project', pIdx));
    p.conversations.forEach(c => {
      idMap.set(c.id, createPlaceholder('conversation', convIndex++));
    });
    p.fragments.forEach(f => {
      idMap.set(f.id, createPlaceholder('fragment', fragIndex++));
    });
    p.deepDives.forEach(dd => {
      idMap.set(dd.id, createPlaceholder('deepDive', ddIndex++));
    });
    p.documents.forEach(d => {
      idMap.set(d.id, createPlaceholder('document', docIndex++));
    });
  });

  const resolveId = (id: string | null): string | undefined =>
    id ? (idMap.get(id) || id) : undefined;

  const fixture: Fixture = {
    template: {
      name: `export-${email.split('@')[0]}`,
      description: `Exported from ${email} on ${new Date().toISOString().split('T')[0]}`,
    },
    user: {
      name: user.name || '',
      email: '{{EMAIL}}',
    },
    projects: user.projects.map((project, pIdx) => ({
      id: idMap.get(project.id)!,
      name: project.name,
      description: project.description || undefined,
      status: project.status as 'active' | 'archived' | 'deleted',
      knowledgeSummary: project.knowledgeSummary || undefined,
      suggestedQuestions: project.suggestedQuestions,
      conversations: project.conversations.map(conv => ({
        id: idMap.get(conv.id)!,
        title: conv.title || undefined,
        status: conv.status as 'in_progress' | 'completed' | 'abandoned',
        currentPhase: conv.currentPhase,
        selectedLens: conv.selectedLens || undefined,
        questionCount: conv.questionCount,
        experimentVariant: conv.experimentVariant || undefined,
        messages: conv.messages.map(msg => ({
          role: msg.role as 'assistant' | 'user',
          content: msg.content,
          stepNumber: msg.stepNumber,
          confidenceScore: msg.confidenceScore as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
          confidenceReasoning: msg.confidenceReasoning || undefined,
        })),
        traces: conv.traces.map(trace => ({
          extractedContext: trace.extractedContext as Record<string, unknown>,
          dimensionalCoverage: trace.dimensionalCoverage as Record<string, unknown> | undefined,
          output: trace.output as Record<string, unknown>,
          claudeThoughts: trace.claudeThoughts || undefined,
          modelUsed: trace.modelUsed,
          totalTokens: trace.totalTokens,
          promptTokens: trace.promptTokens,
          completionTokens: trace.completionTokens,
          latencyMs: trace.latencyMs,
          starred: trace.starred || undefined,
        })),
      })),
      fragments: project.fragments.map(frag => ({
        id: idMap.get(frag.id)!,
        content: frag.content,
        contentType: frag.contentType as 'theme',
        status: frag.status as 'active',
        confidence: frag.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
        conversationId: resolveId(frag.conversationId),
        documentId: resolveId(frag.documentId),
        dimensionTags: frag.dimensionTags.map(tag => ({
          dimension: tag.dimension,
          confidence: tag.confidence as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
        })),
      })),
      deepDives: project.deepDives.map(dd => ({
        id: idMap.get(dd.id)!,
        topic: dd.topic,
        notes: dd.notes || undefined,
        status: dd.status as 'pending' | 'active' | 'resolved',
        origin: dd.origin as 'manual' | 'message' | 'document',
      })),
      documents: project.documents.map(doc => ({
        id: idMap.get(doc.id)!,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSizeBytes: doc.fileSizeBytes || undefined,
        uploadContext: doc.uploadContext || undefined,
        status: doc.status as 'pending' | 'processing' | 'complete' | 'failed',
        deepDiveId: resolveId(doc.deepDiveId),
      })),
    })),
  };

  return fixture;
}

async function exportByConversation(conversationId: string): Promise<Fixture> {
  console.log(`\n📤 Exporting conversation: ${conversationId}\n`);

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      user: true,
      messages: { orderBy: { stepNumber: 'asc' } },
      traces: { orderBy: { timestamp: 'asc' } },
      Project: true,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const fixture: Fixture = {
    template: {
      name: `conversation-${conversationId.slice(-8)}`,
      description: `Single conversation export on ${new Date().toISOString().split('T')[0]}`,
    },
    user: {
      name: conversation.user?.name || '',
      email: '{{EMAIL}}',
    },
    projects: [{
      id: '{{PROJECT_ID}}',
      name: conversation.Project?.name || 'Imported Project',
      status: 'active',
      suggestedQuestions: [],
      conversations: [{
        id: '{{CONV_ID}}',
        title: conversation.title || undefined,
        status: conversation.status as 'in_progress' | 'completed' | 'abandoned',
        currentPhase: conversation.currentPhase,
        selectedLens: conversation.selectedLens || undefined,
        questionCount: conversation.questionCount,
        experimentVariant: conversation.experimentVariant || undefined,
        messages: conversation.messages.map(msg => ({
          role: msg.role as 'assistant' | 'user',
          content: msg.content,
          stepNumber: msg.stepNumber,
          confidenceScore: msg.confidenceScore as 'HIGH' | 'MEDIUM' | 'LOW' | undefined,
          confidenceReasoning: msg.confidenceReasoning || undefined,
        })),
        traces: conversation.traces.map(trace => ({
          extractedContext: trace.extractedContext as Record<string, unknown>,
          dimensionalCoverage: trace.dimensionalCoverage as Record<string, unknown> | undefined,
          output: trace.output as Record<string, unknown>,
          claudeThoughts: trace.claudeThoughts || undefined,
          modelUsed: trace.modelUsed,
          totalTokens: trace.totalTokens,
          promptTokens: trace.promptTokens,
          completionTokens: trace.completionTokens,
          latencyMs: trace.latencyMs,
          starred: trace.starred || undefined,
        })),
      }],
      fragments: [],
      deepDives: [],
      documents: [],
    }],
  };

  return fixture;
}

async function main(): Promise<void> {
  const options = parseArgs();

  let fixture: Fixture;

  if (options.email) {
    fixture = await exportByEmail(options.email);
  } else if (options.conversationId) {
    fixture = await exportByConversation(options.conversationId);
  } else {
    throw new Error('Must specify --email or --conversation');
  }

  // Ensure output has .json extension
  const outputFile = options.output.endsWith('.json')
    ? options.output
    : `${options.output}.json`;

  const outputPath = path.join(FIXTURES_DIR, outputFile);

  fs.writeFileSync(outputPath, JSON.stringify(fixture, null, 2));

  console.log(`✅ Exported to: ${outputPath}\n`);

  // Summary
  console.log('Summary:');
  console.log(`  Projects: ${fixture.projects.length}`);
  fixture.projects.forEach(p => {
    console.log(`    - ${p.name}: ${p.conversations.length} convs, ${p.fragments.length} frags`);
  });
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
```

**Step 2: Commit**

```bash
git add scripts/seed/export.ts
git commit -m "feat(seed): add export script"
```

---

### Task 9: Add npm Scripts

**Files:**
- Modify: `package.json`

**Step 1: Add seed scripts to package.json**

Add these scripts to the `"scripts"` section in `package.json`:

```json
{
  "scripts": {
    // ... existing scripts ...
    "seed:hydrate": "tsx scripts/seed/hydrate.ts",
    "seed:export": "tsx scripts/seed/export.ts",
    "seed:validate": "tsx scripts/seed/validate.ts"
  }
}
```

**Step 2: Test scripts are accessible**

```bash
npm run seed:validate
```

Expected: "No fixture files found in scripts/seed/fixtures/"

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add seed npm scripts"
```

---

## Phase 4: Export Dogfood Data and Test

### Task 10: Export Existing Dogfood Data

**Prerequisites:** Complete Tasks 1-4 (environment setup) and Tasks 5-9 (scripts)

**Step 1: Find your user email**

```bash
npx prisma studio
```

Navigate to User table, find your email.

**Step 2: Export your account**

```bash
npm run seed:export -- --email YOUR_EMAIL@example.com --output demo-dogfood.json
```

Expected: Creates `scripts/seed/fixtures/demo-dogfood.json`

**Step 3: Validate the exported fixture**

```bash
npm run seed:validate
```

Expected: "All fixtures valid!" or specific errors to fix

**Step 4: Review and edit fixture**

Open `scripts/seed/fixtures/demo-dogfood.json` and:
- Update `template.name` to "demo-dogfood"
- Update `template.description` to something meaningful
- Remove any sensitive data if present

**Step 5: Commit fixture**

```bash
git add scripts/seed/fixtures/demo-dogfood.json
git commit -m "feat(seed): add dogfood fixture"
```

---

### Task 11: Test Hydration End-to-End

**Step 1: Test dry run**

```bash
npm run seed:hydrate -- --fixture demo-dogfood --email test-demo@example.com --dry-run
```

Expected: Shows what would be created without writing

**Step 2: Test actual hydration (on dev database)**

```bash
npm run seed:hydrate -- --fixture demo-dogfood --email test-demo@example.com
```

Expected: Creates user and all associated data

**Step 3: Verify in Prisma Studio**

```bash
npx prisma studio
```

Check User, Project, Conversation tables for new data

**Step 4: Test reset functionality**

```bash
npm run seed:hydrate -- --fixture demo-dogfood --email test-demo@example.com --reset
```

Expected: Deletes and recreates the user

**Step 5: Clean up test user**

```bash
# In Prisma Studio, delete the test-demo@example.com user
# Or leave it for further testing
```

---

### Task 12: Final Verification and Documentation

**Step 1: Run full verification**

```bash
npm run verify
```

Expected: All checks pass

**Step 2: Update README or docs (optional)**

If desired, add a section to `scripts/README.md` about the seed scripts.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete test data infrastructure setup"
```

---

## Post-Implementation: Data Migration

After all tasks complete, migrate your dogfood data to production:

1. **Export from old Prisma Postgres:**
   ```bash
   # Using the old DATABASE_URL temporarily
   DATABASE_URL="[OLD_PRISMA_URL]" npm run seed:export -- --email your@email.com --output production-seed.json
   ```

2. **Hydrate to new production:**
   ```bash
   DATABASE_URL="[PROD_CONNECTION_STRING]" npm run seed:hydrate -- --fixture production-seed --email your@email.com --production
   ```

3. **Delete old production-seed.json** (contains your real data)

4. **Retire old Prisma Postgres instance**
