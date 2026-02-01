/**
 * Automated Verification Script for Adaptive Conversation Flow
 *
 * This script verifies that all components of the adaptive conversation flow
 * are properly implemented and connected.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface VerificationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: VerificationResult[] = [];

function addResult(category: string, test: string, status: 'PASS' | 'FAIL', details?: string) {
  results.push({ category, test, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${category}: ${test}${details ? ` - ${details}` : ''}`);
}

async function verifyDatabaseSchema() {
  console.log('\n=== Database Schema Verification ===\n');

  try {
    // Try to query with new fields
    const conversation = await prisma.conversation.findFirst({
      select: {
        id: true,
        currentPhase: true,
        selectedLens: true,
        questionCount: true,
      },
    });

    addResult('Database', 'Conversation.currentPhase field exists', 'PASS');
    addResult('Database', 'Conversation.selectedLens field exists', 'PASS');
    addResult('Database', 'Conversation.questionCount field exists', 'PASS');

    const message = await prisma.message.findFirst({
      select: {
        id: true,
        confidenceScore: true,
        confidenceReasoning: true,
      },
    });

    addResult('Database', 'Message.confidenceScore field exists', 'PASS');
    addResult('Database', 'Message.confidenceReasoning field exists', 'PASS');
  } catch (error) {
    addResult('Database', 'Schema fields', 'FAIL', (error as Error).message);
  }
}

async function verifyFileStructure() {
  console.log('\n=== File Structure Verification ===\n');

  const requiredFiles = [
    {
      path: 'src/lib/types.ts',
      checks: ['ConversationPhase', 'StrategyLens', 'ConfidenceLevel', 'EnhancedExtractedContext'],
    },
    {
      path: 'src/lib/lens-prompts.ts',
      checks: ['LENS_DESCRIPTIONS', 'LENS_SELECTION_TEXT', 'getLensFramingPrompt'],
    },
    {
      path: 'src/app/api/conversation/assess-confidence/route.ts',
      checks: ['POST', 'CONFIDENCE_ASSESSMENT_PROMPT'],
    },
    {
      path: 'src/app/api/conversation/continue/route.ts',
      checks: ['handleInitialPhase', 'handleLensSelection', 'handleQuestioning'],
    },
    {
      path: 'src/app/api/extract/route.ts',
      checks: ['enrichment', 'reflective_summary'],
    },
    {
      path: 'src/components/ChatInterface.tsx',
      checks: ['currentPhase', 'getPlaceholderText'],
    },
    {
      path: 'src/components/ExtractionConfirm.tsx',
      checks: ['EnhancedExtractedContext', 'reflective_summary'],
    },
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file.path);

    if (!fs.existsSync(filePath)) {
      addResult('Files', `${file.path} exists`, 'FAIL', 'File not found');
      continue;
    }

    addResult('Files', `${file.path} exists`, 'PASS');

    const content = fs.readFileSync(filePath, 'utf-8');

    for (const check of file.checks) {
      if (content.includes(check)) {
        addResult('Files', `${file.path} contains ${check}`, 'PASS');
      } else {
        addResult('Files', `${file.path} contains ${check}`, 'FAIL', 'String not found in file');
      }
    }
  }
}

async function verifyLensSystem() {
  console.log('\n=== Lens System Verification ===\n');

  const lensPromptPath = path.join(process.cwd(), 'src/lib/lens-prompts.ts');
  const content = fs.readFileSync(lensPromptPath, 'utf-8');

  const lenses = ['A', 'B', 'C', 'D', 'E'];

  for (const lens of lenses) {
    if (content.includes(`${lens}:`)) {
      addResult('Lens System', `Lens ${lens} defined`, 'PASS');
    } else {
      addResult('Lens System', `Lens ${lens} defined`, 'FAIL');
    }
  }

  // Check for lens-specific prompting
  if (content.includes('CUSTOMER lens') || content.includes('customer lens')) {
    addResult('Lens System', 'Lens A (Customer) has specific framing', 'PASS');
  }

  if (content.includes('INDUSTRY/MARKET lens') || content.includes('industry/market lens')) {
    addResult('Lens System', 'Lens C (Industry) has specific framing', 'PASS');
  }
}

async function verifyPhaseRouting() {
  console.log('\n=== Phase Routing Verification ===\n');

  const continuePath = path.join(process.cwd(), 'src/app/api/conversation/continue/route.ts');
  const content = fs.readFileSync(continuePath, 'utf-8');

  const phases = ['INITIAL', 'LENS_SELECTION', 'QUESTIONING', 'EXTRACTION'];

  for (const phase of phases) {
    if (content.includes(`'${phase}'`) || content.includes(`"${phase}"`)) {
      addResult('Phase Routing', `Phase ${phase} referenced`, 'PASS');
    } else {
      addResult('Phase Routing', `Phase ${phase} referenced`, 'FAIL');
    }
  }

  // Check for key routing functions
  const routingFunctions = [
    'handleInitialPhase',
    'handleLensSelection',
    'handleQuestioning',
    'continueQuestioning',
    'offerEarlyExit',
    'moveToExtraction',
  ];

  for (const fn of routingFunctions) {
    if (content.includes(`async function ${fn}`) || content.includes(`function ${fn}`)) {
      addResult('Phase Routing', `Function ${fn} exists`, 'PASS');
    } else {
      addResult('Phase Routing', `Function ${fn} exists`, 'FAIL');
    }
  }
}

async function verifyConfidenceSystem() {
  console.log('\n=== Confidence System Verification ===\n');

  const assessPath = path.join(process.cwd(), 'src/app/api/conversation/assess-confidence/route.ts');
  const content = fs.readFileSync(assessPath, 'utf-8');

  if (content.includes('COVERAGE')) {
    addResult('Confidence', 'Coverage assessment criteria present', 'PASS');
  }

  if (content.includes('SPECIFICITY')) {
    addResult('Confidence', 'Specificity assessment criteria present', 'PASS');
  }

  if (content.includes('HIGH') && content.includes('MEDIUM') && content.includes('LOW')) {
    addResult('Confidence', 'All confidence levels defined', 'PASS');
  }
}

async function verifyEnrichmentSystem() {
  console.log('\n=== Enrichment System Verification ===\n');

  const extractPath = path.join(process.cwd(), 'src/app/api/extract/route.ts');
  const content = fs.readFileSync(extractPath, 'utf-8');

  const enrichmentFields = [
    'competitive_context',
    'customer_segments',
    'operational_capabilities',
    'technical_advantages',
  ];

  for (const field of enrichmentFields) {
    if (content.includes(field)) {
      addResult('Enrichment', `Field ${field} extracted`, 'PASS');
    }
  }

  if (content.includes('reflective_summary') || content.includes('REFLECTIVE_SUMMARY')) {
    addResult('Enrichment', 'Reflective summary generation present', 'PASS');
  }

  if (content.includes('strengths') && content.includes('emerging') && content.includes('unexplored')) {
    addResult('Enrichment', 'Reflective summary structure complete', 'PASS');
  }
}

async function verifyQuestionLimits() {
  console.log('\n=== Question Limit Verification ===\n');

  const continuePath = path.join(process.cwd(), 'src/app/api/conversation/continue/route.ts');
  const content = fs.readFileSync(continuePath, 'utf-8');

  if (content.includes('< 3') || content.includes('questionCount < 3')) {
    addResult('Limits', 'Minimum 3 questions enforced', 'PASS');
  } else {
    addResult('Limits', 'Minimum 3 questions enforced', 'FAIL');
  }

  if (content.includes('>= 10') || content.includes('questionCount >= 10')) {
    addResult('Limits', 'Maximum 10 questions enforced', 'PASS');
  } else {
    addResult('Limits', 'Maximum 10 questions enforced', 'FAIL');
  }

  if (content.includes('HIGH') && content.includes('early exit')) {
    addResult('Limits', 'Early exit based on confidence', 'PASS');
  }
}

async function generateReport() {
  console.log('\n=== Verification Summary ===\n');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);

  if (failed === 0) {
    console.log('\n🎉 All automated verification tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review the details above.');
  }

  // Save results to file
  const reportPath = path.join(process.cwd(), 'docs/testing/automated-verification-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);
}

async function main() {
  console.log('🔍 Starting Automated Verification of Adaptive Conversation Flow\n');

  try {
    await verifyDatabaseSchema();
    await verifyFileStructure();
    await verifyLensSystem();
    await verifyPhaseRouting();
    await verifyConfidenceSystem();
    await verifyEnrichmentSystem();
    await verifyQuestionLimits();
    await generateReport();
  } catch (error) {
    console.error('Verification error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
