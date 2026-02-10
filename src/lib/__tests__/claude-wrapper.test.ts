/**
 * Enforcement test: All Claude API calls must use createMessage() wrapper
 *
 * This test scans the codebase to ensure developers don't accidentally
 * bypass the truncation detection wrapper.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(__dirname, '../../..');
const WRAPPER_FILE = 'src/lib/claude.ts';

// Pattern that indicates direct anthropic SDK usage (bypassing wrapper)
const DIRECT_USAGE_PATTERN = /anthropic\.messages\.create/g;

// Files that are allowed to use direct anthropic calls
const ALLOWED_FILES = [
  'src/lib/claude.ts', // The wrapper itself
];

function getAllTypeScriptFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!['node_modules', '.next', 'dist', '.git'].includes(entry.name)) {
        getAllTypeScriptFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      // Skip test files for this check (they might mock things)
      if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function getRelativePath(fullPath: string): string {
  return fullPath.replace(SRC_DIR + '/', '').replace(SRC_DIR + '\\', '');
}

describe('Claude API Wrapper Enforcement', () => {
  it('should only have direct anthropic.messages.create in the wrapper file', () => {
    const files = getAllTypeScriptFiles(path.join(SRC_DIR, 'src'));
    const violations: { file: string; matches: number }[] = [];

    for (const file of files) {
      const relativePath = getRelativePath(file);

      // Skip allowed files
      if (ALLOWED_FILES.some(allowed => relativePath.endsWith(allowed) || relativePath.includes(allowed.replace(/\//g, path.sep)))) {
        continue;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(DIRECT_USAGE_PATTERN);

      if (matches && matches.length > 0) {
        violations.push({ file: relativePath, matches: matches.length });
      }
    }

    if (violations.length > 0) {
      const message = violations
        .map(v => `  - ${v.file}: ${v.matches} direct call(s)`)
        .join('\n');

      throw new Error(
        `Found direct anthropic.messages.create usage outside the wrapper!\n\n` +
        `Violations:\n${message}\n\n` +
        `All Claude API calls must use createMessage() from '@/lib/claude'.\n` +
        `See docs/ARCHITECTURE.md for details.`
      );
    }
  });

  it('should have createMessage wrapper in claude.ts', () => {
    const wrapperPath = path.join(SRC_DIR, WRAPPER_FILE);
    const content = fs.readFileSync(wrapperPath, 'utf-8');

    // Check that the wrapper function exists
    expect(content).toContain('export async function createMessage');

    // Check that it wraps anthropic.messages.create
    expect(content).toContain('anthropic.messages.create');

    // Check that it detects truncation
    expect(content).toContain('max_tokens');
    expect(content).toContain('stop_reason');
  });

  it('should export createMessage from claude.ts', () => {
    const wrapperPath = path.join(SRC_DIR, WRAPPER_FILE);
    const content = fs.readFileSync(wrapperPath, 'utf-8');

    // Verify the function is exported
    expect(content).toMatch(/export\s+async\s+function\s+createMessage/);
  });
});
