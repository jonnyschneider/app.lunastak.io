# Issues and Bug Fixes

Rolling record of issues discovered, investigations performed, and fixes applied.

---

## 2025-12-09: Generation Timeout Investigation

**Status:** In Progress - Diagnostic logging added

### Issue Description

During UAT testing, user reported that clicking "Generate my strategy" button resulted in timeout with no response. The generation appeared to hang with "nothing happened" after the user clicked the button.

### Investigation

**Configuration Found:**
- API route timeout: `maxDuration = 60` seconds (src/app/api/generate/route.ts:7)
- All API routes have same 60-second timeout
- Frontend fetch had NO timeout configuration
- Frontend had NO response status checking

**Problems Identified:**

1. **Frontend Issues:**
   - No response status checking before parsing JSON
   - Poor error handling - errors only logged to console, user saw nothing
   - No timing visibility for debugging

2. **Backend Issues:**
   - No diagnostic logging to track request flow
   - No visibility into where timeouts might occur
   - Unknown if Claude API calls with enriched prompts causing delays

### Fix Applied

**Frontend Changes (src/app/page.tsx:130-164):**
```typescript
const handleConfirmContext = async () => {
  // Added console logging with timestamps
  console.log('[Generate] Starting generation request...');
  const startTime = Date.now();

  const response = await fetch('/api/generate', { /* ... */ });

  console.log(`[Generate] Response received in ${Date.now() - startTime}ms, status: ${response.status}`);

  // Added response status checking
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Generation failed: ${response.status} - ${errorData.error || response.statusText}`);
  }

  // Added user-visible error alerts
  catch (error) {
    alert(`Failed to generate strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Backend Changes (src/app/api/generate/route.ts):**
```typescript
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  console.log('[Generate API] Request started');

  // Added logging at each stage:
  console.log('[Generate API] Parsed request body, conversationId:', conversationId);
  console.log('[Generate API] Conversation found, preparing context...');
  console.log('[Generate API] Calling Claude API...');
  console.log('[Generate API] Prompt length:', prompt.length, 'characters');
  console.log(`[Generate API] Claude API responded in ${latency}ms`);
  console.log('[Generate API] Saving trace to database...');
  console.log('[Generate API] Trace saved with ID:', trace.id);

  const totalTime = Date.now() - requestStartTime;
  console.log(`[Generate API] Request completed successfully in ${totalTime}ms`);

  // Enhanced error logging with stack traces
  catch (error) {
    console.error('[Generate API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}
```

### Diagnostic Information

**What the logging will show:**

Browser Console:
- `[Generate] Starting generation request...`
- `[Generate] Response received in XXXms, status: 200/500/etc`
- `[Generate] Successfully parsed response data` (or error details)

Server Logs (terminal running `npm run dev`):
- Request start/end with total duration
- Conversation ID tracking
- Prompt length (to detect if enriched context causes delays)
- Claude API latency specifically
- Database save confirmation
- Detailed error logging with stack traces

**This will identify if the issue is:**
- Frontend network timeout
- Claude API taking too long with enriched prompt
- Database save issue
- Error response being silently swallowed

### Next Steps

1. User to test at http://localhost:3000
2. Run through conversation and click "Generate my strategy"
3. Check both browser DevTools Console and server terminal
4. Logging will show exactly where the timeout occurs
5. Apply targeted fix based on diagnostic data

### Files Modified

- `src/app/page.tsx` - Added frontend logging and error handling
- `src/app/api/generate/route.ts` - Added comprehensive backend logging

---

## 2025-12-09: Generation API Ignoring Enriched Context

**Status:** ✅ Fixed

### Issue Description

After UAT testing adaptive conversation flow (3-10 questions with enrichment), strategy generation produced completely generic statements with warnings about "3 topic areas not being set". The enriched context and reflective summary were successfully captured during extraction, but generation API wasn't using them.

### Root Cause

The generation API (`/api/generate/route.ts`) was still using the old `ExtractedContext` type with only 3 core fields:
- `industry`
- `targetMarket`
- `uniqueValue`

It was completely ignoring:
- Enrichment fields (competitive_context, customer_segments, operational_capabilities, technical_advantages)
- Reflective summary (strengths, emerging themes, unexplored gaps, thought prompts)
- All the deep context gathered through the adaptive conversation

**Impact:** The entire adaptive conversation flow was wasted - users went through thoughtful multi-layered exploration, but generated strategy didn't leverage any of that depth.

### Fix Applied

**Changes to src/app/api/generate/route.ts:**

1. **Updated type import:**
```typescript
// Before
import { ExtractedContext, StrategyStatements, Trace } from '@/lib/types';

// After
import { EnhancedExtractedContext, StrategyStatements, Trace } from '@/lib/types';
```

2. **Rewrote generation prompt to include all sections:**
```typescript
const GENERATION_PROMPT = `Generate compelling strategy statements based on the comprehensive business context provided.

CORE CONTEXT:
Industry: {industry}
Target Market: {target_market}
Unique Value: {unique_value}

ENRICHMENT DETAILS:
{enrichment}

INSIGHTS FROM CONVERSATION:
Strengths identified:
{strengths}

Emerging themes:
{emerging}

Areas to explore further:
{unexplored}

Guidelines:
- Use the core context as foundation
- Leverage enrichment details to add specificity and differentiation
- Incorporate the strengths and emerging themes identified
...
`;
```

3. **Added formatting logic for enriched data:**
```typescript
const context = extractedContext as EnhancedExtractedContext;

// Format enrichment details
const enrichmentText = Object.entries(context.enrichment || {})
  .filter(([_, value]) => value)
  .map(([key, value]) => {
    const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
  })
  .join('\n');

// Format reflective summary
const strengthsText = (context.reflective_summary?.strengths || [])
  .map(s => `- ${s}`)
  .join('\n');
// ... similar for emerging and unexplored
```

4. **Updated template replacements:**
```typescript
const prompt = GENERATION_PROMPT
  .replace('{industry}', context.core.industry)  // Now uses nested structure
  .replace('{target_market}', context.core.target_market)
  .replace('{unique_value}', context.core.unique_value)
  .replace('{enrichment}', enrichmentText || 'None provided')
  .replace('{strengths}', strengthsText || 'None identified')
  .replace('{emerging}', emergingText || 'None identified')
  .replace('{unexplored}', unexploredText || 'None identified');
```

### Result

**Before:** Prompt ~50 words with only 3 generic fields
**After:** Prompt ~300+ words including conversation depth

Strategy statements now:
- Grounded in specific customer insights
- Reference competitive differentiation discussed
- Target emerging themes and strengths identified
- Reflect the actual depth of conversation

### Verification

- ✅ TypeScript compilation successful
- ✅ Build successful
- ✅ All type references aligned
- ✅ User confirmed "looks good"

### Files Modified

- `src/app/api/generate/route.ts` - Complete rewrite of generation logic

### Commit

- `b040dd0` - fix: connect enriched context to strategy generation

---

## 2025-12-09: TypeScript Build Error - Implicit Any Type

**Status:** ✅ Fixed

### Issue Description

Vercel automated builds were failing with TypeScript strict mode error:
```
Parameter 'm' implicitly has an 'any' type.
```

Location: `src/app/api/conversation/assess-confidence/route.ts:64`

### Root Cause

TypeScript strict mode requires explicit type annotations. The `.map()` callback didn't specify parameter type:

```typescript
const conversationHistory = conversation.messages
  .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
  .join('\n\n');
```

### Fix Applied

Added inline type annotation:

```typescript
const conversationHistory = conversation.messages
  .map((m: { role: string; content: string }) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
  .join('\n\n');
```

### Verification

- ✅ `npm run build` passes cleanly
- ✅ Vercel builds no longer blocked

### Files Modified

- `src/app/api/conversation/assess-confidence/route.ts:64`

### Commit

- `494f7b4` - fix: add type annotation to fix build error
