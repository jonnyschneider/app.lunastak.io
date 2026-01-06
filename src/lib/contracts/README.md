# Data Contracts

This directory defines the data contracts for boundaries in the application pipeline.

## What Are Contracts?

Contracts are TypeScript types that define the exact shape of data at key boundaries:

- **Extraction Output** - What `/api/extract` produces
- **Fragment Persistence** - What gets written to the database
- **Generation Input** - What `/api/generate` expects
- **Generation Output** - What `/api/generate` returns

## Why Contracts?

1. **Catch breaking changes early** - Contract tests fail if shapes change
2. **Document expectations** - Types serve as documentation
3. **Enable safe refactoring** - Change internals freely, contracts protect boundaries

## Files

- `extraction.ts` - Extraction output contracts (emergent + prescriptive)
- `persistence.ts` - Fragment and dimension tag contracts
- `generation.ts` - Generation input/output contracts
- `index.ts` - Re-exports all contracts

## Usage

```typescript
import {
  validateEmergentExtraction,
  validateFragmentCreationResult,
  validateGenerationOutput,
} from '@/lib/contracts';

// Validate data at runtime
if (!validateEmergentExtraction(data)) {
  throw new Error('Invalid extraction output');
}
```

## Adding New Contracts

1. Define types in the appropriate file
2. Add validation function
3. Add tests in `__tests__/contracts/`
4. Run `npm run verify` to confirm

## Testing

Contract tests verify:
- Valid data passes validation
- Invalid data fails validation
- Required fields are enforced
- Type guards work correctly

Run: `npm test -- --testPathPattern=contracts`
